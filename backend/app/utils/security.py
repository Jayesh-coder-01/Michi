"""
Security & Token Validation Utilities
Validates Supabase-issued JWTs against Supabase JWKS or Project Secret
Single Source of Truth for Identity: Supabase Auth
"""

import time
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
import httpx
from jose import jwt, JWTError
from app.config import settings

# In-memory cache for remote JWKS keys
_JWKS_CACHE: Dict[str, Any] = {"keys": None, "fetched_at": 0}
JWKS_CACHE_TTL_SECONDS = 3600  # 1 hour


def fetch_jwks(jwks_url: str, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
    """Fetch and cache Supabase project JWKS keys with key rotation support."""
    now = time.time()
    if not force_refresh and _JWKS_CACHE["keys"] and (now - _JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL_SECONDS):
        return _JWKS_CACHE["keys"]

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(jwks_url)
            if resp.status_code == 200:
                data = resp.json()
                _JWKS_CACHE["keys"] = data
                _JWKS_CACHE["fetched_at"] = now
                return data
    except Exception:
        pass
    return _JWKS_CACHE.get("keys")


def validate_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Validate a Supabase-issued JWT token.
    Enforces signature, expiration, audience ('authenticated'), and extracts subject UUID.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed or invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    alg = unverified_header.get("alg", "HS256")
    kid = unverified_header.get("kid")
    payload = None
    last_error = "Invalid or unverifiable token signature"

    # Strategy 1: Asymmetric JWKS (RS256 / ES256)
    if alg in ["RS256", "ES256"] and settings.SUPABASE_JWKS_URL:
        jwks = fetch_jwks(settings.SUPABASE_JWKS_URL)
        if jwks and "keys" in jwks:
            matching_key = None
            for key in jwks["keys"]:
                if key.get("kid") == kid:
                    matching_key = key
                    break
            # Key Rotation Support: if kid not found in cached JWKS, refresh once
            if not matching_key:
                jwks = fetch_jwks(settings.SUPABASE_JWKS_URL, force_refresh=True)
                if jwks and "keys" in jwks:
                    for key in jwks["keys"]:
                        if key.get("kid") == kid:
                            matching_key = key
                            break
            if matching_key:
                try:
                    payload = jwt.decode(
                        token,
                        matching_key,
                        algorithms=[alg],
                        options={"verify_aud": False},
                    )
                except JWTError as err:
                    last_error = str(err)

    # Strategy 2: Symmetric HMAC (HS256) via SUPABASE_JWT_SECRET
    if not payload and alg == "HS256" and settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except JWTError as err:
            last_error = str(err)

    # Strategy 3: Local Test / Dev Environment Fallback
    if not payload and (settings.ENVIRONMENT in ["development", "testing"] or settings.DEBUG):
        try:
            payload = jwt.decode(
                token,
                settings.TEST_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except JWTError as err:
            last_error = str(err)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {last_error}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Explicit Audience Validation
    aud = payload.get("aud")
    if aud != "authenticated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token audience '{aud}'. Expected 'authenticated'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Explicit Issuer Validation
    iss = payload.get("iss")
    expected_iss = f"{settings.SUPABASE_URL}/auth/v1"
    if iss and iss != expected_iss:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token issuer '{iss}'. Expected '{expected_iss}'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Explicit Subject (UUID) Validation
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identity subject (sub)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def create_test_supabase_jwt(
    sub: str,
    email: str = "traveller@michi.travel",
    username: str = "traveller",
    role: str = "authenticated",
    aud: str = "authenticated",
    iss: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    user_metadata: Optional[Dict[str, Any]] = None,
    app_metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate a mock Supabase Auth JWT token for isolated Pytest and local testing.
    Produces identical structure and claims to Supabase GoTrue tokens.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=1)

    resolved_user_meta = user_metadata if user_metadata is not None else {
        "username": username,
        "display_name": username.capitalize(),
    }
    resolved_app_meta = app_metadata if app_metadata is not None else {
        "provider": "email",
        "providers": ["email"],
    }

    payload = {
        "sub": sub,
        "email": email,
        "aud": aud,
        "role": role,
        "iss": iss or f"{settings.SUPABASE_URL}/auth/v1",
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "app_metadata": resolved_app_meta,
        "user_metadata": resolved_user_meta,
    }
    return jwt.encode(payload, settings.TEST_JWT_SECRET, algorithm="HS256")
