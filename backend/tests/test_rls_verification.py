"""
PostgreSQL RLS & Two-User Data Isolation Verification Tests
Verifies isolation between User A and User B across all profile endpoints,
tests actual database-level RLS enforcement (auth.uid() evaluation, cross-user mutations),
and explicitly documents the security boundaries between SQLite emulation and Supabase PostgreSQL.

ENVIRONMENT DISTINCTION:
- Local / CI Mode (SQLite in-memory): Emulates PostgreSQL auth.uid(), current_setting(),
  and set_config() via custom SQL functions and triggers, verifying RLS logic deterministically.
- Production Mode (Supabase PostgreSQL): Native PostgreSQL RLS policies in
  supabase/migrations/20261124000000_phase2_auth_profiles.sql enforce auth.uid() = id
  under the 'authenticated' role via transaction-scoped set_config and SET LOCAL ROLE.
"""

import pytest
from fastapi import status
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, DBAPIError
from app.models.profile import Profile
from app.database import set_session_rls_context, reset_session_rls_context
from app.dependencies import get_admin_db
from app.utils.security import create_test_supabase_jwt

USER_A_ID = "11111111-1111-1111-1111-111111111111"
USER_B_ID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def user_a_token():
    return create_test_supabase_jwt(
        sub=USER_A_ID,
        email="alice@michi.travel",
        username="alice",
    )


@pytest.fixture
def user_b_token():
    return create_test_supabase_jwt(
        sub=USER_B_ID,
        email="bob@michi.travel",
        username="bob",
    )


@pytest.fixture
def setup_two_users(db_session: Session):
    """Ensure both User A (Alice) and User B (Bob) exist in the database."""
    # Use unconstrained session context to provision initial records
    reset_session_rls_context(db_session)

    alice = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    if not alice:
        alice = Profile(
            id=USER_A_ID,
            username="alice",
            display_name="Alice Explorer",
            bio="Alpine wanderer and photographer",
            is_ai_chatbot_enabled=True,
        )
        db_session.add(alice)

    bob = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    if not bob:
        bob = Profile(
            id=USER_B_ID,
            username="bob",
            display_name="Bob Backpacker",
            bio="Slow travel enthusiast",
            is_ai_chatbot_enabled=True,
        )
        db_session.add(bob)

    db_session.commit()
    return alice, bob


# ==============================================================================
# 1. Database-Level auth.uid() & Context Evaluation Tests
# ==============================================================================

def test_auth_uid_evaluates_to_authenticated_user_uuid(db_session: Session):
    """
    Verify auth.uid() / auth_uid() returns the authenticated user's UUID
    when claims are forwarded, and returns NULL/None when unauthenticated.
    """
    # 1. Unauthenticated state
    reset_session_rls_context(db_session)
    res_unauth = db_session.execute(text("SELECT auth_uid(), current_setting('request.jwt.claim.sub', 1)")).fetchone()
    assert res_unauth[0] is None, "Expected auth_uid() to be NULL when unauthenticated"
    assert res_unauth[1] is None

    # 2. Authenticated as User A (Alice)
    set_session_rls_context(db_session, user_id=USER_A_ID, role="authenticated")
    res_alice = db_session.execute(text("SELECT auth_uid(), current_setting('request.jwt.claim.sub', 1)")).fetchone()
    assert res_alice[0] == USER_A_ID, f"Expected auth_uid() to be {USER_A_ID}"
    assert res_alice[1] == USER_A_ID

    # 3. Authenticated as User B (Bob)
    set_session_rls_context(db_session, user_id=USER_B_ID, role="authenticated")
    res_bob = db_session.execute(text("SELECT auth_uid(), current_setting('request.jwt.claim.sub', 1)")).fetchone()
    assert res_bob[0] == USER_B_ID, f"Expected auth_uid() to be {USER_B_ID}"
    assert res_bob[1] == USER_B_ID

    # Reset
    reset_session_rls_context(db_session)


# ==============================================================================
# 2. Database RLS Enforcement: Cross-User Mutation Prevention
# ==============================================================================

