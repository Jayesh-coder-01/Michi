"""
Pytest Test Suite: Trip Stops CRUD & Atomic Reordering (SQLite Emulated)
Aligned with docs/PHASE3_TEST_PLAN.md TASK-P3-TEST-02 and TASK-P3-TEST-03
"""

import pytest
import uuid
from app.models.profile import Profile
from app.models.trip import Trip, TripStop
from app.utils.security import create_test_supabase_jwt


@pytest.fixture
def user_b_headers(db_session):
    """Fixture returning auth headers for a secondary user (User B)."""
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


@pytest.fixture
def sample_trip(client, test_profile, auth_headers):
    """Fixture creating a draft trip owned by test-user-uuid-1."""
    res = client.post(
        "/api/v1/trips",
        json={
            "title": "Kumano Kodo Pilgrimage",
            "starting_location": "Tanabe",
            "ending_location": "Nachi Falls",
            "start_date": "2026-05-01",
            "end_date": "2026-05-06",
            "category": "Trekking",
            "visibility": "private",
        },
        headers=auth_headers,
    )
    return res.json()["data"]


# ==============================================================================
# 1. Stop Creation & Sequential Indexing
# ==============================================================================

def test_add_stops_sequential_indexing(client, auth_headers, sample_trip):
    """Verify stops receive sequential order_index 0, 1, 2 on successive additions."""
    trip_id = sample_trip["id"]

    stop_1_res = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "Takahara Village",
            "location": "Nakahechi Trail, Wakayama",
            "latitude": 33.7833,
            "longitude": 135.5333,
            "arrival_date": "2026-05-01",
            "departure_date": "2026-05-02",
        },
        headers=auth_headers,
    )
    assert stop_1_res.status_code == 201
    assert stop_1_res.json()["data"]["order_index"] == 0

    stop_2_res = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "Tsugizakura-oji",
            "location": "Nonaka, Wakayama",
            "latitude": 33.8167,
            "longitude": 135.6167,
            "arrival_date": "2026-05-02",
            "departure_date": "2026-05-03",
        },
        headers=auth_headers,
    )
    assert stop_2_res.status_code == 201
    assert stop_2_res.json()["data"]["order_index"] == 1

    stop_3_res = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "Kumano Hongu Taisha",
            "location": "Hongu, Wakayama",
            "latitude": 33.8406,
            "longitude": 135.7739,
            "arrival_date": "2026-05-03",
            "departure_date": "2026-05-04",
        },
        headers=auth_headers,
    )
    assert stop_3_res.status_code == 201
    assert stop_3_res.json()["data"]["order_index"] == 2


def test_add_stop_non_owner_forbidden(client, user_b_headers, sample_trip):
    """User B cannot add stops to User A's trip."""
    trip_id = sample_trip["id"]
    res = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "Intruder Stop",
            "location": "Unknown",
            "latitude": 35.0,
            "longitude": 135.0,
        },
        headers=user_b_headers,
    )
    assert res.status_code == 403


def test_add_stop_invalid_coordinates(client, auth_headers, sample_trip):
    """Coordinates outside WGS84 range are rejected with 422."""
    trip_id = sample_trip["id"]

    # Latitude > 90
    res_lat = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "North Pole Beyond",
            "location": "Space",
            "latitude": 91.5,
            "longitude": 0.0,
        },
        headers=auth_headers,
    )
    assert res_lat.status_code == 422

    # Longitude < -180
    res_lng = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "West Beyond",
            "location": "Space",
            "latitude": 0.0,
            "longitude": -181.0,
        },
        headers=auth_headers,
    )
    assert res_lng.status_code == 422


def test_add_stop_invalid_dates(client, auth_headers, sample_trip):
    """departure_date < arrival_date is rejected with 422."""
    trip_id = sample_trip["id"]
    res = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "Time Travel Lodge",
            "location": "Wakayama",
            "latitude": 33.7,
            "longitude": 135.5,
            "arrival_date": "2026-05-10",
            "departure_date": "2026-05-08",
        },
        headers=auth_headers,
    )
    assert res.status_code == 422


# ==============================================================================
# 2. Stop Update & Foreign ID Rejection
# ==============================================================================

