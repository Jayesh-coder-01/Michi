"""
Pytest Test Fixtures and Test Database Configuration
Configured for Supabase Auth JWT Validation and Profile Isolation
"""

import sqlite3
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db, _sqlite_rls_state
from app.models.profile import Profile
from app.utils.security import create_test_supabase_jwt

# In-memory SQLite database for isolated test execution
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def _on_test_sqlite_connect(dbapi_connection, connection_record):
    """Register custom SQLite scalar functions to emulate Supabase auth.uid() and current_setting()."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.create_function("auth_uid", 0, lambda: _sqlite_rls_state.get("sub"))
        dbapi_connection.create_function(
            "current_setting", 2,
            lambda name, missing_ok=1: _sqlite_rls_state.get("sub") if "sub" in name else _sqlite_rls_state.get("role")
        )
        def _set_config(name, val, is_local=True):
            if "sub" in name:
                _sqlite_rls_state["sub"] = val
            elif "role" in name:
                _sqlite_rls_state["role"] = val
            return val
        dbapi_connection.create_function("set_config", 3, _set_config)


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@event.listens_for(TestingSessionLocal, "after_begin")
def _on_test_session_after_begin(session, transaction, connection):
    """Propagate RLS context across transactions in test sessions."""
    if "rls_user_id" in session.info:
        user_id = session.info.get("rls_user_id")
        role = session.info.get("rls_role", "authenticated")
        _sqlite_rls_state["sub"] = str(user_id) if user_id else None
        _sqlite_rls_state["role"] = role
        _sqlite_rls_state["claims"] = session.info.get("rls_claims", {})


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create a fresh database schema before each test and drop after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Yield a new database session for test operations."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """TestClient fixture overriding get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_profile(db_session):
    """Fixture that inserts a confirmed traveller profile into the test database."""
    profile = Profile(
        id="test-user-uuid-1",
        username="aarav.rides",
        display_name="Aarav Mehta",
        bio="Riding the trans-Himalayan trail. Explorer of high passes.",
        location="Jaipur, India",
        avatar_url="https://example.com/avatar.jpg",
        cover_image_url="https://example.com/cover.jpg",
        social_links={"instagram": "aarav.rides"},
        is_ai_chatbot_enabled=True,
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)
    return profile


@pytest.fixture
def auth_headers():
    """Fixture returning a valid Supabase Auth Bearer JWT header for test-user-uuid-1."""
    token = create_test_supabase_jwt(
        sub="test-user-uuid-1",
        email="aarav@michi.travel",
        username="aarav.rides",
    )
    return {"Authorization": f"Bearer {token}"}