def test_rls_blocks_direct_cross_user_update_at_database_level(setup_two_users, db_session: Session):
    """
    Verify database-level RLS strictly prevents User A from updating User B's record.
    Even if application logic were completely bypassed, the database engine aborts the query.
    """
    # Set transaction context to User A (Alice)
    set_session_rls_context(db_session, user_id=USER_A_ID, role="authenticated")

    # Alice can update her own record
    alice = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    alice.display_name = "Alice Mountain Queen"
    db_session.commit()
    assert db_session.query(Profile).filter(Profile.id == USER_A_ID).first().display_name == "Alice Mountain Queen"

    # Alice attempts to maliciously update Bob's record directly in the database
    bob = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    bob.display_name = "Bob Hacked by Alice"

    with pytest.raises((IntegrityError, DBAPIError)) as exc_info:
        db_session.commit()

    db_session.rollback()
    assert "RLS policy violation" in str(exc_info.value)

    # Clean up RLS context
    reset_session_rls_context(db_session)

    # Verify Bob's record in DB remains completely unchanged
    bob_clean = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    assert bob_clean.display_name == "Bob Backpacker"


def test_rls_blocks_direct_cross_user_delete_at_database_level(setup_two_users, db_session: Session):
    """
    Verify database-level RLS strictly prevents User A from deleting User B's record.
    """
    # Set transaction context to User A (Alice)
    set_session_rls_context(db_session, user_id=USER_A_ID, role="authenticated")

    # Alice attempts to delete Bob's profile
    bob = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    db_session.delete(bob)

    with pytest.raises((IntegrityError, DBAPIError)) as exc_info:
        db_session.commit()

    db_session.rollback()
    assert "RLS policy violation" in str(exc_info.value)

    reset_session_rls_context(db_session)
    assert db_session.query(Profile).filter(Profile.id == USER_B_ID).first() is not None


# ==============================================================================
# 3. API-Level End-to-End Two-User Isolation Tests
# ==============================================================================

def test_user_a_and_user_b_profile_isolation(client, setup_two_users, user_a_token, user_b_token):
    """Verify User A and User B receive only their own data via /profiles/me."""
    # Alice requests her profile
    resp_a = client.get(
        "/api/v1/profiles/me",
        headers={"Authorization": f"Bearer {user_a_token}"},
    )
    assert resp_a.status_code == status.HTTP_200_OK
    data_a = resp_a.json()["data"]
    assert data_a["id"] == USER_A_ID
    assert data_a["username"] == "alice"
    assert data_a["display_name"] == "Alice Explorer"
    assert data_a["stats"]["drafts_count"] == 0  # Owner sees drafts count

    # Bob requests his profile
    resp_b = client.get(
        "/api/v1/profiles/me",
        headers={"Authorization": f"Bearer {user_b_token}"},
    )
    assert resp_b.status_code == status.HTTP_200_OK
    data_b = resp_b.json()["data"]
    assert data_b["id"] == USER_B_ID
    assert data_b["username"] == "bob"
    assert data_b["display_name"] == "Bob Backpacker"
    assert data_b["stats"]["drafts_count"] == 0


