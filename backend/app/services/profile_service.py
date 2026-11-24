"""
Profile Service
Handles profile retrieval, updates, username availability checks, and AI settings
Aligned with PRD v1.0 Module 2 and docs/API.md Section 2.1
"""

import re
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.schemas.profile import (
    ProfileUpdate,
    ProfileResponse,
    ProfileStats,
    UsernameCheckResponse,
    AISettingsUpdate,
)


class ProfileService:
    @staticmethod
    def extract_display_name(user_metadata: Optional[Dict[str, Any]] = None, email: Optional[str] = None) -> str:
        """
        Extract display name using the strict four-tier metadata priority (Requirement 4):
        - Tier 1: full_name (e.g. from Google OAuth OIDC metadata)
        - Tier 2: name (standard Google account name claim)
        - Tier 3: Email prefix as fallback (e.g. 'elena.wander' from 'elena.wander@gmail.com')
        - Tier 4: 'New Traveller' only if no usable value exists
        """
        if user_metadata and isinstance(user_metadata, dict):
            # Tier 1: full_name
            full_name = user_metadata.get("full_name")
            if full_name and isinstance(full_name, str) and full_name.strip():
                return full_name.strip()

            # Tier 2: name
            name = user_metadata.get("name")
            if name and isinstance(name, str) and name.strip():
                return name.strip()

            # Contextual support for manual registration display_name if explicitly set
            display_name = user_metadata.get("display_name")
            if display_name and isinstance(display_name, str) and display_name.strip() and display_name.strip() != "New Traveller":
                return display_name.strip()

        # Tier 3: Email prefix as fallback
        if email and isinstance(email, str) and "@" in email:
            prefix = email.split("@")[0].strip()
            if prefix:
                return prefix

        # Tier 4: Default fallback
        return "New Traveller"

    @staticmethod
    def extract_username(
        user_metadata: Optional[Dict[str, Any]] = None,
        email: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Keep username generation separate from display-name generation (Requirement 8).
        Produces a clean lowercase alphanumeric/underscore handle.
        """
        if user_metadata and isinstance(user_metadata, dict):
            raw_username = user_metadata.get("username")
            if raw_username and isinstance(raw_username, str) and raw_username.strip():
                clean = re.sub(r"[^a-zA-Z0-9_.]", "", raw_username.strip()).lower()
                if len(clean) >= 3:
                    return clean

        if email and isinstance(email, str) and "@" in email:
            prefix = email.split("@")[0].strip()
            clean = re.sub(r"[^a-zA-Z0-9_.]", "", prefix).lower()
            if len(clean) >= 3:
                return clean

        uid_suffix = (user_id or "")[:6]
        return f"traveller_{uid_suffix}" if uid_suffix else "traveller"

    @staticmethod
    def extract_avatar_url(user_metadata: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract user avatar/picture URL from OAuth metadata."""
        if user_metadata and isinstance(user_metadata, dict):
            avatar = user_metadata.get("avatar_url") or user_metadata.get("picture")
            if avatar and isinstance(avatar, str) and avatar.strip():
                return avatar.strip()
        return None

    @staticmethod
    def get_or_create_profile(
        db: Session,
        user_id: str,
        default_username: Optional[str] = None,
        default_display_name: Optional[str] = None,
        user_metadata: Optional[Dict[str, Any]] = None,
        email: Optional[str] = None,
    ) -> Profile:
        """Retrieve existing profile or provision default profile for authenticated user."""
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            # Username generation kept separate from display name generation (Requirement 8)
            base_username = (
                default_username or ProfileService.extract_username(user_metadata, email, user_id)
            ).lower()
            final_username = base_username
            counter = 0
            while db.query(Profile).filter(Profile.username == final_username).first():
                counter += 1
                final_username = f"{base_username}{counter}"

            # Display name resolved using strict metadata priority (Requirements 4 & 5)
            final_display_name = (
                default_display_name or ProfileService.extract_display_name(user_metadata, email)
            )

            # Avatar URL extraction from OAuth metadata
            avatar_url = ProfileService.extract_avatar_url(user_metadata)

            profile = Profile(
                id=user_id,
                username=final_username,
                display_name=final_display_name,
                avatar_url=avatar_url,
                cover_image_url=None,
                bio=None,
                location=None,
                social_links={},
                is_ai_chatbot_enabled=True,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    @staticmethod
    def get_profile_by_user_id(
        db: Session,
        user_id: str,
        is_owner: bool = True,
        user_metadata: Optional[Dict[str, Any]] = None,
        email: Optional[str] = None,
    ) -> ProfileResponse:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            if is_owner:
                profile = ProfileService.get_or_create_profile(
                    db,
                    user_id=user_id,
                    user_metadata=user_metadata,
                    email=email,
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Traveller profile not found",
                )
        else:
            # Requirements 6 & 7:
            # Synchronize existing profile if it currently has the default "New Traveller" (or is empty).
            # Do NOT overwrite a display name that the user has manually customized.
            if is_owner and (
                profile.display_name == "New Traveller"
                or not profile.display_name
                or not profile.display_name.strip()
            ):
                candidate_name = ProfileService.extract_display_name(user_metadata, email)
                changed = False
                if (
                    candidate_name
                    and candidate_name != "New Traveller"
                    and candidate_name != profile.display_name
                ):
                    profile.display_name = candidate_name
                    changed = True

                # Synchronize avatar if currently missing
                if profile.avatar_url is None:
                    candidate_avatar = ProfileService.extract_avatar_url(user_metadata)
                    if candidate_avatar:
                        profile.avatar_url = candidate_avatar
                        changed = True

                if changed:
                    db.commit()
                    db.refresh(profile)

        stats = ProfileStats(
            published_trips_count=0,
            drafts_count=0 if is_owner else None,
            followers_count=0,
            following_count=0,
        )

        return ProfileResponse(
            id=profile.id,
            username=profile.username,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
            cover_image_url=profile.cover_image_url,
            bio=profile.bio,
            location=profile.location,
            social_links=profile.social_links or {},
            is_ai_chatbot_enabled=profile.is_ai_chatbot_enabled,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
            stats=stats,
        )

    @staticmethod
    def get_profile_by_username(db: Session, username: str, current_user_id: Optional[str] = None) -> ProfileResponse:
        profile = db.query(Profile).filter(Profile.username == username.lower()).first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Traveller '@{username}' not found",
            )

        is_owner = current_user_id is not None and str(profile.id) == str(current_user_id)

        stats = ProfileStats(
            published_trips_count=0,
            drafts_count=0 if is_owner else None,
            followers_count=0,
            following_count=0,
        )

        return ProfileResponse(
            id=profile.id,
            username=profile.username,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
            cover_image_url=profile.cover_image_url,
            bio=profile.bio,
            location=profile.location,
            social_links=profile.social_links or {},
            is_ai_chatbot_enabled=profile.is_ai_chatbot_enabled,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
            stats=stats,
        )

    @staticmethod
    def update_profile(db: Session, user_id: str, req: ProfileUpdate) -> ProfileResponse:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            profile = ProfileService.get_or_create_profile(db, user_id)

        # If username is changing, ensure uniqueness
        if req.username and req.username.lower() != profile.username:
            existing = db.query(Profile).filter(
                Profile.username == req.username.lower(),
                Profile.id != user_id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Username '@{req.username.lower()}' is already taken",
                )
            profile.username = req.username.lower()

        if req.display_name is not None:
            profile.display_name = req.display_name.strip()
        if req.bio is not None:
            profile.bio = req.bio.strip() if req.bio else None
        if req.location is not None:
            profile.location = req.location.strip() if req.location else None
        if req.avatar_url is not None:
            profile.avatar_url = req.avatar_url
        if req.cover_image_url is not None:
            profile.cover_image_url = req.cover_image_url
        if req.social_links is not None:
            profile.social_links = req.social_links

        db.commit()
        db.refresh(profile)

        return ProfileService.get_profile_by_user_id(db, user_id, is_owner=True)

    @staticmethod
    def update_ai_settings(db: Session, user_id: str, req: AISettingsUpdate) -> ProfileResponse:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            profile = ProfileService.get_or_create_profile(db, user_id)

        profile.is_ai_chatbot_enabled = req.is_ai_chatbot_enabled
        db.commit()
        db.refresh(profile)

        return ProfileService.get_profile_by_user_id(db, user_id, is_owner=True)

    @staticmethod
    def check_username(db: Session, username: str, current_user_id: Optional[str] = None) -> UsernameCheckResponse:
        clean = username.strip().lower()
        if len(clean) < 3 or len(clean) > 32:
            return UsernameCheckResponse(
                username=clean,
                available=False,
                message="Username must be between 3 and 32 characters long",
            )

        query = db.query(Profile).filter(Profile.username == clean)
        if current_user_id:
            query = query.filter(Profile.id != current_user_id)

        existing = query.first()
        if existing:
            return UsernameCheckResponse(
                username=clean,
                available=False,
                message=f"Username '@{clean}' is already taken",
            )

        return UsernameCheckResponse(
            username=clean,
            available=True,
            message=f"Username '@{clean}' is available",
        )
