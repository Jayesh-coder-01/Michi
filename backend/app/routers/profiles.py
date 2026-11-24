"""
Profiles Router
Endpoints for user profile management, username availability checks, and AI settings
Aligned with PRD v1.0 Module 2 & docs/API.md Section 2.1
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import (
    get_current_user,
    get_optional_current_user,
    get_db_for_authenticated_user,
    get_db_for_optional_user,
    AuthenticatedUser,
)
from app.schemas.common import APIResponse
from app.schemas.profile import (
    ProfileUpdate,
    ProfileResponse,
    UsernameCheckResponse,
    AISettingsUpdate,
)
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get(
    "/me",
    response_model=APIResponse[ProfileResponse],
    summary="Get current user's profile and settings",
)
def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    claims = current_user.claims or {}
    user_metadata = {}
    if isinstance(claims.get("user_metadata"), dict):
        user_metadata.update(claims["user_metadata"])
    if isinstance(claims.get("raw_user_meta_data"), dict):
        user_metadata.update(claims["raw_user_meta_data"])
    for k in ("full_name", "name", "picture", "avatar_url"):
        if k in claims and k not in user_metadata:
            user_metadata[k] = claims[k]

    email = current_user.email or claims.get("email")

    profile = ProfileService.get_profile_by_user_id(
        db,
        current_user.id,
        is_owner=True,
        user_metadata=user_metadata,
        email=email,
    )
    return APIResponse(data=profile)


@router.patch(
    "/me",
    response_model=APIResponse[ProfileResponse],
    summary="Update current user's profile details",
)
def update_my_profile(
    req: ProfileUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    updated = ProfileService.update_profile(db, current_user.id, req)
    return APIResponse(data=updated)


@router.patch(
    "/me/ai-settings",
    response_model=APIResponse[ProfileResponse],
    summary="Enable or disable the AI chatbot on user profile (FR-AI-10)",
)
def update_ai_settings(
    req: AISettingsUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    updated = ProfileService.update_ai_settings(db, current_user.id, req)
    return APIResponse(data=updated)


@router.get(
    "/check-username",
    response_model=APIResponse[UsernameCheckResponse],
    summary="Check if a username is available",
)
def check_username(
    username: str = Query(..., min_length=1, description="Username to check"),
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db_for_optional_user),
):
    current_id = current_user.id if current_user else None
    result = ProfileService.check_username(db, username, current_id)
    return APIResponse(data=result)


@router.get(
    "/{username}",
    response_model=APIResponse[ProfileResponse],
    summary="Get public traveller profile by username",
)
def get_public_profile(
    username: str,
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db_for_optional_user),
):
    current_id = current_user.id if current_user else None
    profile = ProfileService.get_profile_by_username(db, username, current_id)
    return APIResponse(data=profile)
