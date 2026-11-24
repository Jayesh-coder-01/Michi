"""
Unit & Integration Tests for Trip Management & Lifecycle Operations
Aligned with docs/PHASE3_API_DESIGN.md and docs/PHASE3_TEST_PLAN.md
"""

import uuid
import pytest
from datetime import date, timedelta
from fastapi import status
from app.models.profile import Profile
from app.models.trip import Trip, TripStop
from app.utils.security import create_test_supabase_jwt

USER_1_ID = "00000000-0000-0000-0000-000000000001"
USER_2_ID = "00000000-0000-0000-0000-000000000002"


@pytest.fixture
def profile_user1(db_session):
    profile = Profile(
        id=USER_1_ID,
        username="kenji_travels",
        display_name="Kenji Sato",
        bio="Alpine climbing in Nagano & Hokkaido.",
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)
    return profile


@pytest.fixture
def profile_user2(db_session):
    profile = Profile(
        id=USER_2_ID,
        username="maya_wanderer",
        display_name="Maya Lin",
        bio="Cycling coastal highways.",
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)
    return profile


@pytest.fixture
def auth_headers_user1():
    token = create_test_supabase_jwt(
        sub=USER_1_ID,
        email="kenji@michi.travel",
        username="kenji_travels",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_user2():
    token = create_test_supabase_jwt(
        sub=USER_2_ID,
        email="maya@michi.travel",
        username="maya_wanderer",
    )
    return {"Authorization": f"Bearer {token}"}


def test_create_trip_defaults_and_draft(client, profile_user1, auth_headers_user1):
    payload = {
        "title": "Tokyo to Kyoto Nakasendo Trail",
        "description": "Historic walking journey along post towns.",
        "starting_location": "Nihonbashi, Tokyo",
        "ending_location": "Sanjo Ohashi, Kyoto",
        "start_date": "2026-10-01",
        "end_date": "2026-10-15",
        "category": "Trekking",
    }
    response = client.post("/api/v1/trips", json=payload, headers=auth_headers_user1)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["success"] is True
    trip = data["data"]
    assert trip["title"] == payload["title"]
    assert trip["status"] == "draft"
    assert trip["visibility"] == "private"  # Privacy by default
    assert trip["category"] == "Trekking"
    assert trip["stops_count"] == 0
    assert trip["owner"]["username"] == "kenji_travels"


def test_create_trip_date_validation_failure(client, profile_user1, auth_headers_user1):
    payload = {
        "title": "Invalid Chronology Trip",
        "starting_location": "Tokyo",
        "ending_location": "Osaka",
        "start_date": "2026-10-15",
        "end_date": "2026-10-01",  # Invalid: end < start
        "category": "Road trip",
    }
    response = client.post("/api/v1/trips", json=payload, headers=auth_headers_user1)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_trip_cannot_modify_status(client, profile_user1, auth_headers_user1):
    create_payload = {
        "title": "Hokkaido Road Odyssey",
        "starting_location": "Sapporo",
        "ending_location": "Shiretoko",
        "category": "Road trip",
    }
    create_res = client.post("/api/v1/trips", json=create_payload, headers=auth_headers_user1)
    trip_id = create_res.json()["data"]["id"]

    # Attempt to bypass lifecycle by sending status in PATCH
    update_payload = {
        "title": "Hokkaido Road Odyssey (Summer Edition)",
        "status": "published",
    }
    update_res = client.patch(f"/api/v1/trips/{trip_id}", json=update_payload, headers=auth_headers_user1)
    assert update_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY  # extra='forbid' rejects status


def test_publish_trip_point_to_point_success(client, profile_user1, auth_headers_user1):
    create_payload = {
        "title": "Mount Fuji Summit Direct",
        "starting_location": "Subashiri 5th Station",
        "ending_location": "Fuji Kengamine Peak",
        "start_date": "2026-08-01",
        "end_date": "2026-08-03",
        "category": "Trekking",
        "visibility": "public",
    }
    res = client.post("/api/v1/trips", json=create_payload, headers=auth_headers_user1)
    trip_id = res.json()["data"]["id"]

    # Publish point-to-point (0 stops is valid per PRD Module 3)
    pub_res = client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers_user1)
    assert pub_res.status_code == status.HTTP_200_OK
    assert pub_res.json()["data"]["status"] == "published"