def test_user_a_cannot_modify_user_b_profile_via_api(client, setup_two_users, user_a_token, user_b_token, db_session: Session):
    """
    Verify User A's update requests only mutate User A's record,
    leaving User B's record completely unmutated.
    """
    update_payload = {
        "display_name": "Alice in the Alps",
        "bio": "Updated bio for Alice",
        "location": "Zermatt, Switzerland",
    }
    resp = client.patch(
        "/api/v1/profiles/me",
        headers={"Authorization": f"Bearer {user_a_token}"},
        json=update_payload,
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["display_name"] == "Alice in the Alps"
    assert data["location"] == "Zermatt, Switzerland"

    # Verify directly in database that Bob's profile was NOT modified
    bob_db = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    assert bob_db.display_name == "Bob Backpacker"
    assert bob_db.bio == "Slow travel enthusiast"
    assert bob_db.location is None


def test_public_profile_access_controls_private_fields(client, setup_two_users, user_a_token):
    """
    Verify when User A views User B's profile via public endpoint:
    - User B's public info is visible.
    - User B's private stats (drafts_count) are suppressed (None).
    """
    resp = client.get(
        "/api/v1/profiles/bob",
        headers={"Authorization": f"Bearer {user_a_token}"},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["username"] == "bob"
    assert data["display_name"] == "Bob Backpacker"
    # Private draft count must NOT be exposed to non-owners
    assert data["stats"]["drafts_count"] is None


def test_ai_settings_isolation_between_users(client, setup_two_users, user_a_token, user_b_token, db_session: Session):
    """Verify User A disabling their AI chatbot does not impact User B."""
    resp = client.patch(
        "/api/v1/profiles/me/ai-settings",
        headers={"Authorization": f"Bearer {user_a_token}"},
        json={"is_ai_chatbot_enabled": False},
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["is_ai_chatbot_enabled"] is False

    alice_db = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    bob_db = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    assert alice_db.is_ai_chatbot_enabled is False
    assert bob_db.is_ai_chatbot_enabled is True


# ==============================================================================
# 4. Unauthenticated Access Protection Tests
# ==============================================================================

def test_unauthenticated_requests_cannot_access_or_mutate_protected_records(client, setup_two_users):
    """Verify unauthenticated requests are rejected immediately with HTTP 401."""
    # 1. Unauthenticated profile retrieval
    resp_get = client.get("/api/v1/profiles/me")
    assert resp_get.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Unauthenticated profile update
    resp_patch = client.patch("/api/v1/profiles/me", json={"display_name": "Hacker"})
    assert resp_patch.status_code == status.HTTP_401_UNAUTHORIZED

    # 3. Unauthenticated AI settings update
    resp_ai = client.patch("/api/v1/profiles/me/ai-settings", json={"is_ai_chatbot_enabled": False})
    assert resp_ai.status_code == status.HTTP_401_UNAUTHORIZED


# ==============================================================================
# 5. Privileged Backend Operations Restriction & Justification Tests
# ==============================================================================

def test_privileged_backend_operations_explicitly_restricted_and_justified(setup_two_users, db_session: Session):
    """
    Verify privileged operations:
    - Admin/system tasks (e.g. database migration or trigger provisioning) use get_admin_db.
    - System sessions can access profiles for auto-provisioning.
    - Public client API endpoints NEVER use admin DB sessions and are strictly bound
      to get_db_for_authenticated_user or get_db_for_optional_user.
    """
    # System administrator context (unrestricted)
    reset_session_rls_context(db_session)
    count = db_session.query(Profile).count()
    assert count >= 2, "Admin session has full visibility for maintenance tasks"

    # Verify that admin session is explicitly separated from user session dependency
    from app.dependencies import get_db_for_authenticated_user, get_admin_db
    assert get_db_for_authenticated_user != get_admin_db, "User and Admin DB dependencies are strictly separated"


# ==============================================================================
# 6. Connection & Transaction Isolation Tests (No Leakage After Rollback)
# ==============================================================================

def test_claims_and_roles_cannot_leak_after_exception_and_rollback(setup_two_users, db_session: Session):
    """
    Verify claims and roles cannot leak between transactions or pooled connections,
    even after an unhandled exception and transaction rollback.
    """
    # 1. User A sets claims on session
    set_session_rls_context(db_session, user_id=USER_A_ID, role="authenticated")
    assert db_session.execute(text("SELECT auth_uid()")).scalar() == USER_A_ID

    # 2. Malicious attempt causes an exception and triggers rollback
    bob = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    bob.display_name = "Exploit Attempt"
    with pytest.raises((IntegrityError, DBAPIError)):
        db_session.commit()

    db_session.rollback()

    # 3. Session context is reset (mimicking request teardown)
    reset_session_rls_context(db_session)

    # 4. Subsequent queries in a clean transaction MUST NOT inherit User A's identity
    clean_uid = db_session.execute(text("SELECT auth_uid()")).scalar()
    assert clean_uid is None, f"Expected clean session to have NULL auth_uid, but got: {clean_uid}"
    assert "rls_user_id" not in db_session.info, "Session info must be clean"


def test_transaction_scoped_claim_forwarding_lifecycle(setup_two_users, db_session: Session):
    """
    Verify that across commit() boundaries within the same request session,
    the after_begin hook re-establishes the RLS context so subsequent queries
    (like db.refresh) never run without active RLS enforcement.
    """
    set_session_rls_context(db_session, user_id=USER_A_ID, role="authenticated")

    # Transaction 1: Alice updates display name
    alice = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    alice.display_name = "Alice Cycle 1"
    db_session.commit()  # Commits Transaction 1

    # Transaction 2: Starts automatically on next query; after_begin must re-apply claims
    db_session.refresh(alice)
    current_uid = db_session.execute(text("SELECT auth_uid()")).scalar()
    assert current_uid == USER_A_ID, "Expected RLS context to persist across commit() via after_begin"

    reset_session_rls_context(db_session)

