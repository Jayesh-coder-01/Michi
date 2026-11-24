"""
Pytest Test Suite: Trip CRUD & Lifecycle State Transitions (SQLite Emulated)
Aligned with docs/PHASE3_TEST_PLAN.md TASK-P3-TEST-01 and TASK-P3-TEST-03
"""

import pytest
from datetime import date, timedelta
from app.models.profile import Profile
from app.models.trip import Trip, TripStop
from app.schemas.trip import TripStatus, TripVisibility, TripCategory
from app.utils.security import create_test_supabase_jwt


@pytest.fixture
def user_b_headers(db_session):
    """Fixture returning auth headers for a secondary user (User B / Visitor)."""
    user_b_id = "test-user-uuid-2"
    profile_b = Profile(
        id=user_b_id,
        username="kenji.hikers",
        display_name="Kenji Sato",
        bio="Hiking the Kumano Kodo.",
        location="Kyoto, Japan",
    )
    db_session.add(profile_b)
    db_session.commit()

    token = create_test_supabase_jwt(
        sub=user_b_id,
        email="kenji@michi.travel",
        username="kenji.hikers",
    )
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Trip Creation
# ==============================================================================

def test_create_trip_draft(client, test_profile, auth_headers):
    """Authenticated user creates a new trip, verifying default draft status and owner binding."""
    payload = {
        "title": "Himalayan Ridge Expedition",
        "description": "Crossing the high passes of Ladakh and Zanskar.",
        "starting_location": "Leh, Ladakh",
        "ending_location": "Padum, Zanskar",
        "start_date": "2026-07-01",
        "end_date": "2026-07-15",
        "category": "Trekking",
        "visibility": "private",
    }
    response = client.post("/api/v1/trips", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    trip = data["data"]
    assert trip["title"] == payload["title"]
    assert trip["status"] == "draft"
    assert trip["visibility"] == "private"
    assert trip["owner_id"] == test_profile.id
    assert trip["stops_count"] == 0
    assert trip["stops"] == []


def test_create_trip_unauthenticated(client):
    """Unauthenticated trip creation must return 401 Unauthorized."""
    payload = {
        "title": "Unauthorized Trip",
        "starting_location": "Tokyo",
        "ending_location": "Kyoto",
    }
    response = client.post("/api/v1/trips", json=payload)
    assert response.status_code == 401


# ==============================================================================
# 2. Trip Queries & Privacy Protection
# ==============================================================================

def test_list_my_trips(client, test_profile, auth_headers):
    """List authenticated user's trips, including drafts and archived journeys."""
    for i in range(3):
        client.post(
            "/api/v1/trips",
            json={
                "title": f"Journey {i}",
                "starting_location": "Start",
                "ending_location": "End",
            },
            headers=auth_headers,
        )

    res = client.get("/api/v1/trips", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert data["items"][0]["owner"]["username"] == test_profile.username


def test_get_trip_details_owner(client, test_profile, auth_headers):
    """Owner can retrieve their own private/draft trip."""
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Private Secret Journey",
            "starting_location": "Secret A",
            "ending_location": "Secret B",
            "visibility": "private",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    res = client.get(f"/api/v1/trips/{trip_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["data"]["id"] == trip_id


def test_get_trip_details_visitor_private_forbidden(client, test_profile, auth_headers, user_b_headers):
    """Non-owner visitor is rejected with 403 when trying to access a private trip."""
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Private Diary",
            "starting_location": "Origin",
            "ending_location": "Destination",
            "visibility": "private",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    # Visitor attempt
    res = client.get(f"/api/v1/trips/{trip_id}", headers=user_b_headers)
    assert res.status_code == 403
    assert "private" in res.json()["error"]["message"]


def test_get_trip_details_visitor_draft_forbidden(client, test_profile, auth_headers, user_b_headers):
    """Non-owner visitor is rejected with 403 when trying to access a draft trip (even if public visibility)."""
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Draft in Progress",
            "starting_location": "Origin",
            "ending_location": "Destination",
            "visibility": "public",  # Public visibility but still in draft status
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    res = client.get(f"/api/v1/trips/{trip_id}", headers=user_b_headers)
    assert res.status_code == 403


# ==============================================================================
# 3. Trip Updates & Status Protection (No Status in PATCH)
# ==============================================================================

def test_update_trip_metadata(client, test_profile, auth_headers):
    """Owner updates trip title, locations, dates, and category."""
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Initial Title",
            "starting_location": "Tokyo",
            "ending_location": "Osaka",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    patch_payload = {
        "title": "Tokaido Route Road Trip",
        "category": "Road trip",
        "start_date": "2026-08-01",
        "end_date": "2026-08-10",
    }
    patch_res = client.patch(f"/api/v1/trips/{trip_id}", json=patch_payload, headers=auth_headers)
    assert patch_res.status_code == 200
    updated = patch_res.json()["data"]
    assert updated["title"] == "Tokaido Route Road Trip"
    assert updated["category"] == "Road trip"


def test_update_trip_status_rejected_in_patch(client, test_profile, auth_headers):
    """
    Submitting 'status' in PATCH payload must be strictly rejected with HTTP 422
    due to extra='forbid' on TripUpdate schema, preserving lifecycle integrity.
    """
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Strict Lifecycle Trip",
            "starting_location": "Start",
            "ending_location": "End",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    # Attempt to bypass lifecycle by injecting status
    patch_res = client.patch(
        f"/api/v1/trips/{trip_id}",
        json={"status": "published"},
        headers=auth_headers,
    )
    assert patch_res.status_code == 422
    assert "extra" in str(patch_res.json()).lower() or "validation" in str(patch_res.json()).lower()


def test_update_trip_non_owner_forbidden(client, test_profile, auth_headers, user_b_headers):
    """User B cannot mutate User A's trip."""
    create_res = client.post(
        "/api/v1/trips",
        json={"title": "Aarav's Trip", "starting_location": "Origin A", "ending_location": "Destination B"},
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    res = client.patch(
        f"/api/v1/trips/{trip_id}",
        json={"title": "Hacked Title"},
        headers=user_b_headers,
    )
    assert res.status_code == 403


# ==============================================================================
# 4. Deletion
# ==============================================================================

def test_delete_trip_owner(client, test_profile, auth_headers):
    """Owner permanently deletes trip."""
    create_res = client.post(
        "/api/v1/trips",
        json={"title": "Temporary Journey", "starting_location": "Origin A", "ending_location": "Destination B"},
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    del_res = client.delete(f"/api/v1/trips/{trip_id}", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["data"]["deleted"] is True

    # Confirm 404
    get_res = client.get(f"/api/v1/trips/{trip_id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_delete_trip_non_owner_forbidden(client, test_profile, auth_headers, user_b_headers):
    """User B cannot delete User A's trip."""
    create_res = client.post(
        "/api/v1/trips",
        json={"title": "Aarav's Trip", "starting_location": "Origin A", "ending_location": "Destination B"},
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    del_res = client.delete(f"/api/v1/trips/{trip_id}", headers=user_b_headers)
    assert del_res.status_code == 403


# ==============================================================================
# 5. Lifecycle State Transitions (Publish, Archive, Restore, Unpublish)
# ==============================================================================

def test_publish_trip_checklist_enforcement(client, test_profile, auth_headers):
    """Publishing enforces mandatory checklist: title, category, locations, dates."""
    # 1. Incomplete trip missing dates
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Incomplete Expedition",
            "starting_location": "Leh",
            "ending_location": "Manali",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    # Publish attempt fails due to missing dates
    pub_res = client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers)
    assert pub_res.status_code == 422
    assert "checklist" in str(pub_res.json()).lower()

    # 2. Populate dates and publish
    client.patch(
        f"/api/v1/trips/{trip_id}",
        json={"start_date": "2026-09-01", "end_date": "2026-09-10"},
        headers=auth_headers,
    )

    pub_res_ok = client.post(
        f"/api/v1/trips/{trip_id}/publish",
        json={"visibility": "public"},
        headers=auth_headers,
    )
    assert pub_res_ok.status_code == 200
    pub_data = pub_res_ok.json()["data"]
    assert pub_data["status"] == "published"
    assert pub_data["visibility"] == "public"


def test_publish_trip_zero_stops_allowed(client, test_profile, auth_headers):
    """PRD Truth Audit: Trips with 0 stops (point-to-point journeys) are valid to publish."""
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Direct Highway Sprint",
            "starting_location": "Delhi",
            "ending_location": "Agra",
            "start_date": "2026-10-01",
            "end_date": "2026-10-02",
            "category": "Road trip",
            "visibility": "public",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    pub_res = client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["data"]["status"] == "published"


def test_archive_restore_and_unpublish_transitions(client, test_profile, auth_headers):
    """Verify published -> archived -> restored -> unpublished lifecycle cycle."""
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Lifecycle Journey",
            "starting_location": "Kochi",
            "ending_location": "Munnar",
            "start_date": "2026-11-01",
            "end_date": "2026-11-05",
            "category": "Adventure",
            "visibility": "public",
        },
        headers=auth_headers,
    )
    trip_id = create_res.json()["data"]["id"]

    # 1. Publish
    client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers)

    # 2. Archive
    arch_res = client.post(f"/api/v1/trips/{trip_id}/archive", headers=auth_headers)
    assert arch_res.status_code == 200
    assert arch_res.json()["data"]["status"] == "archived"

    # Cannot archive an already archived trip
    arch_again = client.post(f"/api/v1/trips/{trip_id}/archive", headers=auth_headers)
    assert arch_again.status_code == 422

    # 3. Restore
    res_res = client.post(f"/api/v1/trips/{trip_id}/restore", headers=auth_headers)
    assert res_res.status_code == 200
    assert res_res.json()["data"]["status"] == "published"

    # 4. Unpublish back to draft
    unpub_res = client.post(f"/api/v1/trips/{trip_id}/unpublish", headers=auth_headers)
    assert unpub_res.status_code == 200
    assert unpub_res.json()["data"]["status"] == "draft"

    # Cannot unpublish an already draft trip
    unpub_again = client.post(f"/api/v1/trips/{trip_id}/unpublish", headers=auth_headers)
    assert unpub_again.status_code == 422


def test_community_public_trips_feed(client, test_profile, auth_headers):
    """Community public feed returns only published public journeys, omitting drafts and private trips."""
    # Create private draft
    client.post(
        "/api/v1/trips",
        json={"title": "Private Draft", "starting_location": "Origin A", "ending_location": "Destination B"},
        headers=auth_headers,
    )
    # Create public published trip
    pub_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Public Published Wonder",
            "starting_location": "Kyoto",
            "ending_location": "Nara",
            "start_date": "2026-12-01",
            "end_date": "2026-12-05",
            "visibility": "public",
        },
        headers=auth_headers,
    )
    trip_id = pub_res.json()["data"]["id"]
    client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers)

    # Public endpoint without auth
    feed_res = client.get("/api/v1/trips/public")
    assert feed_res.status_code == 200
    data = feed_res.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Public Published Wonder"
