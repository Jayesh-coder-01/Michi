"""
Profiles Unit & Integration Tests
Tests profile retrieval, updates, username checks, AI chatbot toggle, and ownership isolation
"""

import pytest
from fastapi import status
from app.models.profile import Profile
from app.utils.security import create_test_supabase_jwt


def test_get_my_profile_authenticated(client, test_profile, auth_headers):
    response = client.get("/api/v1/profiles/me", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    profile = data["data"]
    assert profile["id"] == "test-user-uuid-1"
    assert profile["username"] == "aarav.rides"
    assert profile["display_name"] == "Aarav Mehta"
    assert profile["location"] == "Jaipur, India"
    assert profile["is_ai_chatbot_enabled"] is True


def test_update_my_profile(client, test_profile, auth_headers):
    update_payload = {
        "display_name": "Aarav Mehta (Explorer)",
        "bio": "Updated bio: traversing Spiti & Ladakh.",
        "location": "Leh, Ladakh",
    }
    response = client.patch("/api/v1/profiles/me", json=update_payload, headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    updated = data["data"]
    assert updated["display_name"] == "Aarav Mehta (Explorer)"
    assert updated["bio"] == "Updated bio: traversing Spiti & Ladakh."
    assert updated["location"] == "Leh, Ladakh"


def test_update_profile_duplicate_username(client, test_profile, auth_headers, db_session):
    # Insert a second profile
    second_profile = Profile(
        id="test-user-uuid-2",
        username="second.traveller",
        display_name="Second Traveller",
    )
    db_session.add(second_profile)
    db_session.commit()

    # User 1 attempts to change username to User 2's username
    response = client.patch("/api/v1/profiles/me", json={"username": "second.traveller"}, headers=auth_headers)
    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["success"] is False
    assert "already taken" in response.json()["error"]["message"].lower()


def test_check_username_availability(client, test_profile):
    # Already taken username
    res_taken = client.get("/api/v1/profiles/check-username?username=aarav.rides")
    assert res_taken.status_code == status.HTTP_200_OK
    assert res_taken.json()["data"]["available"] is False

    # Available username
    res_available = client.get("/api/v1/profiles/check-username?username=himalayan_nomad")
    assert res_available.status_code == status.HTTP_200_OK
    assert res_available.json()["data"]["available"] is True


def test_get_public_profile_success(client, test_profile):
    response = client.get("/api/v1/profiles/aarav.rides")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert data["data"]["username"] == "aarav.rides"
    assert data["data"]["display_name"] == "Aarav Mehta"
    # Drafts should be hidden for visitor
    assert data["data"]["stats"]["drafts_count"] is None


def test_get_public_profile_not_found(client):
    response = client.get("/api/v1/profiles/ghost_user_99999")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert data["success"] is False


def test_toggle_ai_chatbot_settings(client, test_profile, auth_headers):
    # Disable AI chatbot
    res_off = client.patch("/api/v1/profiles/me/ai-settings", json={"is_ai_chatbot_enabled": False}, headers=auth_headers)
    assert res_off.status_code == status.HTTP_200_OK
    assert res_off.json()["data"]["is_ai_chatbot_enabled"] is False

    # Enable AI chatbot
    res_on = client.patch("/api/v1/profiles/me/ai-settings", json={"is_ai_chatbot_enabled": True}, headers=auth_headers)
    assert res_on.status_code == status.HTTP_200_OK
    assert res_on.json()["data"]["is_ai_chatbot_enabled"] is True


def test_profile_auto_provisioning_for_new_supabase_user(client):
    """When a new user authenticates with Supabase, provision profile if missing."""
    new_user_token = create_test_supabase_jwt(
        sub="new-supabase-user-uuid",
        email="newuser@michi.travel",
        username="newuser",
    )
    headers = {"Authorization": f"Bearer {new_user_token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert data["data"]["id"] == "new-supabase-user-uuid"


def test_profile_ownership_protection(client, test_profile, auth_headers, db_session):
    """User B cannot alter User A's profile."""
    token_b = create_test_supabase_jwt(
        sub="user-b-uuid",
        email="user_b@michi.travel",
        username="user_b",
    )
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B updates their profile
    client.patch("/api/v1/profiles/me", json={"display_name": "User B Custom"}, headers=headers_b)

    # Verify User A's profile remains untouched
    res_a = client.get("/api/v1/profiles/me", headers=auth_headers)
    assert res_a.json()["data"]["display_name"] == "Aarav Mehta"


def test_google_oauth_provisioning_full_name_priority(client):
    """Priority 1: full_name is selected over name, email prefix, and fallback."""
    token = create_test_supabase_jwt(
        sub="google-user-full-name-uuid",
        email="elena.google@gmail.com",
        user_metadata={
            "full_name": "Elena Rostova",
            "name": "Elena R",
            "picture": "https://lh3.googleusercontent.com/avatar.jpg",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["id"] == "google-user-full-name-uuid"
    assert data["display_name"] == "Elena Rostova"
    assert data["avatar_url"] == "https://lh3.googleusercontent.com/avatar.jpg"


def test_google_oauth_provisioning_name_fallback(client):
    """Priority 2: name is selected when full_name is missing."""
    token = create_test_supabase_jwt(
        sub="google-user-name-uuid",
        email="elena.google@gmail.com",
        user_metadata={
            "name": "Elena Rostova",
            "picture": "https://lh3.googleusercontent.com/avatar2.jpg",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["display_name"] == "Elena Rostova"
    assert data["avatar_url"] == "https://lh3.googleusercontent.com/avatar2.jpg"


def test_google_oauth_provisioning_email_prefix_fallback(client):
    """Priority 3: Email prefix is used when both full_name and name are empty."""
    token = create_test_supabase_jwt(
        sub="google-user-email-uuid",
        email="elena.nomad@gmail.com",
        user_metadata={"full_name": "", "name": "   "},
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["display_name"] == "elena.nomad"


def test_google_oauth_provisioning_new_traveller_fallback(client):
    """Priority 4: 'New Traveller' only if no usable metadata or email exists."""
    token = create_test_supabase_jwt(
        sub="no-meta-uuid",
        email="",
        user_metadata={},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["display_name"] == "New Traveller"


def test_existing_profile_sync_from_new_traveller(client, db_session):
    """Requirement 6: Existing profile holding 'New Traveller' is safely synchronized with Google metadata."""
    user_id = "existing-traveller-to-sync-uuid"
    profile = Profile(
        id=user_id,
        username="elena_sync",
        display_name="New Traveller",
        avatar_url=None,
    )
    db_session.add(profile)
    db_session.commit()

    token = create_test_supabase_jwt(
        sub=user_id,
        email="elena@gmail.com",
        user_metadata={
            "full_name": "Elena Rostova",
            "picture": "https://lh3.googleusercontent.com/avatar_synced.jpg",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["display_name"] == "Elena Rostova"
    assert data["avatar_url"] == "https://lh3.googleusercontent.com/avatar_synced.jpg"

    # Verify directly in database that profile record was updated
    refreshed = db_session.query(Profile).filter(Profile.id == user_id).first()
    assert refreshed.display_name == "Elena Rostova"
    assert refreshed.avatar_url == "https://lh3.googleusercontent.com/avatar_synced.jpg"


def test_existing_profile_does_not_overwrite_custom_display_name(client, db_session):
    """Requirement 7: Do NOT overwrite a display name that the user has manually customized."""
    user_id = "customized-user-uuid"
    profile = Profile(
        id=user_id,
        username="elena_custom",
        display_name="Elena Custom Explorer",
        avatar_url="https://example.com/custom_avatar.jpg",
    )
    db_session.add(profile)
    db_session.commit()

    # User logs in with Google metadata offering a different full_name
    token = create_test_supabase_jwt(
        sub=user_id,
        email="elena@gmail.com",
        user_metadata={
            "full_name": "Elena Rostova (From Google)",
            "picture": "https://lh3.googleusercontent.com/new_avatar.jpg",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    # Custom display name is preserved
    assert data["display_name"] == "Elena Custom Explorer"
    # Custom avatar is preserved
    assert data["avatar_url"] == "https://example.com/custom_avatar.jpg"


def test_username_generation_separate_from_display_name(client):
    """Requirement 8: Username generation is kept separate from display-name generation."""
    token = create_test_supabase_jwt(
        sub="separate-username-uuid",
        email="elena.wander@gmail.com",
        user_metadata={
            "full_name": "Elena Rostova (High Altitude Explorer!)",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["display_name"] == "Elena Rostova (High Altitude Explorer!)"
    # Username is a clean, lowercase handle derived without special characters
    assert data["username"] == "elena.wander"
    assert " " not in data["username"]
    assert "!" not in data["username"]


def test_regression_existing_profile_with_custom_name_and_custom_avatar_never_overwritten(client, db_session):
    """
    Regression Test (Items 4 & 6):
    Existing profile with a custom display name and custom avatar URL must NEVER be overwritten
    when the user subsequently authenticates via Google OAuth with different metadata.
    """
    user_id = "regression-custom-user-uuid"
    custom_profile = Profile(
        id=user_id,
        username="kailash_climber",
        display_name="Kailash Climber",
        avatar_url="https://cdn.michi.travel/avatars/custom_photo.webp",
        bio="Himalayan mountaineer and photographer",
    )
    db_session.add(custom_profile)
    db_session.commit()

    # User authenticates via Google OAuth with completely different full_name and picture
    token = create_test_supabase_jwt(
        sub=user_id,
        email="jayesh.climber@gmail.com",
        user_metadata={
            "full_name": "Jayesh Google Account Name",
            "name": "Jayesh G",
            "picture": "https://lh3.googleusercontent.com/a/google_default_photo.jpg",
            "avatar_url": "https://lh3.googleusercontent.com/a/google_default_photo.jpg",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]

    # Assert API response retains customized values
    assert data["display_name"] == "Kailash Climber"
    assert data["avatar_url"] == "https://cdn.michi.travel/avatars/custom_photo.webp"

    # Assert database record was not altered
    db_record = db_session.query(Profile).filter(Profile.id == user_id).first()
    assert db_record.display_name == "Kailash Climber"
    assert db_record.avatar_url == "https://cdn.michi.travel/avatars/custom_photo.webp"


def test_regression_existing_profile_custom_avatar_retained_when_name_syncs(client, db_session):
    """
    Regression Test:
    When an existing profile holds default "New Traveller" but already has a manually selected avatar,
    the display name synchronizes to Google metadata, but the custom avatar is strictly preserved.
    """
    user_id = "regression-sync-name-preserve-avatar-uuid"
    profile = Profile(
        id=user_id,
        username="jayesh_traveller",
        display_name="New Traveller",
        avatar_url="https://cdn.michi.travel/avatars/user_chosen_avatar.jpg",
    )
    db_session.add(profile)
    db_session.commit()

    token = create_test_supabase_jwt(
        sub=user_id,
        email="jayesh@gmail.com",
        user_metadata={
            "full_name": "Jayesh Sharma",
            "picture": "https://lh3.googleusercontent.com/google_pic.jpg",
        },
        app_metadata={"provider": "google", "providers": ["google"]},
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/profiles/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]

    # Display name synchronized from "New Traveller" -> "Jayesh Sharma"
    assert data["display_name"] == "Jayesh Sharma"
    # Existing avatar preserved
    assert data["avatar_url"] == "https://cdn.michi.travel/avatars/user_chosen_avatar.jpg"
