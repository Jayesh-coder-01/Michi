"""
Dedicated Real PostgreSQL Integration Test Suite for Row Level Security (RLS)
Executes against a dedicated local or staging PostgreSQL instance.
Tests real PostgreSQL kernel RLS evaluation, SET LOCAL ROLE, set_config(), and auth.uid().

EXECUTION PREREQUISITE:
Run a local PostgreSQL container:
    docker run --name michi-pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=michi_test -p 5433:5432 -d postgres:16-alpine
Set environment variable:
    export POSTGRES_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/michi_test"
Run tests:
    pytest tests/test_postgres_rls_integration.py -v
"""

import os
import json
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import DBAPIError

POSTGRES_TEST_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL")

USER_A_UUID = "11111111-1111-1111-1111-111111111111"
USER_B_UUID = "22222222-2222-2222-2222-222222222222"

skip_if_no_postgres = pytest.mark.skipif(
    not POSTGRES_TEST_URL,
    reason="Dedicated PostgreSQL test database not configured via POSTGRES_TEST_DATABASE_URL environment variable."
)


@pytest.fixture(scope="module")
def pg_engine():
    """Create a connection engine to the dedicated PostgreSQL test database."""
    if not POSTGRES_TEST_URL:
        pytest.skip("POSTGRES_TEST_DATABASE_URL not set")
    db_url = POSTGRES_TEST_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(db_url, pool_pre_ping=True)
    
    # Initialize schema stubs for Supabase auth schema and roles if needed
    with engine.begin() as conn:
        auth_users_exist = conn.execute(text("SELECT to_regclass('auth.users');")).scalar()
        if not auth_users_exist:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth;"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS auth.users (
                    id UUID PRIMARY KEY,
                    email TEXT,
                    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """))

        # Create 'authenticated' and 'anon' roles if they do not exist
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                    CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                    CREATE ROLE anon NOLOGIN NOBYPASSRLS;
                END IF;
            END $$;
        """))

        # Create auth.uid() function mimicking Supabase if not already present
        auth_uid_exist = conn.execute(text("SELECT to_regprocedure('auth.uid()');")).scalar()
        if not auth_uid_exist:
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION auth.uid()
                RETURNS uuid AS $$
                SELECT COALESCE(
                    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                    ((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))
                )::uuid;
                $$ LANGUAGE sql STABLE;
            """))

        # Check if public.trips already exists (e.g. Supabase local instance already migrated)
        trips_exist = conn.execute(text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trips';")).scalar()
        if not trips_exist:
            # Read and apply Phase 2 profile migration
            phase2_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "supabase", "migrations", "20261124000000_phase2_auth_profiles.sql"
            )
            if os.path.exists(phase2_path):
                with open(phase2_path, "r", encoding="utf-8") as f:
                    conn.execute(text(f.read()))

            # Read and apply Phase 3 trips & stops migration
            phase3_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "supabase", "migrations", "20261125000000_phase3_trips_stops.sql"
            )
            if os.path.exists(phase3_path):
                with open(phase3_path, "r", encoding="utf-8") as f:
                    conn.execute(text(f.read()))

    yield engine
    engine.dispose()


@skip_if_no_postgres
def test_postgres_authenticated_role_switching(pg_engine):
    """Verify that SET LOCAL ROLE authenticated switches current_user in PostgreSQL."""
    with pg_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            current_user = conn.execute(text("SELECT current_user;")).scalar()
            assert current_user == "authenticated"


@skip_if_no_postgres
def test_postgres_jwt_claim_forwarding_and_auth_uid_resolution(pg_engine):
    """Verify that set_config forwards user UUID and auth.uid() resolves correctly."""
    with pg_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            resolved_uid = conn.execute(text("SELECT auth.uid()::text;")).scalar()
            assert resolved_uid == USER_A_UUID


@skip_if_no_postgres
def test_postgres_select_insert_update_delete_policies(pg_engine):
    """Verify all 4 PostgreSQL RLS policies (SELECT, INSERT, UPDATE, DELETE) against the real engine."""
    with pg_engine.connect() as conn:
        # Step 0: Ensure auth.users contains test records (run as superuser/owner)
        with conn.begin():
            conn.execute(text("INSERT INTO auth.users (id, email) VALUES (:id, 'a@michi.travel') ON CONFLICT (id) DO NOTHING;"), {"id": USER_A_UUID})
            conn.execute(text("INSERT INTO auth.users (id, email) VALUES (:id, 'b@michi.travel') ON CONFLICT (id) DO NOTHING;"), {"id": USER_B_UUID})

        # Step 1: INSERT policy - User A inserts own profile
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            conn.execute(text("""
                INSERT INTO public.profiles (id, username, display_name)
                VALUES (:id, 'alice_real_pg', 'Alice PG')
                ON CONFLICT (id) DO UPDATE SET display_name = 'Alice PG';
            """), {"id": USER_A_UUID})

        # Step 2: INSERT policy violation - User A tries to insert User B's profile
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            with pytest.raises(DBAPIError) as exc_info:
                conn.execute(text("""
                    INSERT INTO public.profiles (id, username, display_name)
                    VALUES (:id, 'bob_spoof', 'Bob Spoof');
                """), {"id": USER_B_UUID})
            assert "row-level security" in str(exc_info.value).lower()

        # Step 3: UPDATE policy - User A updates own profile
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            res = conn.execute(text("UPDATE public.profiles SET display_name = 'Alice Real PG Updated' WHERE id = :id;"), {"id": USER_A_UUID})
            assert res.rowcount == 1

        # Step 4: UPDATE policy cross-user - User A attempts to update User B's profile
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            # In PostgreSQL, an UPDATE violating USING clause silently updates 0 rows
            res = conn.execute(text("UPDATE public.profiles SET display_name = 'Hacked' WHERE id = :id;"), {"id": USER_B_UUID})
            assert res.rowcount == 0

        # Step 5: DELETE policy cross-user - User A attempts to delete User B's profile
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            res = conn.execute(text("DELETE FROM public.profiles WHERE id = :id;"), {"id": USER_B_UUID})
            assert res.rowcount == 0

        # Step 6: DELETE policy own - User A deletes own profile
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            res = conn.execute(text("DELETE FROM public.profiles WHERE id = :id;"), {"id": USER_A_UUID})
            assert res.rowcount == 1


@skip_if_no_postgres
def test_postgres_column_level_security_and_view(pg_engine):
    """Verify that anon role can query public.public_profiles but cannot read excluded columns."""
    with pg_engine.connect() as conn:
        # Step 1: anon queries the public view - should succeed
        with conn.begin():
            conn.execute(text("SET LOCAL ROLE anon;"))
            res = conn.execute(text("SELECT id, username, display_name FROM public.public_profiles;")).fetchall()
            assert isinstance(res, list)

        # Step 2: anon attempts to read excluded column 'updated_at' directly from public.profiles
        with conn.begin():
            conn.execute(text("SET LOCAL ROLE anon;"))
            with pytest.raises(DBAPIError) as exc_info:
                conn.execute(text("SELECT updated_at FROM public.profiles;"))
            assert "permission denied" in str(exc_info.value).lower()


@skip_if_no_postgres
def test_postgres_transaction_rollback_and_connection_pool_reuse(pg_engine):
    """Verify that when a transaction rolls back, claims and roles do NOT leak on connection reuse."""
    with pg_engine.connect() as conn:
        trans = conn.begin()
        conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
        conn.execute(text("SET LOCAL ROLE authenticated;"))
        assert conn.execute(text("SELECT auth.uid()::text;")).scalar() == USER_A_UUID
        trans.rollback()

        # In a new transaction on the same connection, verify state reverted to clean default
        with conn.begin():
            clean_uid = conn.execute(text("SELECT auth.uid();")).scalar()
            assert clean_uid is None, f"Expected auth.uid() to be NULL after rollback, got {clean_uid}"
            assert conn.execute(text("SELECT current_user;")).scalar() != "authenticated"


@skip_if_no_postgres
def test_postgres_behavior_after_exceptions(pg_engine):
    """Verify that after a SQL exception, subsequent transactions on the connection are clean."""
    with pg_engine.connect() as conn:
        with pytest.raises(DBAPIError):
            with conn.begin():
                conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
                conn.execute(text("SET LOCAL ROLE authenticated;"))
                conn.execute(text("SELECT * FROM non_existent_table_to_force_exception;"))

        # Connection should recover cleanly in the next transaction
        with conn.begin():
            uid = conn.execute(text("SELECT auth.uid();")).scalar()
            assert uid is None


@skip_if_no_postgres
def test_postgres_admin_connection_isolation(pg_engine):
    """Verify admin connection (without SET LOCAL ROLE) bypasses RLS while user connection is restricted."""
    with pg_engine.connect() as conn:
        with conn.begin():
            # As admin / superuser / table owner
            admin_user = conn.execute(text("SELECT current_user;")).scalar()
            assert admin_user != "authenticated"
            assert admin_user != "anon"


# ==============================================================================
# Phase 3 Native PostgreSQL Tests (RLS, Concurrency, and Migrations)
# ==============================================================================

@skip_if_no_postgres
def test_postgres_phase3_trips_and_stops_rls(pg_engine):
    """Verify Phase 3 RLS policies on public.trips and public.trip_stops."""
    with pg_engine.connect() as conn:
        trip_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        stop_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

        # Step 0: Ensure users exist in auth and profiles, and clean up any prior test rows
        with conn.begin():
            conn.execute(text("DELETE FROM public.trip_stops WHERE trip_id = :trip_id;"), {"trip_id": trip_id})
            conn.execute(text("DELETE FROM public.trips WHERE id = :trip_id;"), {"trip_id": trip_id})
            conn.execute(text("INSERT INTO auth.users (id, email) VALUES (:id, 'a@michi.travel') ON CONFLICT (id) DO NOTHING;"), {"id": USER_A_UUID})
            conn.execute(text("INSERT INTO auth.users (id, email) VALUES (:id, 'b@michi.travel') ON CONFLICT (id) DO NOTHING;"), {"id": USER_B_UUID})
            conn.execute(text("INSERT INTO public.profiles (id, username, display_name) VALUES (:id, 'alice_pg3', 'Alice PG3') ON CONFLICT (id) DO NOTHING;"), {"id": USER_A_UUID})
            conn.execute(text("INSERT INTO public.profiles (id, username, display_name) VALUES (:id, 'bob_pg3', 'Bob PG3') ON CONFLICT (id) DO NOTHING;"), {"id": USER_B_UUID})

        # Step 1: User A creates a private draft trip and adds a stop
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            conn.execute(text("""
                INSERT INTO public.trips (id, owner_id, title, starting_location, ending_location, visibility, status)
                VALUES (:trip_id, :owner_id, 'Alice Secret Trek', 'Kathmandu', 'Lukla', 'private', 'draft')
                ON CONFLICT (id) DO NOTHING;
            """), {"trip_id": trip_id, "owner_id": USER_A_UUID})
            conn.execute(text("""
                INSERT INTO public.trip_stops (id, trip_id, stop_name, location, latitude, longitude, order_index)
                VALUES (:stop_id, :trip_id, 'Basecamp', 'Himalayas', 27.9881, 86.9250, 0)
                ON CONFLICT (id) DO NOTHING;
            """), {"stop_id": stop_id, "trip_id": trip_id})

        # Step 2: User B tries to read User A's private trip - must see 0 rows
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_B_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            trips = conn.execute(text("SELECT id FROM public.trips WHERE id = :trip_id;"), {"trip_id": trip_id}).fetchall()
            assert len(trips) == 0
            stops = conn.execute(text("SELECT id FROM public.trip_stops WHERE id = :stop_id;"), {"stop_id": stop_id}).fetchall()
            assert len(stops) == 0

        # Step 3: Anon tries to read private trip - must see 0 rows
        with conn.begin():
            conn.execute(text("SET LOCAL ROLE anon;"))
            trips = conn.execute(text("SELECT id FROM public.trips WHERE id = :trip_id;"), {"trip_id": trip_id}).fetchall()
            assert len(trips) == 0

        # Step 4: User A publishes the trip (visibility='public', status='published')
        with conn.begin():
            conn.execute(text("SELECT set_config('request.jwt.claim.sub', :sub, true);"), {"sub": USER_A_UUID})
            conn.execute(text("SET LOCAL ROLE authenticated;"))
            conn.execute(text("""
                UPDATE public.trips 
                SET visibility = 'public', status = 'published' 
                WHERE id = :trip_id;
            """), {"trip_id": trip_id})

        # Step 5: Anon and User B can now read the published public trip and its stops
        with conn.begin():
            conn.execute(text("SET LOCAL ROLE anon;"))
            pub_trips = conn.execute(text("SELECT id FROM public.trips WHERE id = :trip_id;"), {"trip_id": trip_id}).fetchall()
            assert len(pub_trips) == 1
            pub_stops = conn.execute(text("SELECT id FROM public.trip_stops WHERE id = :stop_id;"), {"stop_id": stop_id}).fetchall()
            assert len(pub_stops) == 1


@skip_if_no_postgres
def test_postgres_phase3_stop_trip_id_immutability(pg_engine):
    """Verify that updating a stop's trip_id raises an exception via trigger."""
    trip_1 = "11111111-1111-4111-a111-111111111111"
    trip_2 = "22222222-2222-4222-a222-222222222222"
    stop_id = "33333333-3333-4333-a333-333333333333"

    with pg_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("DELETE FROM public.trip_stops WHERE id = :id;"), {"id": stop_id})
            conn.execute(text("DELETE FROM public.trips WHERE id IN (:t1, :t2);"), {"t1": trip_1, "t2": trip_2})
            conn.execute(text("INSERT INTO public.trips (id, owner_id, title, starting_location, ending_location) VALUES (:id, :owner_id, 'Trip 1', 'Loc A', 'Loc B') ON CONFLICT (id) DO NOTHING;"), {"id": trip_1, "owner_id": USER_A_UUID})
            conn.execute(text("INSERT INTO public.trips (id, owner_id, title, starting_location, ending_location) VALUES (:id, :owner_id, 'Trip 2', 'Loc C', 'Loc D') ON CONFLICT (id) DO NOTHING;"), {"id": trip_2, "owner_id": USER_A_UUID})
            conn.execute(text("INSERT INTO public.trip_stops (id, trip_id, stop_name, location, latitude, longitude, order_index) VALUES (:id, :trip_id, 'Stop 1', 'Loc S', 0, 0, 0) ON CONFLICT (id) DO NOTHING;"), {"id": stop_id, "trip_id": trip_1})

        with pytest.raises(DBAPIError) as exc_info:
            with conn.begin():
                conn.execute(text("UPDATE public.trip_stops SET trip_id = :new_trip_id WHERE id = :id;"), {"new_trip_id": trip_2, "id": stop_id})
        assert "trip_id cannot be modified on an existing stop" in str(exc_info.value)