def test_publish_trip_missing_checklist_fails(client, profile_user1, auth_headers_user1):
    # Missing dates
    create_payload = {
        "title": "Incomplete Planning Trip",
        "starting_location": "Tokyo",
        "ending_location": "Yokohama",
        "category": "Solo travel",
    }
    res = client.post("/api/v1/trips", json=create_payload, headers=auth_headers_user1)
    trip_id = res.json()["data"]["id"]

    pub_res = client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers_user1)
    assert pub_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = pub_res.json()
    assert "Start date is required" in str(data)


def test_lifecycle_state_machine_transitions(client, profile_user1, auth_headers_user1):
    create_payload = {
        "title": "Kumano Kodo Pilgrimage",
        "starting_location": "Tanabe",
        "ending_location": "Nachi Falls",
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "category": "Trekking",
        "visibility": "public",
    }
    res = client.post("/api/v1/trips", json=create_payload, headers=auth_headers_user1)
    trip_id = res.json()["data"]["id"]

    # 1. draft -> cannot archive directly
    arch_res = client.post(f"/api/v1/trips/{trip_id}/archive", headers=auth_headers_user1)
    assert arch_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 2. draft -> publish
    pub_res = client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers_user1)
    assert pub_res.status_code == status.HTTP_200_OK
    assert pub_res.json()["data"]["status"] == "published"

    # 3. published -> unpublish (back to draft)
    unpub_res = client.post(f"/api/v1/trips/{trip_id}/unpublish", headers=auth_headers_user1)
    assert unpub_res.status_code == status.HTTP_200_OK
    assert unpub_res.json()["data"]["status"] == "draft"

    # 4. publish again -> archive
    client.post(f"/api/v1/trips/{trip_id}/publish", headers=auth_headers_user1)
    archive_res = client.post(f"/api/v1/trips/{trip_id}/archive", headers=auth_headers_user1)
    assert archive_res.status_code == status.HTTP_200_OK
    assert archive_res.json()["data"]["status"] == "archived"

    # 5. archived -> restore (back to published)
    restore_res = client.post(f"/api/v1/trips/{trip_id}/restore", headers=auth_headers_user1)
    assert restore_res.status_code == status.HTTP_200_OK
    assert restore_res.json()["data"]["status"] == "published"


def test_trip_details_access_control(client, profile_user1, profile_user2, auth_headers_user1, auth_headers_user2):
    # User 1 creates a private draft
    create_payload = {
        "title": "Secret Solo Alpine Route",
        "starting_location": "Kamikochi",
        "ending_location": "Yari-ga-take",
        "category": "Adventure",
        "visibility": "private",
    }
    res = client.post("/api/v1/trips", json=create_payload, headers=auth_headers_user1)
    trip_id = res.json()["data"]["id"]

    # Owner can view private draft
    owner_view = client.get(f"/api/v1/trips/{trip_id}", headers=auth_headers_user1)
    assert owner_view.status_code == status.HTTP_200_OK

    # Anonymous visitor cannot view private draft
    anon_view = client.get(f"/api/v1/trips/{trip_id}")
    assert anon_view.status_code == status.HTTP_403_FORBIDDEN

    # Another user cannot view private draft
    other_user_view = client.get(f"/api/v1/trips/{trip_id}", headers=auth_headers_user2)
    assert other_user_view.status_code == status.HTTP_403_FORBIDDEN


def test_delete_trip_cascades(client, profile_user1, auth_headers_user1, db_session):
    create_payload = {
        "title": "Trip to Delete",
        "starting_location": "Origin Town",
        "ending_location": "Destination City",
        "category": "Other",
    }
    res = client.post("/api/v1/trips", json=create_payload, headers=auth_headers_user1)
    trip_id = res.json()["data"]["id"]

    del_res = client.delete(f"/api/v1/trips/{trip_id}", headers=auth_headers_user1)
    assert del_res.status_code == status.HTTP_200_OK
    assert del_res.json()["data"]["deleted"] is True

    # Confirm deletion
    get_res = client.get(f"/api/v1/trips/{trip_id}", headers=auth_headers_user1)
    assert get_res.status_code == status.HTTP_404_NOT_FOUND
