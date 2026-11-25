"""
Unit and Integration Tests for Trip Maps & Route Planning (Phase 4)
Tests geodesic route calculations, leg metrics, multi-stop ordering,
missing coordinates handling, and private/public authorization enforcement.
"""

import json
import pytest
from app.models.profile import Profile
from app.models.trip import Trip, TripStop
from app.services.trip_service import haversine_distance_km, TripService
from app.utils.security import create_test_supabase_jwt

USER_1_ID = "00000000-0000-0000-0000-000000000001"
USER_2_ID = "00000000-0000-0000-0000-000000000002"

MOCK_GEOCODE_DB = {
    "Tokyo": {"lat": 35.67686, "lng": 139.76389, "formatted": "Tokyo, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Kyoto": {"lat": 35.0116, "lng": 135.7681, "formatted": "Kyoto, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Tokyo Station": {"lat": 35.6812, "lng": 139.7671, "formatted": "Tokyo Station, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Osaka Castle": {"lat": 34.6873, "lng": 135.5262, "formatted": "Osaka Castle, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Hakone": {"lat": 35.2324, "lng": 139.1070, "formatted": "Hakone, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Kanazawa": {"lat": 36.5613, "lng": 136.6562, "formatted": "Kanazawa, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Leh": {"lat": 34.1642029, "lng": 77.5848133, "formatted": "Leh, Ladakh, India", "country": "India", "country_code": "in", "state": "Ladakh"},
    "Manali": {"lat": 32.2454608, "lng": 77.1872926, "formatted": "Manali, HP, India", "country": "India", "country_code": "in", "state": "Himachal Pradesh"},
    "Yokohama": {"lat": 35.4437, "lng": 139.6380, "formatted": "Yokohama, Japan", "country": "Japan", "country_code": "jp", "state": None},
    "Nikko": {"lat": 36.7199, "lng": 139.6982, "formatted": "Nikko, Japan", "country": "Japan", "country_code": "jp", "state": None},
}


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


def test_haversine_formula_accuracy():
    """Verify that Haversine calculation matches known great-circle distances."""
    # Tokyo Station (35.6812, 139.7671) to Kyoto Station (34.9858, 135.7588)
    # Known geodesic distance: ~370.5 km
    dist = haversine_distance_km(35.6812, 139.7671, 34.9858, 135.7588)
    assert 365.0 < dist < 375.0, f"Expected ~370 km between Tokyo and Kyoto, got {dist}"

    # Zero distance between same point
    assert haversine_distance_km(35.6812, 139.7671, 35.6812, 139.7671) == 0.0


def test_route_summary_empty_stops(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """A journey with 0 intermediate stops (Origin -> Destination) must calculate route, distance, and 1 leg."""
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Direct Journey",
        starting_location="Tokyo",
        ending_location="Kyoto",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["trip_id"] == str(trip.id)
    assert data["total_stops"] == 0
    assert data["total_waypoints"] == 2
    assert data["total_distance_km"] > 300.0  # Tokyo to Kyoto road/haversine distance
    assert len(data["legs"]) == 1
    assert data["has_missing_coordinates"] is False

    # Check origin and destination waypoints
    assert data["waypoints"][0]["point_type"] == "origin"
    assert data["waypoints"][0]["location"] == "Tokyo"
    assert data["waypoints"][0]["has_coordinates"] is True
    assert data["waypoints"][1]["point_type"] == "destination"
    assert data["waypoints"][1]["location"] == "Kyoto"
    assert data["waypoints"][1]["has_coordinates"] is True

    # Check leg details
    leg = data["legs"][0]
    assert leg["leg_index"] == 1
    assert leg["from_title"] == "Tokyo"
    assert leg["to_title"] == "Kyoto"
    assert leg["distance_km"] > 300.0
    assert leg["status"] == "available"


def test_route_summary_multi_stops_calculation(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """Verify route waypoints, leg breakdown, and cumulative distance across full journey: Origin -> Stops -> Destination."""
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Tokaido Overland",
        starting_location="Tokyo Station",
        ending_location="Osaka Castle",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    # Add 3 stops: Yokohama -> Shizuoka -> Nagoya
    stops_data = [
        ("Yokohama Landmark", "Yokohama", 35.4549, 139.6314, 0),
        ("Shizuoka Tea Farm", "Shizuoka", 34.9756, 138.3828, 1),
        ("Nagoya Castle", "Nagoya", 35.1847, 136.8997, 2),
    ]
    for name, loc, lat, lng, order in stops_data:
        stop = TripStop(
            trip_id=trip.id,
            stop_name=name,
            location=loc,
            latitude=lat,
            longitude=lng,
            order_index=order,
        )
        db_session.add(stop)
    db_session.commit()

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["total_stops"] == 3
    assert data["total_waypoints"] == 5  # Origin + 3 stops + Destination
    assert data["valid_coordinates_count"] == 5
    assert data["missing_coordinates_count"] == 0
    assert data["has_missing_coordinates"] is False
    assert len(data["legs"]) == 4  # Tokyo -> Yokohama -> Shizuoka -> Nagoya -> Osaka
    assert data["total_distance_km"] > 350.0
    assert "km" in data["distance_formatted"]
    assert data["estimated_duration_minutes"] > 0

    # Verify leg details in sequence
    assert data["legs"][0]["from_title"] == "Tokyo Station"
    assert data["legs"][0]["to_title"] == "Yokohama Landmark"
    assert data["legs"][1]["from_title"] == "Yokohama Landmark"
    assert data["legs"][1]["to_title"] == "Shizuoka Tea Farm"
    assert data["legs"][2]["from_title"] == "Shizuoka Tea Farm"
    assert data["legs"][2]["to_title"] == "Nagoya Castle"
    assert data["legs"][3]["from_title"] == "Nagoya Castle"
    assert data["legs"][3]["to_title"] == "Osaka Castle"


def test_route_summary_missing_coordinates_handled_gracefully(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """Missing or None coordinates on a stop should be handled gracefully without crashing."""
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Partially Geocoded Journey",
        starting_location="Tokyo",
        ending_location="Hakone",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    # Stop 1 has valid coords
    stop1 = TripStop(
        trip_id=trip.id,
        stop_name="Tokyo Tower",
        location="Minato, Tokyo",
        latitude=35.6586,
        longitude=139.7454,
        order_index=0,
    )
    # Stop 2 has missing / unplaced (0, 0) coords
    stop2 = TripStop(
        trip_id=trip.id,
        stop_name="Mysterious Shrine",
        location="Unknown Hills",
        latitude=0.0,
        longitude=0.0,
        order_index=1,
    )
    db_session.add_all([stop1, stop2])
    db_session.commit()

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["total_stops"] == 2
    assert data["total_waypoints"] == 4
    assert data["valid_coordinates_count"] == 3  # Tokyo, Tokyo Tower, Hakone
    assert data["missing_coordinates_count"] == 1  # Mysterious Shrine
    assert data["has_missing_coordinates"] is True
    # Stop 2 marked as has_coordinates=False
    stop2_waypoint = [w for w in data["waypoints"] if w["title"] == "Mysterious Shrine"][0]
    assert stop2_waypoint["has_coordinates"] is False


def test_route_endpoint_private_trip_owner_access(client, db_session, profile_user1, auth_headers_user1):
    """Owner can access route summary for their private and draft journeys."""
    trip = Trip(
        owner_id=USER_1_ID,
        title="Secret Camping Trip",
        starting_location="Chiba",
        ending_location="Izu",
        visibility="private",
        status="draft",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    assert resp.json()["data"]["trip_id"] == str(trip.id)


def test_route_endpoint_private_trip_forbidden_for_visitor(client, db_session, profile_user1, profile_user2, auth_headers_user2):
    """Non-owner is forbidden (403) from accessing route summary of private or draft trip."""
    trip = Trip(
        owner_id=USER_1_ID,
        title="Kenji Confidential",
        starting_location="Nagano",
        ending_location="Matsumoto",
        visibility="private",
        status="draft",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    # User 2 tries to access User 1's private route
    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user2)
    assert resp.status_code == 403

    # Anonymous visitor also forbidden
    resp_anon = client.get(f"/api/v1/trips/{trip.id}/route")
    assert resp_anon.status_code == 403


def test_route_endpoint_public_trip_accessible_to_anon(client, db_session, profile_user1):
    """Anonymous visitors can access route summary for published public trips."""
    trip = Trip(
        owner_id=USER_1_ID,
        title="Open Adventure",
        starting_location="Osaka",
        ending_location="Nara",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "Open Adventure"


def test_route_endpoint_nonexistent_trip_returns_404(client, auth_headers_user1):
    """Nonexistent trip returns 404 Not Found."""
    resp = client.get("/api/v1/trips/00000000-9999-9999-9999-999999999999/route", headers=auth_headers_user1)
    assert resp.status_code == 404


def test_route_summary_haversine_fallback_metadata(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """When Geoapify is not active, route summary strictly indicates Haversine straight-line approximation."""
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Offline Autumn Ride",
        starting_location="Tokyo",
        ending_location="Nikko",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    stop1 = TripStop(trip_id=trip.id, stop_name="Asakusa", location="Tokyo", latitude=35.7118, longitude=139.7967, order_index=0)
    stop2 = TripStop(trip_id=trip.id, stop_name="Nikko Toshogu", location="Nikko", latitude=36.7581, longitude=139.5989, order_index=1)
    db_session.add_all([stop1, stop2])
    db_session.commit()

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Verify strict fallback categorization
    assert data["calculation_method"] == "geodesic_haversine"
    assert data["distance_type"] == "haversine_straight_line"
    assert data["duration_type"] == "unverified_estimate"
    assert data["is_approximate"] is True
    assert data["provider"] == "haversine"
    assert data["route_geometry"] is None
    assert data["total_distance_km"] > 0


def test_route_summary_geoapify_road_routing(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """When Geoapify routing responds, verified road geometry, road distances and durations are returned."""
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    trip = Trip(
        owner_id=USER_1_ID,
        title="Scenic Road Cruise",
        starting_location="Kyoto",
        ending_location="Kanazawa",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    stop1 = TripStop(trip_id=trip.id, stop_name="Kyoto Gyoen", location="Kyoto", latitude=35.0234, longitude=135.7628, order_index=0)
    stop2 = TripStop(trip_id=trip.id, stop_name="Lake Biwa View", location="Otsu", latitude=35.0045, longitude=135.8686, order_index=1)
    db_session.add_all([stop1, stop2])
    db_session.commit()

    mock_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "mode": "drive",
                    "distance": 224500,  # 224.5 km
                    "time": 10800,       # 180 min
                    "legs": [
                        {"distance": 4500, "time": 600},
                        {"distance": 20000, "time": 1200},
                        {"distance": 200000, "time": 9000},
                    ],
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [135.7681, 35.0116],
                        [135.7628, 35.0234],
                        [135.8686, 35.0045],
                        [136.6562, 36.5613],
                    ],
                },
            }
        ],
    }

    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: mock_geojson)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["calculation_method"] == "geoapify_roads"
    assert data["distance_type"] == "geoapify_road_route"
    assert data["duration_type"] == "geoapify_verified_duration"
    assert data["is_approximate"] is False
    assert data["provider"] == "geoapify"
    assert data["total_distance_km"] == 224.5
    assert data["estimated_duration_minutes"] == 180
    assert data["distance_formatted"] == "224.5 km"
    assert data["duration_formatted"] == "3 hrs"
    assert data["route_geometry"]["type"] == "LineString"
    assert len(data["route_geometry"]["coordinates"]) == 4
    assert len(data["legs"]) == 3
    assert data["legs"][0]["from_title"] == "Kyoto"
    assert data["legs"][0]["to_title"] == "Kyoto Gyoen"
    assert data["legs"][0]["distance_km"] == 4.5
    assert data["legs"][1]["from_title"] == "Kyoto Gyoen"
    assert data["legs"][1]["to_title"] == "Lake Biwa View"
    assert data["legs"][2]["from_title"] == "Lake Biwa View"
    assert data["legs"][2]["to_title"] == "Kanazawa"
    assert data["legs"][0]["estimated_duration_minutes"] == 10


def test_route_summary_caching_and_invalidation(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """Route calculations are cached in memory and can be cleared."""
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Cache Test Journey",
        starting_location="Tokyo",
        ending_location="Yokohama",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    # Initial call
    resp1 = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp1.status_code == 200
    assert len(TripService._route_cache) > 0

    # Second call uses cache
    resp2 = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp2.status_code == 200
    assert resp1.json()["data"]["trip_id"] == resp2.json()["data"]["trip_id"]

    # Invalidate cache
    TripService.clear_route_cache()
    assert len(TripService._route_cache) == 0


# ==============================================================================
# Comprehensive Origin-to-Destination & Geocoding Routing Test Suite
# ==============================================================================

def test_route_origin_to_destination_zero_intermediate_stops_leh_manali(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    Reproduction test:
    Trip Leh -> Manali with 0 intermediate stops must calculate a route, distance (>0),
    and 1 leg connecting Leh directly to Manali (never 0.0 km or 'Direct').
    """
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Himalayan Crossing",
        starting_location="Leh",
        ending_location="Manali",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["trip_id"] == str(trip.id)
    assert data["total_stops"] == 0
    assert data["total_waypoints"] == 2
    assert data["valid_coordinates_count"] == 2
    assert data["missing_coordinates_count"] == 0
    assert data["has_missing_coordinates"] is False

    # Check origin waypoint
    origin_wp = data["waypoints"][0]
    assert origin_wp["point_type"] == "origin"
    assert origin_wp["location"] == "Leh"
    assert origin_wp["has_coordinates"] is True
    assert 33.0 < origin_wp["latitude"] < 35.5
    assert 76.5 < origin_wp["longitude"] < 78.5

    # Check destination waypoint
    dest_wp = data["waypoints"][1]
    assert dest_wp["point_type"] == "destination"
    assert dest_wp["location"] == "Manali"
    assert dest_wp["has_coordinates"] is True
    assert 31.5 < dest_wp["latitude"] < 33.0
    assert 76.5 < dest_wp["longitude"] < 78.0

    # Never 0.0 km or missing legs
    assert data["total_distance_km"] > 200.0
    assert data["estimated_duration_minutes"] > 0
    assert len(data["legs"]) == 1

    leg = data["legs"][0]
    assert leg["leg_index"] == 1
    assert leg["from_title"] == "Leh"
    assert leg["to_title"] == "Manali"
    assert leg["distance_km"] > 200.0
    assert leg["estimated_duration_minutes"] > 0
    assert leg["status"] == "available"


def test_route_origin_one_stop_destination_leh_sarchu_manali(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    Journey: Origin (Leh) -> 1 Stop (Sarchu) -> Destination (Manali).
    Must calculate 2 chronological legs: Leh -> Sarchu, Sarchu -> Manali.
    """
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="High Pass Traverse",
        starting_location="Leh",
        ending_location="Manali",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    stop1 = TripStop(
        trip_id=trip.id,
        stop_name="Sarchu High Camp",
        location="Sarchu, Ladakh",
        latitude=32.9056,
        longitude=77.5815,
        order_index=0,
    )
    db_session.add(stop1)
    db_session.commit()

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["total_stops"] == 1
    assert data["total_waypoints"] == 3
    assert data["valid_coordinates_count"] == 3
    assert len(data["legs"]) == 2

    # Leg 1: Leh -> Sarchu High Camp
    assert data["legs"][0]["from_title"] == "Leh"
    assert data["legs"][0]["to_title"] == "Sarchu High Camp"
    assert data["legs"][0]["distance_km"] > 50.0

    # Leg 2: Sarchu High Camp -> Manali
    assert data["legs"][1]["from_title"] == "Sarchu High Camp"
    assert data["legs"][1]["to_title"] == "Manali"
    assert data["legs"][1]["distance_km"] > 50.0


def test_route_origin_multiple_stops_destination_leh_manali(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    Journey: Origin (Leh) -> Stop 1 (Upshi) -> Stop 2 (Sarchu) -> Stop 3 (Keylong) -> Destination (Manali).
    Must calculate 4 chronological legs in strict journey order.
    """
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)
    trip = Trip(
        owner_id=USER_1_ID,
        title="Grand Himalayan Expedition",
        starting_location="Leh",
        ending_location="Manali",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    stops = [
        ("Upshi Village", "Upshi, Ladakh", 33.8290, 77.8150, 0),
        ("Sarchu Camp", "Sarchu", 32.9056, 77.5815, 1),
        ("Keylong Oasis", "Keylong, HP", 32.5710, 77.0320, 2),
    ]
    for name, loc, lat, lng, idx in stops:
        db_session.add(
            TripStop(
                trip_id=trip.id,
                stop_name=name,
                location=loc,
                latitude=lat,
                longitude=lng,
                order_index=idx,
            )
        )
    db_session.commit()

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["total_stops"] == 3
    assert data["total_waypoints"] == 5
    assert data["valid_coordinates_count"] == 5
    assert len(data["legs"]) == 4

    assert data["legs"][0]["from_title"] == "Leh"
    assert data["legs"][0]["to_title"] == "Upshi Village"
    assert data["legs"][1]["from_title"] == "Upshi Village"
    assert data["legs"][1]["to_title"] == "Sarchu Camp"
    assert data["legs"][2]["from_title"] == "Sarchu Camp"
    assert data["legs"][2]["to_title"] == "Keylong Oasis"
    assert data["legs"][3]["from_title"] == "Keylong Oasis"
    assert data["legs"][3]["to_title"] == "Manali"


def test_route_missing_origin_coordinates_handled(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    When origin coordinates cannot be geocoded or resolved, the system flags missing coordinates
    and returns a clear error instead of crashing or showing invalid 0 km route.
    """
    TripService.clear_route_cache()
    # Mock geocode to return None for origin
    def mock_geocode(name):
        if name == "UnresolvableNowherePlace999":
            return None
        return {"lat": 32.2455, "lng": 77.1873, "formatted": "Manali, HP, India", "confidence": 1.0}

    monkeypatch.setattr(TripService, "geocode_location", mock_geocode)

    trip = Trip(
        owner_id=USER_1_ID,
        title="Mystic Mystery Ride",
        starting_location="UnresolvableNowherePlace999",
        ending_location="Manali",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["has_missing_coordinates"] is True
    assert data["missing_coordinates_count"] == 1
    assert data["valid_coordinates_count"] == 1
    assert data["waypoints"][0]["point_type"] == "origin"
    assert data["waypoints"][0]["has_coordinates"] is False
    assert data["waypoints"][1]["point_type"] == "destination"
    assert data["waypoints"][1]["has_coordinates"] is True

    # With only 1 placed waypoint, route calculation cannot proceed
    assert data["total_distance_km"] == 0.0
    assert data["calculation_method"] == "unavailable"
    assert data["routing_error"] is not None
    assert "origin" in data["routing_error"].lower()


def test_route_missing_destination_coordinates_handled(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    When destination coordinates cannot be geocoded, system flags missing coordinates and reports error.
    """
    TripService.clear_route_cache()
    def mock_geocode(name):
        if name == "GhostTownNonExistent404":
            return None
        return {"lat": 34.1642, "lng": 77.5848, "formatted": "Leh, Ladakh, India", "confidence": 1.0}

    monkeypatch.setattr(TripService, "geocode_location", mock_geocode)

    trip = Trip(
        owner_id=USER_1_ID,
        title="Lost Highway",
        starting_location="Leh",
        ending_location="GhostTownNonExistent404",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["has_missing_coordinates"] is True
    assert data["waypoints"][1]["point_type"] == "destination"
    assert data["waypoints"][1]["has_coordinates"] is False
    assert data["total_distance_km"] == 0.0
    assert data["calculation_method"] == "unavailable"
    assert "destination" in data["routing_error"].lower()


def test_route_geocoding_api_failure_handled_gracefully(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    When Geoapify Geocoding API fails with HTTP 500 or timeout, geocode_location catches
    the error, returns None, and route computation does not crash.
    """
    TripService.clear_route_cache()
    import urllib.request
    from urllib.error import HTTPError

    def failing_urlopen(*args, **kwargs):
        raise HTTPError("https://api.geoapify.com/v1/geocode", 500, "Internal Server Error", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", failing_urlopen)

    # Calling geocode_location directly returns None safely
    result = TripService.geocode_location("Anyplace")
    assert result is None

    # Calling trip route endpoint handles geocode failure gracefully without raising 500
    trip = Trip(
        owner_id=USER_1_ID,
        title="Offline Tour",
        starting_location="Anyplace",
        ending_location="Otherplace",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["has_missing_coordinates"] is True
    assert data["calculation_method"] == "unavailable"


def test_route_geocoding_invalid_or_ambiguous_locations_rejected(monkeypatch):
    """
    Avoid silently selecting ambiguous or incorrect locations:
    Low confidence (< 0.25) or match_type == 'ambiguous' must be rejected.
    """
    TripService.clear_route_cache()
    import io
    import urllib.request

    # Ambiguous response mock
    ambiguous_json = json.dumps({
        "features": [
            {
                "properties": {
                    "lat": 10.0,
                    "lon": 20.0,
                    "formatted": "Ambiguous Place",
                    "rank": {"confidence": 0.1, "match_type": "ambiguous"},
                }
            }
        ]
    }).encode("utf-8")

    class MockResponse:
        status = 200
        def read(self):
            return ambiguous_json
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=5.0: MockResponse())

    res = TripService.geocode_location("VagueQuery123")
    assert res is None, "Ambiguous low-confidence geocoding result should be rejected"


def test_route_api_failure_fallback_to_haversine(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    When Geoapify Routing API fails or returns error, route calculation falls back
    to Haversine straight-line estimation with clear approximation metadata.
    """
    TripService.clear_route_cache()
    monkeypatch.setattr(TripService, "geocode_location", lambda name, **kw: MOCK_GEOCODE_DB.get(name))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)

    trip = Trip(
        owner_id=USER_1_ID,
        title="Leh to Manali Haversine Fallback",
        starting_location="Leh",
        ending_location="Manali",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["calculation_method"] == "geodesic_haversine"
    assert data["distance_type"] == "haversine_straight_line"
    assert data["duration_type"] == "unverified_estimate"
    assert data["is_approximate"] is True
    assert data["provider"] == "haversine"
    assert data["route_geometry"] is None
    assert 200.0 < data["total_distance_km"] < 250.0  # Leh to Manali straight-line ~216 km
    assert len(data["legs"]) == 1
    assert data["legs"][0]["distance_km"] > 200.0


def test_route_geocoding_cache_reused(monkeypatch):
    """
    Successful geocoding results are cached in-memory and reused without re-requesting the API.
    """
    TripService.clear_route_cache()
    call_count = {"count": 0}
    import urllib.request

    valid_json = json.dumps({
        "features": [
            {
                "properties": {
                    "lat": 34.1642,
                    "lon": 77.5848,
                    "formatted": "Leh, Ladakh, India",
                    "rank": {"confidence": 1.0, "match_type": "full_match"},
                }
            }
        ]
    }).encode("utf-8")

    class MockResponse:
        status = 200
        def read(self):
            return valid_json
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    def counting_urlopen(req, timeout=5.0):
        call_count["count"] += 1
        return MockResponse()

    monkeypatch.setattr(urllib.request, "urlopen", counting_urlopen)

    res1 = TripService.geocode_location("Leh")
    assert res1 is not None
    assert call_count["count"] == 1

    # Second call should use in-memory cache
    res2 = TripService.geocode_location("Leh")
    assert res2 == res1
    assert call_count["count"] == 1  # No additional network call


def test_route_cache_invalidated_when_journey_locations_change(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """Updating starting_location or ending_location invalidates cached route and recalculates."""
    TripService.clear_route_cache()

    coords = {
        "Leh": {"lat": 34.1642, "lng": 77.5848},
        "Manali": {"lat": 32.2455, "lng": 77.1873},
        "Shimla": {"lat": 31.1048, "lng": 77.1734},
    }
    monkeypatch.setattr(TripService, "geocode_location", lambda loc: coords.get(loc))
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: None)

    trip = Trip(
        owner_id=USER_1_ID,
        title="Cache Invalidation Trip",
        starting_location="Leh",
        ending_location="Manali",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp1 = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp1.status_code == 200
    d1 = resp1.json()["data"]
    assert d1["legs"][0]["to_title"] == "Manali"
    dist1 = d1["total_distance_km"]

    # Update ending_location via PATCH
    patch_resp = client.patch(
        f"/api/v1/trips/{trip.id}",
        json={"ending_location": "Shimla"},
        headers=auth_headers_user1,
    )
    assert patch_resp.status_code == 200

    # Route request should recalculate for Shimla (not return stale Manali route)
    resp2 = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp2.status_code == 200
    d2 = resp2.json()["data"]
    assert d2["legs"][0]["to_title"] == "Shimla"
    assert d2["total_distance_km"] > dist1


def test_server_side_geocode_endpoint(client, monkeypatch):
    """GET /api/v1/trips/geocode resolves coordinates server-side without exposing API keys."""
    monkeypatch.setattr(
        TripService,
        "geocode_location",
        lambda q: {"lat": 34.1642, "lng": 77.5848, "formatted": "Leh, Ladakh, India"} if q == "Leh" else None,
    )

    resp = client.get("/api/v1/trips/geocode?q=Leh")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["lat"] == 34.1642
    assert body["data"]["lng"] == 77.5848
    assert "apiKey" not in str(body)

    resp_missing = client.get("/api/v1/trips/geocode?q=UnknownPlaceXYZ")
    assert resp_missing.status_code == 200
    assert resp_missing.json()["data"] is None


def test_geocoding_country_and_region_disambiguation_leh_manali_india(monkeypatch):
    """
    When Geoapify returns multiple same-named places across states/countries,
    explicit geographical context ('Leh, Ladakh, India' and 'Manali, Himachal Pradesh, India')
    selects the exact country and state match rather than blindly picking index 0.
    """
    TripService.clear_route_cache()
    import urllib.request

    def fake_urlopen(req, timeout=5.0):
        url = req.full_url
        if "Leh" in url:
            payload = {
                "features": [
                    {
                        "properties": {
                            "lat": 48.2922874,
                            "lon": 20.9804874,
                            "formatted": "Léh, Great Plain and North, Hungary",
                            "country": "Hungary",
                            "country_code": "hu",
                            "state": "Great Plain and North",
                            "result_type": "city",
                            "rank": {"confidence": 1.0, "match_type": "full_match"},
                        }
                    },
                    {
                        "properties": {
                            "lat": 34.1642029,
                            "lon": 77.5848133,
                            "formatted": "Leh, Ladakh, India",
                            "country": "India",
                            "country_code": "in",
                            "state": "Ladakh",
                            "result_type": "city",
                            "rank": {"confidence": 1.0, "match_type": "full_match"},
                        }
                    },
                ]
            }
        else:
            payload = {
                "features": [
                    {
                        "properties": {
                            "lat": 13.1810602,
                            "lon": 80.2694192,
                            "formatted": "Manali, Chennai, Tamil Nadu, India",
                            "country": "India",
                            "country_code": "in",
                            "state": "Tamil Nadu",
                            "result_type": "suburb",
                            "rank": {"confidence": 1.0, "match_type": "full_match"},
                        }
                    },
                    {
                        "properties": {
                            "lat": 32.2454608,
                            "lon": 77.1872926,
                            "formatted": "Manali, HP, India",
                            "country": "India",
                            "country_code": "in",
                            "state": "Himachal Pradesh",
                            "result_type": "city",
                            "rank": {"confidence": 1.0, "match_type": "full_match"},
                        }
                    },
                ]
            }

        encoded = json.dumps(payload).encode("utf-8")

        class MockResp:
            status = 200
            def read(self):
                return encoded
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        return MockResp()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    leh = TripService.geocode_location("Leh, Ladakh, India")
    assert leh is not None
    assert leh["country"] == "India"
    assert leh["country_code"] == "in"
    assert leh["state"] == "Ladakh"
    assert leh["lat"] == pytest.approx(34.1642029)
    assert leh["lng"] == pytest.approx(77.5848133)

    manali = TripService.geocode_location("Manali, Himachal Pradesh, India")
    assert manali is not None
    assert manali["country"] == "India"
    assert manali["state"] == "Himachal Pradesh"
    assert manali["lat"] == pytest.approx(32.2454608)
    assert manali["lng"] == pytest.approx(77.1872926)


def test_geocoding_incorrect_country_or_region_rejected(monkeypatch):
    """
    If Geoapify returns a high-confidence result in a different country/region
    (e.g. Japan or France when India was specified), it MUST be rejected.
    """
    TripService.clear_route_cache()
    import urllib.request

    wrong_country_json = json.dumps({
        "features": [
            {
                "properties": {
                    "lat": 35.6768601,
                    "lon": 139.7638947,
                    "formatted": "Tokyo, Japan",
                    "country": "Japan",
                    "country_code": "jp",
                    "state": None,
                    "result_type": "city",
                    "rank": {"confidence": 1.0, "match_type": "full_match"},
                }
            }
        ]
    }).encode("utf-8")

    class MockResp:
        status = 200
        def read(self):
            return wrong_country_json
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=5.0: MockResp())

    res = TripService.geocode_location("Leh, Ladakh, India")
    assert res is None, "Must reject high-confidence result from wrong country (Japan)"


def test_geojson_endpoint_consistency_rejects_swapped_lat_lng(client, db_session, profile_user1, auth_headers_user1, monkeypatch):
    """
    GeoJSON coordinates must use [longitude, latitude] and match origin/destination.
    If returned geometry has swapped [lat, lng] or mismatched endpoints, route must NOT
    be marked as verified geoapify_roads and must fall back safely.
    """
    TripService.clear_route_cache()
    coords = {
        "leh, ladakh, india|ladakh|india": {
            "lat": 34.1642029, "lng": 77.5848133, "formatted": "Leh, Ladakh, India",
            "country": "India", "country_code": "in", "state": "Ladakh",
        },
        "manali, himachal pradesh, india|himachal pradesh|india": {
            "lat": 32.2454608, "lng": 77.1872926, "formatted": "Manali, HP, India",
            "country": "India", "country_code": "in", "state": "Himachal Pradesh",
        },
    }
    monkeypatch.setattr(
        TripService,
        "geocode_location",
        lambda q, expected_country=None, expected_region=None: (
            coords.get("leh, ladakh, india|ladakh|india")
            if "Leh" in q
            else coords.get("manali, himachal pradesh, india|himachal pradesh|india")
        ),
    )

    # Mock Geoapify returning swapped [lat, lng] instead of GeoJSON [lng, lat]
    swapped_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"distance": 426250, "time": 23760, "legs": [{"distance": 426250, "time": 23760}]},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [34.1642029, 77.5848133],  # SWAPPED [lat, lng]!
                        [32.2454608, 77.1872926],  # SWAPPED [lat, lng]!
                    ],
                },
            }
        ],
    }
    monkeypatch.setattr(TripService, "_fetch_geoapify_route", lambda waypoints: swapped_geojson)

    trip = Trip(
        owner_id=USER_1_ID,
        title="Swapped Geometry Guard Trip",
        starting_location="Leh, Ladakh, India",
        ending_location="Manali, Himachal Pradesh, India",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["calculation_method"] == "geodesic_haversine"
    assert data["is_approximate"] is True
    assert data["route_geometry"] is None


def test_leh_ladakh_to_manali_hp_zero_stops_real_geoapify_integration(client, db_session, profile_user1, auth_headers_user1):
    """
    Real Geoapify Integration Test (locally configured API key):
    Verifies Leh, Ladakh, India -> Manali, Himachal Pradesh, India (0 intermediate stops)
    resolves India coordinates, [lng, lat] GeoJSON geometry endpoints in Northern India,
    and realistic road distance/duration.
    """
    from app.config import settings
    if not settings.GEOAPIFY_API_KEY or settings.GEOAPIFY_API_KEY == "your-geoapify-api-key":
        pytest.skip("GEOAPIFY_API_KEY not configured locally")

    TripService.clear_route_cache()
    trip = Trip(
        owner_id=USER_1_ID,
        title="Real Geoapify Leh-Manali Check",
        starting_location="Leh, Ladakh, India",
        ending_location="Manali, Himachal Pradesh, India",
        visibility="public",
        status="published",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    resp = client.get(f"/api/v1/trips/{trip.id}/route", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["total_stops"] == 0
    assert data["total_waypoints"] == 2
    assert data["calculation_method"] == "geoapify_roads"
    assert data["is_approximate"] is False
    assert data["provider"] == "geoapify"
    assert 350.0 < data["total_distance_km"] < 600.0
    assert data["estimated_duration_minutes"] > 240

    origin_wp, dest_wp = data["waypoints"][0], data["waypoints"][1]
    assert origin_wp["country"] == "India"
    assert origin_wp["country_code"] == "in"
    assert origin_wp["state"] == "Ladakh"
    assert 33.5 < origin_wp["latitude"] < 35.0
    assert 77.0 < origin_wp["longitude"] < 78.5

    assert dest_wp["country"] == "India"
    assert dest_wp["country_code"] == "in"
    assert dest_wp["state"] == "Himachal Pradesh"
    assert 31.8 < dest_wp["latitude"] < 32.8
    assert 76.8 < dest_wp["longitude"] < 77.6

    # Verify GeoJSON [longitude, latitude] ordering and endpoints in Northern India (never Japan!)
    geom = data["route_geometry"]
    assert geom is not None
    assert geom["type"] in ("LineString", "MultiLineString")
    pts = geom["coordinates"] if geom["type"] == "LineString" else [p for seg in geom["coordinates"] for p in seg]
    start_lng, start_lat = pts[0][0], pts[0][1]
    end_lng, end_lat = pts[-1][0], pts[-1][1]

    assert 76.5 < start_lng < 78.5 and 33.5 < start_lat < 35.0
    assert 76.5 < end_lng < 78.0 and 31.8 < end_lat < 32.8
    assert haversine_distance_km(origin_wp["latitude"], origin_wp["longitude"], start_lat, start_lng) < 5.0
    assert haversine_distance_km(dest_wp["latitude"], dest_wp["longitude"], end_lat, end_lng) < 5.0



