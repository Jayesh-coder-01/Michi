"""
Unit & Integration Tests for Trip Stop Engine & Atomic Batch Reorder
Aligned with docs/PHASE3_API_DESIGN.md and docs/PHASE3_TEST_PLAN.md
"""

import uuid
import pytest
from fastapi import status
from app.models.profile import Profile
from app.utils.security import create_test_supabase_jwt

USER_1_ID = "00000000-0000-0000-0000-000000000001"
USER_2_ID = "00000000-0000-0000-0000-000000000002"


@pytest.fixture
def test_setup(db_session):
    p1 = Profile(
        id=USER_1_ID,
        username="kenji_travels",
        display_name="Kenji Sato",
    )
    p2 = Profile(
        id=USER_2_ID,
        username="maya_wanderer",
        display_name="Maya Lin",
    )
    db_session.add_all([p1, p2])
    db_session.commit()


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


@pytest.fixture
def sample_trip_id(client, test_setup, auth_headers_user1):
    payload = {
        "title": "Nakasendo Waypoint Expedition",
        "starting_location": "Nihonbashi",
        "ending_location": "Kyoto",
        "category": "Trekking",
    }
    res = client.post("/api/v1/trips", json=payload, headers=auth_headers_user1)
    return res.json()["data"]["id"]


def test_add_stops_sequential_indexing(client, sample_trip_id, auth_headers_user1):
    stops = [
        {"stop_name": "Magome-juku", "location": "Kiso Valley, Gifu", "latitude": 35.5269, "longitude": 137.5667},
        {"stop_name": "Tsumago-juku", "location": "Nagano", "latitude": 35.5767, "longitude": 137.5947},
        {"stop_name": "Narai-juku", "location": "Shiojiri, Nagano", "latitude": 35.9669, "longitude": 137.8144},
    ]

    stop_ids = []
    for idx, s in enumerate(stops):
        res = client.post(f"/api/v1/trips/{sample_trip_id}/stops", json=s, headers=auth_headers_user1)
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert data["order_index"] == idx
        assert data["stop_name"] == s["stop_name"]
        stop_ids.append(data["id"])

    # Verify listing stops
    list_res = client.get(f"/api/v1/trips/{sample_trip_id}/stops", headers=auth_headers_user1)
    assert list_res.status_code == status.HTTP_200_OK
    items = list_res.json()["data"]
    assert len(items) == 3
    assert [item["order_index"] for item in items] == [0, 1, 2]


def test_stop_coordinate_validation(client, sample_trip_id, auth_headers_user1):
    # Invalid latitude (> 90)
    invalid_lat = {
        "stop_name": "Impossible North Pole",
        "location": "Deep Space",
        "latitude": 95.0,
        "longitude": 100.0,
    }
    res = client.post(f"/api/v1/trips/{sample_trip_id}/stops", json=invalid_lat, headers=auth_headers_user1)
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Invalid longitude (< -180)
    invalid_lng = {
        "stop_name": "Impossible West",
        "location": "Void",
        "latitude": 10.0,
        "longitude": -195.0,
    }
    res = client.post(f"/api/v1/trips/{sample_trip_id}/stops", json=invalid_lng, headers=auth_headers_user1)
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_stop_details(client, sample_trip_id, auth_headers_user1):
    stop_data = {
        "stop_name": "Kiso-Fukushima",
        "location": "Nagano",
        "latitude": 35.8456,
        "longitude": 137.6978,
    }
    create_res = client.post(f"/api/v1/trips/{sample_trip_id}/stops", json=stop_data, headers=auth_headers_user1)
    stop_id = create_res.json()["data"]["id"]

    patch_payload = {
        "accommodation_details": "Ryokan Tsutaya Tokinoyado",
        "notes": "Enjoyed local soba and natural hot spring onsen.",
    }
    patch_res = client.patch(
        f"/api/v1/trips/{sample_trip_id}/stops/{stop_id}",
        json=patch_payload,
        headers=auth_headers_user1,
    )
    assert patch_res.status_code == status.HTTP_200_OK
    updated = patch_res.json()["data"]
    assert updated["accommodation_details"] == patch_payload["accommodation_details"]
    assert updated["notes"] == patch_payload["notes"]


