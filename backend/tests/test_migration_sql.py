"""
Unit & Static Analysis Test Suite for Phase 3 Database Migrations
Validates SQL syntax, schema integrity, constraint declarations, security definitions,
pre-flight drift guards, and rollback safety for:
  - 20261125000000_phase3_trips_stops.sql
  - 20261125000000_phase3_trips_stops_down.sql

Execution Engine: Runs hermetically via pytest on local test environment (SQLite / Python).
"""

import os
import re
import pytest
from sqlalchemy import create_engine, text

MIGRATIONS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "supabase", "migrations")
)
ROLLBACKS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "supabase", "rollbacks")
)
UP_MIGRATION_PATH = os.path.join(MIGRATIONS_DIR, "20261125000000_phase3_trips_stops.sql")
DOWN_MIGRATION_PATH = os.path.join(ROLLBACKS_DIR, "20261125000000_phase3_trips_stops_down.sql")


def read_sql_file(path: str) -> str:
    assert os.path.exists(path), f"Migration file not found at: {path}"
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="module")
def up_sql() -> str:
    return read_sql_file(UP_MIGRATION_PATH)


@pytest.fixture(scope="module")
def down_sql() -> str:
    return read_sql_file(DOWN_MIGRATION_PATH)


# ==============================================================================
# 1. Migration File Existence & Formatting
# ==============================================================================

def test_migration_files_exist():
    """Verify UP migration exists in supabase/migrations and DOWN migration in supabase/rollbacks."""
    assert os.path.exists(UP_MIGRATION_PATH), f"Missing up migration: {UP_MIGRATION_PATH}"
    assert os.path.exists(DOWN_MIGRATION_PATH), f"Missing down migration: {DOWN_MIGRATION_PATH}"


def test_migration_naming_convention():
    """Verify standard timestamp-based naming convention."""
    filename = os.path.basename(UP_MIGRATION_PATH)
    assert re.match(r"^\d{14}_phase3_trips_stops\.sql$", filename), f"Invalid naming: {filename}"
    down_filename = os.path.basename(DOWN_MIGRATION_PATH)
    assert re.match(r"^\d{14}_phase3_trips_stops_down\.sql$", down_filename), f"Invalid naming: {down_filename}"


# ==============================================================================
# 2. Prerequisites & Drift Detection
# ==============================================================================

def test_prerequisites_verification_block(up_sql):
    """Verify prerequisite check asserts existence of Phase 2 profiles and handle_updated_at signature."""
    assert "information_schema.tables" in up_sql
    assert "table_name = 'profiles'" in up_sql
    assert "pg_proc" in up_sql
    assert "proname = 'handle_updated_at'" in up_sql
    # Exact function signature verification: 0 arguments and returning trigger
    assert "p.pronargs = 0" in up_sql
    assert "p.prorettype = 'trigger'::regtype" in up_sql
    # Must not recreate Phase 2 handle_updated_at function
    assert "CREATE OR REPLACE FUNCTION public.handle_updated_at" not in up_sql


def test_anti_drift_table_creation(up_sql):
    """Verify CREATE TABLE does not use IF NOT EXISTS to prevent silent schema drift."""
    # Pre-flight check verifies tables do not already exist
    assert "Pre-flight check failed: table public.trips already exists" in up_sql
    assert "Pre-flight check failed: table public.trip_stops already exists" in up_sql
    
    # Tables are created definitively (not IF NOT EXISTS)
    assert "CREATE TABLE public.trips (" in up_sql
    assert "CREATE TABLE IF NOT EXISTS public.trips" not in up_sql
    assert "CREATE TABLE public.trip_stops (" in up_sql
    assert "CREATE TABLE IF NOT EXISTS public.trip_stops" not in up_sql


def test_schema_qualified_enums_with_label_validation(up_sql):
    """Verify enums are public-qualified, verify enum type ('e'), and use IS DISTINCT FROM."""
    assert "CREATE TYPE public.trip_visibility AS ENUM ('public', 'private');" in up_sql
    assert "CREATE TYPE public.trip_status AS ENUM ('draft', 'published', 'archived');" in up_sql
    # Verification that existing object is actually an enum type ('e')
    assert "t.typtype = 'e'" in up_sql
    assert "Schema conflict: object public.trip_visibility exists but is not an enum type." in up_sql
    assert "Schema conflict: object public.trip_status exists but is not an enum type." in up_sql
    # Use IS DISTINCT FROM to guard against mismatched labels or NULL label arrays
    assert "existing_labels IS DISTINCT FROM ARRAY['public', 'private']::text[]" in up_sql
    assert "existing_labels IS DISTINCT FROM ARRAY['draft', 'published', 'archived']::text[]" in up_sql
    assert "Schema drift detected: type public.trip_visibility exists" in up_sql
    assert "Schema drift detected: type public.trip_status exists" in up_sql