def test_update_stop_details(client, auth_headers, sample_trip):
    """Owner updates stop information."""
    trip_id = sample_trip["id"]
    create_res = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={
            "stop_name": "Initial Stop",
            "location": "Location A",
            "latitude": 33.7,
            "longitude": 135.5,
        },
        headers=auth_headers,
    )
    stop_id = create_res.json()["data"]["id"]

    update_res = client.patch(
        f"/api/v1/trips/{trip_id}/stops/{stop_id}",
        json={
            "stop_name": "Kawayu Onsen Ryokan",
            "accommodation_details": "Riverbed natural hot spring bath.",
            "notes": "Bring flashlight for night soak.",
        },
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    data = update_res.json()["data"]
    assert data["stop_name"] == "Kawayu Onsen Ryokan"
    assert data["accommodation_details"] == "Riverbed natural hot spring bath."


def test_update_stop_rejects_foreign_stop_id(client, auth_headers, user_b_headers, sample_trip):
    """Updating a stop with a mismatched trip_id returns 404."""
    trip_a_id = sample_trip["id"]

    # Create trip B owned by User B
    trip_b_res = client.post(
        "/api/v1/trips",
        json={"title": "Trip B", "starting_location": "Loc X", "ending_location": "Loc Y"},
        headers=user_b_headers,
    )
    trip_b_id = trip_b_res.json()["data"]["id"]

    # Add stop to Trip B
    stop_b_res = client.post(
        f"/api/v1/trips/{trip_b_id}/stops",
        json={"stop_name": "Stop in Trip B", "location": "Loc B", "latitude": 35.0, "longitude": 135.0},
        headers=user_b_headers,
    )
    stop_b_id = stop_b_res.json()["data"]["id"]

    # User A tries to target Stop B using Trip A's URL
    res = client.patch(
        f"/api/v1/trips/{trip_a_id}/stops/{stop_b_id}",
        json={"stop_name": "Cross-trip Hijack"},
        headers=auth_headers,
    )
    assert res.status_code == 404


# ==============================================================================
# 3. Stop Deletion & Sequence Normalization
# ==============================================================================

def test_delete_stop_normalizes_sequence(client, auth_headers, sample_trip):
    """
    When stop at index 1 is deleted from [0, 1, 2], the stop at index 2
    is normalized to index 1 in the same transaction.
    """
    trip_id = sample_trip["id"]
    stops = []
    for i in range(3):
        res = client.post(
            f"/api/v1/trips/{trip_id}/stops",
            json={"stop_name": f"Stop {i}", "location": f"Loc {i}", "latitude": 33.0 + i, "longitude": 135.0},
            headers=auth_headers,
        )
        stops.append(res.json()["data"])

    # Delete stop at index 1
    del_res = client.delete(f"/api/v1/trips/{trip_id}/stops/{stops[1]['id']}", headers=auth_headers)
    assert del_res.status_code == 200

    # Verify remaining stops
    list_res = client.get(f"/api/v1/trips/{trip_id}/stops", headers=auth_headers)
    remaining = list_res.json()["data"]
    assert len(remaining) == 2
    assert remaining[0]["id"] == stops[0]["id"]
    assert remaining[0]["order_index"] == 0
    assert remaining[1]["id"] == stops[2]["id"]
    assert remaining[1]["order_index"] == 1


# ==============================================================================
# 4. Batch Reordering (Two-Phase Positive Disjoint Offset Algorithm)
# ==============================================================================

def test_batch_reorder_stops_success(client, auth_headers, sample_trip):
    """
    Reorder stops [A(0), B(1), C(2)] to [C(0), A(1), B(2)].
    Verifies collision-free re-indexing and pristine non-negative compliance.
    """
    trip_id = sample_trip["id"]
    stops = []
    for name in ["Stop A", "Stop B", "Stop C"]:
        res = client.post(
            f"/api/v1/trips/{trip_id}/stops",
            json={"stop_name": name, "location": f"Loc {name}", "latitude": 33.0, "longitude": 135.0},
            headers=auth_headers,
        )
        stops.append(res.json()["data"])

    # Reorder sequence: C, A, B
    new_order_ids = [stops[2]["id"], stops[0]["id"], stops[1]["id"]]
    reorder_res = client.put(
        f"/api/v1/trips/{trip_id}/stops/reorder",
        json={"ordered_stop_ids": new_order_ids},
        headers=auth_headers,
    )
    assert reorder_res.status_code == 200
    reordered = reorder_res.json()["data"]
    assert len(reordered) == 3
    assert reordered[0]["id"] == stops[2]["id"]
    assert reordered[0]["order_index"] == 0
    assert reordered[1]["id"] == stops[0]["id"]
    assert reordered[1]["order_index"] == 1
    assert reordered[2]["id"] == stops[1]["id"]
    assert reordered[2]["order_index"] == 2


def test_batch_reorder_rejects_duplicates(client, auth_headers, sample_trip):
    """Submitting duplicate stop IDs must return 422."""
    trip_id = sample_trip["id"]
    stop = client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={"stop_name": "Solo Stop", "location": "Loc", "latitude": 33.0, "longitude": 135.0},
        headers=auth_headers,
    ).json()["data"]

    dup_payload = {"ordered_stop_ids": [stop["id"], stop["id"]]}
    res = client.put(
        f"/api/v1/trips/{trip_id}/stops/reorder",
        json=dup_payload,
        headers=auth_headers,
    )
    assert res.status_code == 422
    assert "duplicate" in str(res.json()).lower()