def test_delete_stop_reindexes_remaining(client, sample_trip_id, auth_headers_user1):
    # Create 3 stops
    created_ids = []
    for i in range(3):
        res = client.post(
            f"/api/v1/trips/{sample_trip_id}/stops",
            json={"stop_name": f"Stop {i}", "location": f"Loc {i}", "latitude": 35.0 + i, "longitude": 137.0 + i},
            headers=auth_headers_user1,
        )
        created_ids.append(res.json()["data"]["id"])

    # Delete the middle stop (index 1)
    del_res = client.delete(
        f"/api/v1/trips/{sample_trip_id}/stops/{created_ids[1]}",
        headers=auth_headers_user1,
    )
    assert del_res.status_code == status.HTTP_200_OK

    # Remaining stops should be re-indexed to 0 and 1
    list_res = client.get(f"/api/v1/trips/{sample_trip_id}/stops", headers=auth_headers_user1)
    items = list_res.json()["data"]
    assert len(items) == 2
    assert items[0]["id"] == created_ids[0]
    assert items[0]["order_index"] == 0
    assert items[1]["id"] == created_ids[2]
    assert items[1]["order_index"] == 1


def test_batch_reorder_atomic_success(client, sample_trip_id, auth_headers_user1):
    stop_ids = []
    for name in ["Stop A", "Stop B", "Stop C", "Stop D"]:
        res = client.post(
            f"/api/v1/trips/{sample_trip_id}/stops",
            json={"stop_name": name, "location": "Japan", "latitude": 35.0, "longitude": 137.0},
            headers=auth_headers_user1,
        )
        stop_ids.append(res.json()["data"]["id"])

    # Invert the order: D, C, B, A
    new_order = list(reversed(stop_ids))
    reorder_res = client.put(
        f"/api/v1/trips/{sample_trip_id}/stops/reorder",
        json={"ordered_stop_ids": new_order},
        headers=auth_headers_user1,
    )
    assert reorder_res.status_code == status.HTTP_200_OK
    reordered_items = reorder_res.json()["data"]
    assert [item["id"] for item in reordered_items] == new_order
    assert [item["order_index"] for item in reordered_items] == [0, 1, 2, 3]


def test_batch_reorder_duplicate_ids_rejected(client, sample_trip_id, auth_headers_user1):
    res1 = client.post(
        f"/api/v1/trips/{sample_trip_id}/stops",
        json={"stop_name": "Stop 1", "location": "Loc 1", "latitude": 35.0, "longitude": 137.0},
        headers=auth_headers_user1,
    )
    id1 = res1.json()["data"]["id"]

    # Duplicate IDs
    reorder_res = client.put(
        f"/api/v1/trips/{sample_trip_id}/stops/reorder",
        json={"ordered_stop_ids": [id1, id1]},
        headers=auth_headers_user1,
    )
    assert reorder_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_unauthorized_user_cannot_modify_stops(client, sample_trip_id, auth_headers_user1, auth_headers_user2):
    res = client.post(
        f"/api/v1/trips/{sample_trip_id}/stops",
        json={"stop_name": "Stop 1", "location": "Loc 1", "latitude": 35.0, "longitude": 137.0},
        headers=auth_headers_user1,
    )
    stop_id = res.json()["data"]["id"]

    # User 2 tries to modify User 1's stop
    patch_res = client.patch(
        f"/api/v1/trips/{sample_trip_id}/stops/{stop_id}",
        json={"stop_name": "Hacked Stop"},
        headers=auth_headers_user2,
    )
    assert patch_res.status_code == status.HTTP_403_FORBIDDEN
