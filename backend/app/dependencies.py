"""
FastAPI Dependencies for Supabase Auth JWT Validation and Profile Context
Single Source of Truth: Supabase Auth
"""

from typing import Optional, Dict, Any, Generator
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db, set_session_rls_context, reset_session_rls_context
from app.models.profile import Profile
from app.utils.security import validate_supabase_jwt

security_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "authenticated"
    claims: Dict[str, Any] = {}


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> AuthenticatedUser:
    """
    Validate incoming Bearer token as a valid Supabase Auth JWT.
    Extracts authenticated user UUID (sub) and claims.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = validate_supabase_jwt(credentials.credentials)
    user_id = claims["sub"]
    email = claims.get("email")
    role = claims.get("role", "authenticated")

    return AuthenticatedUser(
        id=user_id,
        email=email,
        role=role,
        claims=claims,
    )


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Optional[AuthenticatedUser]:
    """Return AuthenticatedUser if valid token provided; otherwise None (for public endpoints)."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials=credentials)
    except HTTPException:
        return None


def get_db_for_authenticated_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Generator[Session, None, None]:
    """
    Database session dependency for authenticated user operations.
    Propagates verified Supabase JWT claims into the PostgreSQL transaction session:
    - Sets transaction-local 'request.jwt.claims', 'request.jwt.claim.sub', and 'request.jwt.claim.role'
    - Applies LOCAL ROLE authenticated so PostgreSQL RLS engine evaluates auth.uid() = id
    - Reverts role and clears transaction-local parameters upon completion
    """
    set_session_rls_context(
        db,
        user_id=current_user.id,
        role=current_user.role,
        claims=current_user.claims,
    )
    try:
        yield db
    finally:
        reset_session_rls_context(db)


# Convenience alias
get_authenticated_db = get_db_for_authenticated_user


def get_db_for_optional_user(
    optional_user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> Generator[Session, None, None]:
    """
    Database session dependency for public or optional-auth endpoints.
    Applies authenticated RLS context if token present; otherwise sets 'anon' role context.
    """
    if optional_user:
        set_session_rls_context(
            db,
            user_id=optional_user.id,
            role=optional_user.role,
            claims=optional_user.claims,
        )
    else:
        set_session_rls_context(db, user_id=None, role="anon", claims={})
    try:
        yield db
    finally:
        reset_session_rls_context(db)


def get_admin_db(
    db: Session = Depends(get_db),
) -> Generator[Session, None, None]:
    """
    Privileged database session executing with database owner/service privileges.
    Bypasses RLS. Explicitly restricted to internal system maintenance, background triggers, and migrations.
    Never exposed to unauthenticated or arbitrary client input.
    """
    yield db