def test_batch_reorder_rejects_missing_stops(client, auth_headers, sample_trip):
    """Omitting an existing stop from the reorder payload returns 422."""
    trip_id = sample_trip["id"]
    stops = []
    for i in range(2):
        res = client.post(
            f"/api/v1/trips/{trip_id}/stops",
            json={"stop_name": f"Stop {i}", "location": f"Loc {i}", "latitude": 33.0, "longitude": 135.0},
            headers=auth_headers,
        )
        stops.append(res.json()["data"])

    # Omit stop 1
    incomplete_payload = {"ordered_stop_ids": [stops[0]["id"]]}
    res = client.put(
        f"/api/v1/trips/{trip_id}/stops/reorder",
        json=incomplete_payload,
        headers=auth_headers,
    )
    assert res.status_code == 422
    assert "incomplete" in str(res.json()).lower() or "omit" in str(res.json()).lower()


def test_batch_reorder_rejects_foreign_stops(client, auth_headers, user_b_headers, sample_trip):
    """Submitting a stop belonging to a different trip returns 422."""
    trip_a_id = sample_trip["id"]
    stop_a = client.post(
        f"/api/v1/trips/{trip_a_id}/stops",
        json={"stop_name": "Stop A", "location": "Loc A", "latitude": 33.0, "longitude": 135.0},
        headers=auth_headers,
    ).json()["data"]

    # Create Trip B and Stop B
    trip_b = client.post(
        "/api/v1/trips",
        json={"title": "Trip B", "starting_location": "Loc X", "ending_location": "Loc Y"},
        headers=user_b_headers,
    ).json()["data"]
    stop_b = client.post(
        f"/api/v1/trips/{trip_b['id']}/stops",
        json={"stop_name": "Stop B", "location": "Loc B", "latitude": 35.0, "longitude": 135.0},
        headers=user_b_headers,
    ).json()["data"]

    # Reorder Trip A using Stop B
    res = client.put(
        f"/api/v1/trips/{trip_a_id}/stops/reorder",
        json={"ordered_stop_ids": [stop_b["id"]]},
        headers=auth_headers,
    )
    assert res.status_code == 422
    assert "foreign" in str(res.json()).lower()


def test_batch_reorder_empty_stop_list_handling(client, auth_headers, sample_trip):
    """
    Reordering an empty trip with [] succeeds as an idempotent no-op (200 OK -> []).
    Reordering a non-empty trip with [] is rejected (422 INCOMPLETE_STOP_SEQUENCE).
    """
    trip_id = sample_trip["id"]

    # 1. Trip currently has 0 stops -> submitting [] returns 200 OK with []
    empty_res = client.put(
        f"/api/v1/trips/{trip_id}/stops/reorder",
        json={"ordered_stop_ids": []},
        headers=auth_headers,
    )
    assert empty_res.status_code == 200
    assert empty_res.json()["data"] == []

    # 2. Add 1 stop to trip
    client.post(
        f"/api/v1/trips/{trip_id}/stops",
        json={"stop_name": "Stop 1", "location": "Loc 1", "latitude": 33.0, "longitude": 135.0},
        headers=auth_headers,
    )

    # 3. Non-empty trip submitted with [] is rejected
    non_empty_res = client.put(
        f"/api/v1/trips/{trip_id}/stops/reorder",
        json={"ordered_stop_ids": []},
        headers=auth_headers,
    )
    assert non_empty_res.status_code == 422


def test_batch_reorder_overflow_guard(client, auth_headers, sample_trip, db_session):
    """
    If existing order_index exceeds 1,000,000,000, reorder aborts with 422
    before database mutations occur.
    """
    trip_id = sample_trip["id"]

    # Insert a stop with order_index > 1,000,000,000 directly
    huge_stop = TripStop(
        trip_id=trip_id,
        stop_name="Far Future Stop",
        location="Milky Way",
        latitude=0.0,
        longitude=0.0,
        order_index=1_000_000_001,
    )
    db_session.add(huge_stop)
    db_session.commit()

    res = client.put(
        f"/api/v1/trips/{trip_id}/stops/reorder",
        json={"ordered_stop_ids": [str(huge_stop.id)]},
        headers=auth_headers,
    )
    assert res.status_code == 422
    assert "safe" in str(res.json()).lower() or "threshold" in str(res.json()).lower()
