"""
MICHI Database Session & Engine Configuration
Supports PostgreSQL (Supabase) and SQLite (Local / Test Mode)
Provides Transaction-Scoped Supabase JWT Claims Forwarding for Row Level Security (RLS)
"""

import json
import sqlite3
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

# Engine configuration
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True if not settings.DATABASE_URL.startswith("sqlite") else False,
)

# In-memory RLS context for SQLite compatibility during local/offline tests
_sqlite_rls_state: Dict[str, Any] = {"sub": None, "role": "anon", "claims": {}}


@event.listens_for(engine, "connect")
def _on_sqlite_connect(dbapi_connection, connection_record):
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


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@event.listens_for(SessionLocal, "after_begin")
def _on_session_after_begin(session, transaction, connection):
    """
    Ensure every transaction started within an authenticated session inherits the RLS context.
    Executes within the exact transaction boundary before protected queries execute,
    even across commit() and rollback() boundaries within the same request lifecycle.
    """
    if "rls_user_id" in session.info:
        user_id = session.info.get("rls_user_id")
        role = session.info.get("rls_role", "authenticated")
        claims_json = json.dumps(session.info.get("rls_claims", {}))

        if connection.dialect.name == "postgresql":
            connection.execute(
                text("SELECT set_config('request.jwt.claims', :claims, true);"),
                {"claims": claims_json},
            )
            connection.execute(
                text("SELECT set_config('request.jwt.claim.sub', :sub, true);"),
                {"sub": str(user_id or "")},
            )
            connection.execute(
                text("SELECT set_config('request.jwt.claim.role', :role, true);"),
                {"role": role},
            )
            connection.execute(text(f"SET LOCAL ROLE {role};"))
        elif connection.dialect.name == "sqlite":
            _sqlite_rls_state["sub"] = str(user_id) if user_id else None
            _sqlite_rls_state["role"] = role
            _sqlite_rls_state["claims"] = session.info.get("rls_claims", {})


@event.listens_for(engine, "checkin")
def _on_pool_checkin(dbapi_connection, connection_record):
    """
    Prevent claim or role leakage across pooled database connections.
    Guarantees that when a connection is returned to the pool, its role and
    transaction-local configuration are wiped clean before reuse.
    """
    if engine.dialect.name == "postgresql":
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("RESET ROLE; DISCARD TEMP;")
            cursor.close()
        except Exception:
            pass


def set_session_rls_context(
    db: Session,
    user_id: Optional[str] = None,
    role: str = "authenticated",
    claims: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Propagate verified Supabase Auth JWT claims into the database session/transaction.
    Ensures that PostgreSQL auth.uid() returns the authenticated user UUID and queries
    run under the 'authenticated' role, activating PostgreSQL Row Level Security (RLS).
    """
    safe_role = "authenticated" if role == "authenticated" else "anon"
    claims_dict = claims or {}
    claims_json = json.dumps(claims_dict)

    # Store in session.info for transaction lifecycle management
    db.info["rls_user_id"] = user_id
    db.info["rls_role"] = safe_role
    db.info["rls_claims"] = claims_dict

    if engine.dialect.name == "postgresql":
        # Parameterized set_config execution - strictly injection safe
        db.execute(
            text("SELECT set_config('request.jwt.claims', :claims, true);"),
            {"claims": claims_json},
        )
        db.execute(
            text("SELECT set_config('request.jwt.claim.sub', :sub, true);"),
            {"sub": str(user_id or "")},
        )
        db.execute(
            text("SELECT set_config('request.jwt.claim.role', :role, true);"),
            {"role": safe_role},
        )
        # Apply PostgreSQL role for the current transaction
        db.execute(text(f"SET LOCAL ROLE {safe_role};"))
    elif engine.dialect.name == "sqlite":
        _sqlite_rls_state["sub"] = str(user_id) if user_id else None
        _sqlite_rls_state["role"] = safe_role
        _sqlite_rls_state["claims"] = claims_dict


def reset_session_rls_context(db: Session) -> None:
    """Reset RLS context and restore clean database session state."""
    db.info.pop("rls_user_id", None)
    db.info.pop("rls_role", None)
    db.info.pop("rls_claims", None)

    if engine.dialect.name == "postgresql":
        try:
            db.execute(text("RESET ROLE;"))
        except Exception:
            pass
    elif engine.dialect.name == "sqlite":
        _sqlite_rls_state["sub"] = None
        _sqlite_rls_state["role"] = "anon"
        _sqlite_rls_state["claims"] = {}


def get_db():
    """FastAPI Dependency for base database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