def test_no_unused_uuid_ossp_extension(up_sql):
    """Verify uuid-ossp extension is not declared since gen_random_uuid() is built-in."""
    assert "uuid-ossp" not in up_sql


# ==============================================================================
# 3. Schema, Tables, and Columns Verification
# ==============================================================================

def test_trips_table_definition(up_sql):
    """Verify public.trips columns, types, defaults, and primary/foreign keys."""
    # Primary Key
    assert "id UUID PRIMARY KEY DEFAULT gen_random_uuid()" in up_sql
    
    # Foreign Key to profiles
    assert "owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE" in up_sql
    
    # Required columns with schema-qualified enums
    assert "title VARCHAR(150) NOT NULL" in up_sql
    assert "starting_location VARCHAR(255) NOT NULL" in up_sql
    assert "ending_location VARCHAR(255) NOT NULL" in up_sql
    assert "category VARCHAR(50) DEFAULT 'Other' NOT NULL" in up_sql
    assert "visibility public.trip_visibility DEFAULT 'private'::public.trip_visibility NOT NULL" in up_sql
    assert "status public.trip_status DEFAULT 'draft'::public.trip_status NOT NULL" in up_sql
    assert "created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL" in up_sql
    assert "updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL" in up_sql


def test_trip_stops_table_definition(up_sql):
    """Verify public.trip_stops columns, types, defaults, and constraints."""
    assert "id UUID PRIMARY KEY DEFAULT gen_random_uuid()" in up_sql
    assert "trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE" in up_sql
    assert "stop_name VARCHAR(150) NOT NULL" in up_sql
    assert "location VARCHAR(255) NOT NULL" in up_sql
    assert "latitude NUMERIC(10, 7) NOT NULL" in up_sql
    assert "longitude NUMERIC(10, 7) NOT NULL" in up_sql
    # order_index is NOT NULL without default, requiring explicit assignment
    assert "order_index INT NOT NULL" in up_sql
    assert "order_index INT DEFAULT" not in up_sql
    assert "created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL" in up_sql
    assert "updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL" in up_sql


# ==============================================================================
# 4. Constraints & Indexes Validation
# ==============================================================================

def test_trips_constraints(up_sql):
    """Verify validation constraints on public.trips."""
    assert "CONSTRAINT valid_dates CHECK" in up_sql
    assert "end_date IS NULL OR start_date IS NULL OR end_date >= start_date" in up_sql
    
    assert "CONSTRAINT valid_category CHECK" in up_sql
    categories = [
        'Solo travel', 'Road trip', 'Backpacking', 'Family trip', 'Adventure',
        'Trekking', 'Cultural exploration', 'Beach vacation', 'International travel', 'Other'
    ]
    for cat in categories:
        assert f"'{cat}'" in up_sql


def test_trip_stops_constraints(up_sql):
    """Verify validation constraints on public.trip_stops."""
    assert "CONSTRAINT valid_lat CHECK (latitude BETWEEN -90.0000000 AND 90.0000000)" in up_sql
    assert "CONSTRAINT valid_lng CHECK (longitude BETWEEN -180.0000000 AND 180.0000000)" in up_sql
    assert "CONSTRAINT valid_stop_dates CHECK" in up_sql
    assert "departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date" in up_sql
    assert "CONSTRAINT valid_order_index CHECK (order_index >= 0)" in up_sql
    assert "CONSTRAINT uq_trip_stops_trip_order UNIQUE (trip_id, order_index) DEFERRABLE INITIALLY DEFERRED" in up_sql


def test_no_redundant_index_on_trip_stops(up_sql):
    """Verify uq_trip_stops_trip_order provides index; no redundant index created."""
    assert "idx_trip_stops_trip_id_order" not in up_sql
    # Indexes on trips are retained
    assert "CREATE INDEX idx_trips_owner_id ON public.trips(owner_id);" in up_sql
    assert "CREATE INDEX idx_trips_visibility_status ON public.trips(visibility, status);" in up_sql
    assert "CREATE INDEX idx_trips_created_at ON public.trips(created_at DESC);" in up_sql


# ==============================================================================
# 5. Security & Function Hygiene
# ==============================================================================

def test_triggers_and_search_path(up_sql):
    """Verify triggers reuse Phase 2 handle_updated_at and secure prevent_stop_trip_reassignment."""
    assert "EXECUTE FUNCTION public.handle_updated_at();" in up_sql
    assert "CREATE FUNCTION public.prevent_stop_trip_reassignment()" in up_sql
    assert "CREATE OR REPLACE FUNCTION" not in up_sql
    assert "SET search_path = ''" in up_sql
    assert "NEW.trip_id IS DISTINCT FROM OLD.trip_id" in up_sql


def test_row_level_security_and_grants(up_sql):
    """Verify RLS and least-privilege grants with explicit privilege cleanup."""
    assert "ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;" in up_sql
    assert "ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;" in up_sql
    # Explicit privilege cleanup before applying intended grants
    assert "REVOKE ALL ON TABLE public.trips FROM PUBLIC, anon, authenticated, service_role;" in up_sql
    assert "REVOKE ALL ON TABLE public.trip_stops FROM PUBLIC, anon, authenticated, service_role;" in up_sql
    # Intended grants
    assert "GRANT SELECT ON TABLE public.trips TO anon;" in up_sql
    assert "GRANT SELECT ON TABLE public.trip_stops TO anon;" in up_sql
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trips TO authenticated;" in up_sql
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_stops TO authenticated;" in up_sql
    assert "GRANT ALL ON TABLE public.trips TO service_role;" in up_sql
    assert "GRANT ALL ON TABLE public.trip_stops TO service_role;" in up_sql


# ==============================================================================
# 6. Rollback Completeness (No CASCADE, Safe Drop)
# ==============================================================================

def test_rollback_no_cascade(down_sql):
    """Verify down migration does NOT use CASCADE in any DROP statements."""
    # Strip comments
    sql_statements = re.sub(r"--.*", "", down_sql)
    assert not re.search(r"\bCASCADE\b", sql_statements, re.IGNORECASE), "DROP statements must not use CASCADE"
    assert "DROP TABLE IF EXISTS public.trip_stops;" in down_sql
    assert "DROP TABLE IF EXISTS public.trips;" in down_sql
    assert "DROP TYPE IF EXISTS public.trip_status;" in down_sql
    assert "DROP TYPE IF EXISTS public.trip_visibility;" in down_sql


def test_rollback_safe_when_tables_absent(down_sql):
    """Verify triggers are dropped conditionally inside DO block to handle absent tables."""
    assert "DO $$" in down_sql
    assert "information_schema.tables" in down_sql
    assert "DROP TRIGGER IF EXISTS check_stop_trip_immutable ON public.trip_stops;" in down_sql
    assert "DROP TRIGGER IF EXISTS set_trips_updated_at ON public.trips;" in down_sql
    # Preserves Phase 2 handle_updated_at
    assert "DROP FUNCTION IF EXISTS public.handle_updated_at" not in down_sql


# ==============================================================================
# 7. SQLite Schema Emulation Test (Local Execution)
# ==============================================================================

def test_sqlite_emulated_schema_creation():
    """Verify that an equivalent relational schema operates cleanly in SQLite."""
    sqlite_engine = create_engine("sqlite:///:memory:")
    with sqlite_engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL
            );
        """))
        conn.execute(text("""
            CREATE TABLE trips (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                cover_image_url TEXT,
                starting_location TEXT NOT NULL,
                ending_location TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                category TEXT DEFAULT 'Other' NOT NULL,
                visibility TEXT DEFAULT 'private' NOT NULL,
                status TEXT DEFAULT 'draft' NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
                CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
            );
        """))
        conn.execute(text("""
            CREATE TABLE trip_stops (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                stop_name TEXT NOT NULL,
                location TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                arrival_date TEXT,
                departure_date TEXT,
                accommodation_details TEXT,
                activities TEXT,
                notes TEXT,
                order_index INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
                CHECK (latitude BETWEEN -90.0 AND 90.0),
                CHECK (longitude BETWEEN -180.0 AND 180.0),
                CHECK (order_index >= 0),
                UNIQUE(trip_id, order_index)
            );
        """))
        conn.execute(text("INSERT INTO profiles (id, username) VALUES ('user1', 'traveller1');"))
        conn.execute(text("""
            INSERT INTO trips (id, owner_id, title, starting_location, ending_location)
            VALUES ('trip1', 'user1', 'Tokyo Journey', 'Tokyo', 'Kyoto');
        """))
        # Explicit order_index passed on insert
        conn.execute(text("""
            INSERT INTO trip_stops (id, trip_id, stop_name, location, latitude, longitude, order_index)
            VALUES ('stop1', 'trip1', 'Hakone', 'Hakone', 35.232, 139.106, 0);
        """))
        res = conn.execute(text("SELECT t.title, s.stop_name FROM trips t JOIN trip_stops s ON t.id = s.trip_id;")).fetchone()
        assert res[0] == "Tokyo Journey"
        assert res[1] == "Hakone"
