"""
Trip Service
Handles trip creation, updates, queries, and lifecycle state transitions
Aligned with PRD Module 3 and docs/PHASE3_API_DESIGN.md Section 3
"""

import json
import logging
import math
import urllib.parse
import urllib.request
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.models.trip import Trip, TripStop
from app.models.profile import Profile
from app.schemas.trip import (
    TripCreate,
    TripUpdate,
    TripPublishRequest,
    TripResponse,
    TripListItem,
    PaginatedTripList,
    TripVisibility,
    TripStatus,
    TripCategory,
    TripOwnerSnippet,
    TripStopResponse,
    RouteWaypoint,
    RouteLeg,
    TripRouteSummary,
)


logger = logging.getLogger(__name__)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth (in km)."""
    R = 6371.0  # Earth's mean radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


class TripService:
    _route_cache: Dict[str, TripRouteSummary] = {}
    _geocode_cache: Dict[str, Optional[Dict[str, Any]]] = {}

    @classmethod
    def clear_route_cache(cls) -> None:
        """Clear all in-memory route calculation and geocoding caches."""
        cls._route_cache.clear()
        cls._geocode_cache.clear()

    _CONTEXT_ALIASES: Dict[str, List[str]] = {
        "in": ["india"],
        "india": ["in"],
        "hp": ["himachal pradesh"],
        "himachal pradesh": ["hp"],
        "la": ["ladakh"],
        "ladakh": ["la"],
        "tn": ["tamil nadu"],
        "tamil nadu": ["tn"],
        "us": ["united states", "united states of america", "usa"],
        "usa": ["united states", "united states of america", "us"],
        "united states": ["us", "usa", "united states of america"],
        "uk": ["united kingdom", "gb", "great britain"],
        "united kingdom": ["uk", "gb"],
        "jp": ["japan"],
        "japan": ["jp"],
    }

    @classmethod
    def _candidate_matches_context(cls, props: Dict[str, Any], context_hints: List[str]) -> bool:
        """
        Verify that a Geoapify geocoding candidate matches all explicit country/state/region
        context hints supplied in the query (e.g. 'Leh, Ladakh, India').
        """
        if not context_hints:
            return True

        fields = [
            str(props.get("country") or "").strip().lower(),
            str(props.get("country_code") or "").strip().lower(),
            str(props.get("state") or "").strip().lower(),
            str(props.get("state_code") or "").strip().lower(),
            str(props.get("county") or "").strip().lower(),
            str(props.get("city") or "").strip().lower(),
            str(props.get("region") or "").strip().lower(),
        ]
        # Also include normalized comma-separated parts of formatted address
        formatted_parts = [
            p.strip().lower()
            for p in str(props.get("formatted") or "").split(",")
            if p.strip()
        ]
        candidate_tokens = set(f for f in (fields + formatted_parts) if f)

        for hint in context_hints:
            h = hint.strip().lower()
            if not h:
                continue
            accepted = {h}
            accepted.update(cls._CONTEXT_ALIASES.get(h, []))
            if not (candidate_tokens & accepted):
                # Allow substring match only against full region/state/country names (len >= 4)
                matched_partial = any(
                    len(tok) >= 4 and (h in tok or tok in h)
                    for tok in fields
                    if tok
                )
                if not matched_partial:
                    return False
        return True

    @classmethod
    def _validate_and_analyze_geometry(
        cls,
        geometry: Optional[Dict[str, Any]],
        waypoints: List[RouteWaypoint],
        max_endpoint_drift_km: float = 50.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Inspect GeoJSON LineString or MultiLineString geometry ([longitude, latitude] order),
        compute bounding box, and verify endpoints correspond geographically to origin & destination.
        Returns dict with first_coord, last_coord, bbox or None if invalid/mismatched.
        """
        if not geometry or not isinstance(geometry, dict) or len(waypoints) < 2:
            return None

        gtype = geometry.get("type")
        raw_coords = geometry.get("coordinates")
        if not raw_coords:
            return None

        if gtype == "LineString":
            points = raw_coords
        elif gtype == "MultiLineString":
            points = [pt for segment in raw_coords for pt in segment]
        else:
            return None

        if len(points) < 2:
            return None

        first_coord = points[0]
        last_coord = points[-1]
        if (
            not isinstance(first_coord, (list, tuple))
            or len(first_coord) < 2
            or not isinstance(last_coord, (list, tuple))
            or len(last_coord) < 2
        ):
            return None

        first_lng, first_lat = float(first_coord[0]), float(first_coord[1])
        last_lng, last_lat = float(last_coord[0]), float(last_coord[1])

        if not (
            -90.0 <= first_lat <= 90.0
            and -180.0 <= first_lng <= 180.0
            and -90.0 <= last_lat <= 90.0
            and -180.0 <= last_lng <= 180.0
        ):
            return None

        origin = waypoints[0]
        dest = waypoints[-1]
        if origin.latitude is None or origin.longitude is None or dest.latitude is None or dest.longitude is None:
            return None

        origin_drift_km = haversine_distance_km(origin.latitude, origin.longitude, first_lat, first_lng)
        dest_drift_km = haversine_distance_km(dest.latitude, dest.longitude, last_lat, last_lng)

        if origin_drift_km > max_endpoint_drift_km or dest_drift_km > max_endpoint_drift_km:
            logger.error(
                f"Geoapify route geometry endpoint mismatch rejected: "
                f"origin_drift={origin_drift_km:.2f}km, dest_drift={dest_drift_km:.2f}km"
            )
            return None

        lngs = [float(p[0]) for p in points if isinstance(p, (list, tuple)) and len(p) >= 2]
        lats = [float(p[1]) for p in points if isinstance(p, (list, tuple)) and len(p) >= 2]
        bbox = [round(min(lngs), 6), round(min(lats), 6), round(max(lngs), 6), round(max(lats), 6)]

        return {
            "first_coord": [first_lng, first_lat],
            "last_coord": [last_lng, last_lat],
            "bbox": bbox,
            "origin_drift_km": round(origin_drift_km, 2),
            "dest_drift_km": round(dest_drift_km, 2),
        }

    @staticmethod
    def _fetch_json_with_ipv4_fallback(url: str, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        """
        Fetch JSON via urllib.request.urlopen (honoring test monkeypatches), with an IPv4 httpx
        fallback when unpatched Windows IPv6 TLS handshakes time out.
        """
        headers = {"User-Agent": "MICHI-Backend/1.0 (Travel Platform)"}
        req = urllib.request.Request(url, headers=headers)
        is_mocked = getattr(urllib.request.urlopen, "__module__", "") != "urllib.request"
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
                return None
        except Exception as exc:
            if is_mocked:
                raise
            is_timeout = isinstance(exc, TimeoutError) or "timed out" in str(exc).lower()
            if not is_timeout:
                raise
            import httpx
            with httpx.Client(
                transport=httpx.HTTPTransport(local_address="0.0.0.0"),
                timeout=max(timeout, 8.0),
            ) as client:
                r = client.get(url, headers=headers)
                if r.status_code == 200:
                    return r.json()
                return None

    @classmethod
    def geocode_location(
        cls,
        location_name: str,
        expected_country: Optional[str] = None,
        expected_region: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve location name to latitude and longitude using Geoapify Geocoding API.
        Verifies country/state context, confidence, and coordinate ranges, and rejects
        ambiguous or mismatched locations without silently choosing wrong regions.
        Returns dict with lat, lng, formatted, country, country_code, state, result_type, confidence, match_type.
        """
        if not location_name or not location_name.strip():
            return None

        clean_name = location_name.strip()
        parts = [p.strip() for p in clean_name.split(",") if p.strip()]
        context_hints = [p for p in parts[1:]] if len(parts) > 1 else []
        if expected_country:
            context_hints.append(expected_country.strip())
        if expected_region:
            context_hints.append(expected_region.strip())

        cache_key = f"{clean_name.lower()}|{'|'.join(h.lower() for h in context_hints)}"
        if cache_key in cls._geocode_cache:
            return cls._geocode_cache[cache_key]

        if not settings.GEOAPIFY_API_KEY:
            return None

        try:
            params = {
                "text": clean_name,
                "apiKey": settings.GEOAPIFY_API_KEY,
                "limit": 5,
            }
            url = f"https://api.geoapify.com/v1/geocode/search?{urllib.parse.urlencode(params)}"
            data = cls._fetch_json_with_ipv4_fallback(url, timeout=5.0)
            if data is not None:
                features = data.get("features", [])
                if not features:
                    cls._geocode_cache[cache_key] = None
                    return None

                selected_props: Optional[Dict[str, Any]] = None
                for feat in features:
                    props = feat.get("properties", {})
                    rank = props.get("rank", {})
                    confidence = float(rank.get("confidence", 0.0))
                    match_type = rank.get("match_type", "")
                    lat = props.get("lat")
                    lon = props.get("lon")

                    if lat is None or lon is None:
                        continue

                    lat_f = float(lat)
                    lon_f = float(lon)
                    if not (-90.0 <= lat_f <= 90.0 and -180.0 <= lon_f <= 180.0):
                        continue
                    if lat_f == 0.0 and lon_f == 0.0:
                        continue

                    if match_type == "ambiguous" or confidence < 0.25:
                        continue

                    if not cls._candidate_matches_context(props, context_hints):
                        continue

                    selected_props = props
                    break

                if not selected_props:
                    logger.warning(
                        f"Geocoding rejected results for '{clean_name}' (context={context_hints}): "
                        f"no candidate satisfied confidence and geographical context constraints."
                    )
                    cls._geocode_cache[cache_key] = None
                    return None

                rank = selected_props.get("rank", {})
                result = {
                    "lat": float(selected_props["lat"]),
                    "lng": float(selected_props["lon"]),
                    "formatted": selected_props.get("formatted", clean_name),
                    "country": selected_props.get("country"),
                    "country_code": selected_props.get("country_code"),
                    "state": selected_props.get("state"),
                    "result_type": selected_props.get("result_type"),
                    "confidence": float(rank.get("confidence", 0.0)),
                    "match_type": rank.get("match_type", ""),
                }
                logger.info(
                    f"Geocoded '{clean_name}' -> {result['formatted']!r} "
                    f"country={result['country']!r} ({result['country_code']!r}), "
                    f"state={result['state']!r}, coords=({result['lat']}, {result['lng']}), "
                    f"type={result['result_type']!r}, confidence={result['confidence']}"
                )
                if len(cls._geocode_cache) > 1000:
                    cls._geocode_cache.clear()
                cls._geocode_cache[cache_key] = result
                return result
        except Exception as e:
            logger.warning(f"Geoapify Geocoding API call failed for '{clean_name}': {e}")
            return None

        return None

    @classmethod
    def _fetch_geoapify_route(cls, waypoints: List[RouteWaypoint]) -> Optional[Dict[str, Any]]:
        """
        Request driving road route and turn coordinates from Geoapify Routing API.
        Returns parsed JSON or None if unavailable or errored.
        """
        if not settings.GEOAPIFY_API_KEY:
            return None

        if len(waypoints) < 2 or len(waypoints) > 25:
            return None

        try:
            wp_param = "|".join(f"{w.latitude},{w.longitude}" for w in waypoints)
            query_params = {
                "waypoints": wp_param,
                "mode": "drive",
                "apiKey": settings.GEOAPIFY_API_KEY,
            }
            url = f"https://api.geoapify.com/v1/routing?{urllib.parse.urlencode(query_params)}"
            return cls._fetch_json_with_ipv4_fallback(url, timeout=5.0)
        except Exception as e:
            logger.warning(f"Geoapify Routing API call failed, falling back to Haversine: {e}")
            return None

    @staticmethod
    def _to_owner_snippet(profile: Optional[Profile], owner_id: str) -> TripOwnerSnippet:
        if profile:
            return TripOwnerSnippet(
                id=str(profile.id),
                username=profile.username,
                display_name=profile.display_name,
                avatar_url=profile.avatar_url,
            )
        return TripOwnerSnippet(
            id=str(owner_id),
            username="unknown",
            display_name="Traveller",
            avatar_url=None,
        )

    @classmethod
    def _to_trip_response(cls, trip: Trip) -> TripResponse:
        owner_snippet = cls._to_owner_snippet(trip.owner, str(trip.owner_id))
        stops_res = [
            TripStopResponse.model_validate(s) for s in sorted(trip.stops, key=lambda x: x.order_index)
        ]
        return TripResponse(
            id=str(trip.id),
            owner_id=str(trip.owner_id),
            title=trip.title,
            description=trip.description,
            cover_image_url=trip.cover_image_url,
            starting_location=trip.starting_location,
            ending_location=trip.ending_location,
            start_date=trip.start_date,
            end_date=trip.end_date,
            category=TripCategory(trip.category),
            visibility=TripVisibility(trip.visibility),
            status=TripStatus(trip.status),
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            owner=owner_snippet,
            stops_count=len(stops_res),
            stops=stops_res,
        )

    @classmethod
    def _to_list_item(cls, trip: Trip) -> TripListItem:
        owner_snippet = cls._to_owner_snippet(trip.owner, str(trip.owner_id))
        return TripListItem(
            id=str(trip.id),
            owner_id=str(trip.owner_id),
            title=trip.title,
            description=trip.description,
            cover_image_url=trip.cover_image_url,
            starting_location=trip.starting_location,
            ending_location=trip.ending_location,
            start_date=trip.start_date,
            end_date=trip.end_date,
            category=TripCategory(trip.category),
            visibility=TripVisibility(trip.visibility),
            status=TripStatus(trip.status),
            created_at=trip.created_at,
            stops_count=len(trip.stops) if trip.stops is not None else 0,
            owner=owner_snippet,
        )

    @classmethod
    def create_trip(cls, db: Session, owner_id: str, req: TripCreate) -> TripResponse:
        """Create a new itinerary in draft status."""
        trip = Trip(
            owner_id=str(owner_id),
            title=req.title.strip(),
            description=req.description,
            cover_image_url=req.cover_image_url,
            starting_location=req.starting_location.strip(),
            ending_location=req.ending_location.strip(),
            start_date=req.start_date,
            end_date=req.end_date,
            category=req.category.value,
            visibility=req.visibility.value,
            status=TripStatus.DRAFT.value,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return cls._to_trip_response(trip)

    @classmethod
    def get_trip(
        cls,
        db: Session,
        trip_id: str,
        current_user_id: Optional[str] = None,
    ) -> TripResponse:
        """
        Retrieve trip details. Enforces visibility and authorization rules:
        - Public & published: readable by anyone.
        - Private or draft: readable ONLY by owner (auth.uid() = owner_id).
        - Archived: readable ONLY by owner.
        """
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        is_owner = current_user_id is not None and str(current_user_id) == str(trip.owner_id)

        if trip.status == TripStatus.ARCHIVED.value and not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This trip is archived and cannot be viewed by visitors.",
            )

        if (trip.visibility == TripVisibility.PRIVATE.value or trip.status == TripStatus.DRAFT.value) and not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This trip is private and cannot be viewed by visitors.",
            )

        return cls._to_trip_response(trip)

    @classmethod
    def list_my_trips(
        cls,
        db: Session,
        owner_id: str,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedTripList:
        """Retrieve all trips owned by the authenticated user, including drafts and archived journeys."""
        query = db.query(Trip).filter(Trip.owner_id == str(owner_id))

        if status_filter:
            query = query.filter(Trip.status == status_filter)

        total = query.count()
        offset = max(0, (page - 1) * page_size)
        trips = query.order_by(Trip.created_at.desc()).offset(offset).limit(page_size).all()

        items = [cls._to_list_item(t) for t in trips]
        return PaginatedTripList(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=(offset + page_size < total),
        )

    @classmethod
    def list_public_trips(
        cls,
        db: Session,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedTripList:
        """Retrieve public, published journeys for community discovery."""
        query = db.query(Trip).filter(
            Trip.visibility == TripVisibility.PUBLIC.value,
            Trip.status == TripStatus.PUBLISHED.value,
        )

        if category:
            query = query.filter(Trip.category == category)

        total = query.count()
        offset = max(0, (page - 1) * page_size)
        trips = query.order_by(Trip.created_at.desc()).offset(offset).limit(page_size).all()

        items = [cls._to_list_item(t) for t in trips]
        return PaginatedTripList(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=(offset + page_size < total),
        )

    @classmethod
    def update_trip(
        cls,
        db: Session,
        trip_id: str,
        owner_id: str,
        req: TripUpdate,
    ) -> TripResponse:
        """
        Update trip metadata (title, locations, dates, visibility, etc.).
        Status is strictly excluded from TripUpdate to prevent unauthorized lifecycle bypass.
        """
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        if str(trip.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this trip.",
            )

        update_data = req.model_dump(exclude_unset=True)

        # Cross-field date check against existing record if only one date is updated
        new_start = update_data.get("start_date", trip.start_date)
        new_end = update_data.get("end_date", trip.end_date)
        if new_start and new_end and new_end < new_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_date cannot be earlier than start_date",
            )

        for key, val in update_data.items():
            if hasattr(trip, key):
                if isinstance(val, (TripVisibility, TripCategory)):
                    setattr(trip, key, val.value)
                else:
                    setattr(trip, key, val)

        db.commit()
        db.refresh(trip)
        return cls._to_trip_response(trip)

    @classmethod
    def delete_trip(cls, db: Session, trip_id: str, owner_id: str) -> Dict[str, Any]:
        """Permanently delete a trip and all its stops (cascading)."""
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        if str(trip.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this trip.",
            )

        db.delete(trip)
        db.commit()
        return {"deleted": True, "id": str(trip_id)}

    # --------------------------------------------------------------------------
    # Lifecycle Operations
    # --------------------------------------------------------------------------

    @classmethod
    def validate_publishing_checklist(cls, trip: Trip) -> List[str]:
        """
        Mandatory publishing checklist:
        1. Title (min 3 chars)
        2. Valid category
        3. Starting location (min 2 chars)
        4. Ending location (min 2 chars)
        5. start_date and end_date populated and valid
        6. Stops validation: 0 stops is valid (point-to-point journey). If stops exist, all must be valid.
        7. Visibility is set.
        """
        errors = []
        if not trip.title or len(trip.title.strip()) < 3:
            errors.append("Trip title is required and must be at least 3 characters.")

        if not trip.category or trip.category not in [c.value for c in TripCategory]:
            errors.append(f"Trip category must be one of the approved categories.")

        if not trip.starting_location or len(trip.starting_location.strip()) < 2:
            errors.append("Starting location is required.")

        if not trip.ending_location or len(trip.ending_location.strip()) < 2:
            errors.append("Ending location is required.")

        if not trip.start_date:
            errors.append("Start date is required before publishing.")

        if not trip.end_date:
            errors.append("End date is required before publishing.")

        if trip.start_date and trip.end_date and trip.end_date < trip.start_date:
            errors.append("End date cannot be earlier than start date.")

        # Check existing stops if any
        if trip.stops:
            for s in trip.stops:
                if not s.stop_name or len(s.stop_name.strip()) < 2:
                    errors.append(f"Stop {s.id} is missing a valid name.")
                if not s.location or len(s.location.strip()) < 2:
                    errors.append(f"Stop {s.id} is missing a valid location.")
                if s.latitude is None or s.latitude < -90.0 or s.latitude > 90.0:
                    errors.append(f"Stop {s.id} has invalid latitude coordinates.")
                if s.longitude is None or s.longitude < -180.0 or s.longitude > 180.0:
                    errors.append(f"Stop {s.id} has invalid longitude coordinates.")

        if not trip.visibility or trip.visibility not in [v.value for v in TripVisibility]:
            errors.append("Trip visibility must be explicitly configured as 'public' or 'private'.")

        return errors

    @classmethod
    def publish_trip(
        cls,
        db: Session,
        trip_id: str,
        owner_id: str,
        req: Optional[TripPublishRequest] = None,
    ) -> TripResponse:
        """Transition a draft journey to published status after enforcing mandatory checklist."""
        trip = (
            db.query(Trip)
            .filter(Trip.id == str(trip_id))
            .with_for_update()
            .first()
        )
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        if str(trip.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to publish this trip.",
            )

        if trip.status != TripStatus.DRAFT.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot publish trip in '{trip.status}' status. Only draft trips can be published.",
            )

        if req and req.visibility:
            trip.visibility = req.visibility.value

        checklist_errors = cls.validate_publishing_checklist(trip)
        if checklist_errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Publishing checklist requirements not met: {'; '.join(checklist_errors)}",
            )

        try:
            trip.status = TripStatus.PUBLISHED.value
            db.commit()
            db.refresh(trip)
        except Exception:
            db.rollback()
            raise
        return cls._to_trip_response(trip)

    @classmethod
    def archive_trip(cls, db: Session, trip_id: str, owner_id: str) -> TripResponse:
        """Transition a published journey to archived status."""
        trip = (
            db.query(Trip)
            .filter(Trip.id == str(trip_id))
            .with_for_update()
            .first()
        )
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        if str(trip.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to archive this trip.",
            )

        if trip.status != TripStatus.PUBLISHED.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot archive trip in '{trip.status}' status. Only published trips can be archived.",
            )

        try:
            trip.status = TripStatus.ARCHIVED.value
            db.commit()
            db.refresh(trip)
        except Exception:
            db.rollback()
            raise
        return cls._to_trip_response(trip)

    @classmethod
    def restore_trip(cls, db: Session, trip_id: str, owner_id: str) -> TripResponse:
        """Restore an archived journey back to published status after re-verifying publishing criteria."""
        trip = (
            db.query(Trip)
            .filter(Trip.id == str(trip_id))
            .with_for_update()
            .first()
        )
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        if str(trip.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to restore this trip.",
            )

        if trip.status != TripStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot restore trip in '{trip.status}' status. Only archived trips can be restored.",
            )

        checklist_errors = cls.validate_publishing_checklist(trip)
        if checklist_errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Restoration checklist requirements not met: {'; '.join(checklist_errors)}",
            )

        try:
            trip.status = TripStatus.PUBLISHED.value
            db.commit()
            db.refresh(trip)
        except Exception:
            db.rollback()
            raise
        return cls._to_trip_response(trip)

    @classmethod
    def unpublish_trip(cls, db: Session, trip_id: str, owner_id: str) -> TripResponse:
        """Transition a published or archived journey back to draft for revisions."""
        trip = (
            db.query(Trip)
            .filter(Trip.id == str(trip_id))
            .with_for_update()
            .first()
        )
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip does not exist.",
            )

        if str(trip.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to unpublish this trip.",
            )

        if trip.status == TripStatus.DRAFT.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Trip is already in draft status.",
            )

        try:
            trip.status = TripStatus.DRAFT.value
            db.commit()
            db.refresh(trip)
        except Exception:
            db.rollback()
            raise
        return cls._to_trip_response(trip)

    @classmethod
    def get_trip_route(
        cls,
        db: Session,
        trip_id: str,
        current_user_id: Optional[str] = None,
    ) -> TripRouteSummary:
        """
        Compute and return the geographical route summary for a journey.
        Strictly enforces trip privacy / RLS rules:
        - Owner can access any trip (draft, private, published, archived).
        - Public published trips are accessible to visitors and anonymous users.
        - Private/draft trips return 403 Forbidden to non-owners.

        Journey route construction follows strict chronological order:
        Origin -> Intermediate Stop 1 -> ... -> Intermediate Stop N -> Destination.
        Origin and Destination locations are geocoded when coordinates are missing.
        """
        trip_resp = cls.get_trip(db, trip_id, current_user_id)
        sorted_stops = sorted(trip_resp.stops, key=lambda s: s.order_index)

        # Check in-memory route cache (keyed by trip ID, locations, updated timestamp, and stops)
        cache_key = (
            f"{trip_resp.id}:{trip_resp.starting_location}:{trip_resp.ending_location}:"
            f"{trip_resp.updated_at.isoformat()}:{[(s.id, s.order_index, s.latitude, s.longitude) for s in sorted_stops]}"
        )
        if cache_key in cls._route_cache:
            return cls._route_cache[cache_key]

        waypoints: List[RouteWaypoint] = []

        # 1. Origin Waypoint
        origin_geo = cls.geocode_location(trip_resp.starting_location)
        origin_lat = origin_geo["lat"] if origin_geo else None
        origin_lng = origin_geo["lng"] if origin_geo else None
        has_origin_coords = origin_lat is not None and origin_lng is not None

        waypoints.append(
            RouteWaypoint(
                point_type="origin",
                stop_id=None,
                title="Origin",
                location=trip_resp.starting_location,
                order_index=0,
                latitude=origin_lat,
                longitude=origin_lng,
                has_coordinates=has_origin_coords,
                country=origin_geo.get("country") if origin_geo else None,
                country_code=origin_geo.get("country_code") if origin_geo else None,
                state=origin_geo.get("state") if origin_geo else None,
                resolved_name=origin_geo.get("formatted") if origin_geo else None,
                arrival_date=trip_resp.start_date,
                departure_date=trip_resp.start_date,
            )
        )

        # 2. Intermediate Stops
        for idx, stop in enumerate(sorted_stops, start=1):
            lat = float(stop.latitude) if stop.latitude is not None else None
            lng = float(stop.longitude) if stop.longitude is not None else None
            # Treat None or (0, 0) Null Island coordinates as unplaced / missing coordinates
            is_null_island = (lat == 0.0 and lng == 0.0)
            has_coords = (
                lat is not None
                and lng is not None
                and not is_null_island
                and -90.0 <= lat <= 90.0
                and -180.0 <= lng <= 180.0
            )

            waypoints.append(
                RouteWaypoint(
                    point_type="stop",
                    stop_id=stop.id,
                    title=stop.stop_name,
                    location=stop.location,
                    order_index=idx,
                    latitude=lat,
                    longitude=lng,
                    has_coordinates=has_coords,
                    arrival_date=stop.arrival_date,
                    departure_date=stop.departure_date,
                )
            )

        # 3. Destination Waypoint
        dest_geo = cls.geocode_location(trip_resp.ending_location)
        dest_lat = dest_geo["lat"] if dest_geo else None
        dest_lng = dest_geo["lng"] if dest_geo else None
        has_dest_coords = dest_lat is not None and dest_lng is not None

        waypoints.append(
            RouteWaypoint(
                point_type="destination",
                stop_id=None,
                title="Destination",
                location=trip_resp.ending_location,
                order_index=len(sorted_stops) + 1,
                latitude=dest_lat,
                longitude=dest_lng,
                has_coordinates=has_dest_coords,
                country=dest_geo.get("country") if dest_geo else None,
                country_code=dest_geo.get("country_code") if dest_geo else None,
                state=dest_geo.get("state") if dest_geo else None,
                resolved_name=dest_geo.get("formatted") if dest_geo else None,
                arrival_date=trip_resp.end_date,
                departure_date=trip_resp.end_date,
            )
        )

        valid_coords = sum(1 for w in waypoints if w.has_coordinates)
        missing_coords = sum(1 for w in waypoints if not w.has_coordinates)
        has_missing_coordinates = missing_coords > 0

        # Construct journey waypoints with valid coordinates in chronological order
        placed_journey_waypoints = [
            w for w in waypoints if w.has_coordinates and w.latitude is not None and w.longitude is not None
        ]
        legs: List[RouteLeg] = []
        route_geometry: Optional[Dict[str, Any]] = None
        routing_error: Optional[str] = None

        if len(placed_journey_waypoints) < 2:
            total_distance_km = 0.0
            total_duration_minutes = 0
            calculation_method = "unavailable"
            distance_type = "unavailable"
            duration_type = "unavailable"
            is_approximate = True
            provider = "none"
            if not has_origin_coords and not has_dest_coords:
                routing_error = "Unable to calculate route: missing coordinates for origin and destination."
            elif not has_origin_coords:
                routing_error = "Unable to calculate route: missing coordinates for origin."
            elif not has_dest_coords:
                routing_error = "Unable to calculate route: missing coordinates for destination."
            else:
                routing_error = "Unable to calculate route: insufficient valid location coordinates."
        else:
            # Attempt Geoapify road routing
            geo_data = cls._fetch_geoapify_route(placed_journey_waypoints)
            geo_valid = False
            candidate_geometry = None
            geom_diag = None
            if (
                geo_data
                and "features" in geo_data
                and len(geo_data["features"]) > 0
                and "properties" in geo_data["features"][0]
            ):
                feature = geo_data["features"][0]
                props = feature.get("properties", {})
                candidate_geometry = feature.get("geometry")
                if candidate_geometry is not None:
                    geom_diag = cls._validate_and_analyze_geometry(
                        candidate_geometry, placed_journey_waypoints
                    )
                    geo_valid = geom_diag is not None
                else:
                    # Do not mark verified without verifiable route geometry
                    geo_valid = False

            if geo_valid:
                route_geometry = candidate_geometry
                dist_m = props.get("distance", 0)
                time_s = props.get("time", 0)
                total_distance_km = round(dist_m / 1000.0, 2)
                total_duration_minutes = max(1, round(time_s / 60))

                origin_wp = placed_journey_waypoints[0]
                dest_wp = placed_journey_waypoints[-1]
                logger.info(
                    f"Route verified for trip={trip_resp.id}: "
                    f"origin=({origin_wp.latitude}, {origin_wp.longitude}, {origin_wp.country}/{origin_wp.state}) -> "
                    f"dest=({dest_wp.latitude}, {dest_wp.longitude}, {dest_wp.country}/{dest_wp.state}), "
                    f"geom_start={geom_diag['first_coord']}, geom_end={geom_diag['last_coord']}, "
                    f"bbox={geom_diag['bbox']}, distance_km={total_distance_km}"
                )

                geo_legs = props.get("legs", [])
                for leg_idx in range(len(placed_journey_waypoints) - 1):
                    w1 = placed_journey_waypoints[leg_idx]
                    w2 = placed_journey_waypoints[leg_idx + 1]
                    if leg_idx < len(geo_legs):
                        l_data = geo_legs[leg_idx]
                        leg_dist = round(l_data.get("distance", 0) / 1000.0, 2)
                        leg_dur = max(1, round(l_data.get("time", 0) / 60))
                    else:
                        leg_dist = haversine_distance_km(w1.latitude, w1.longitude, w2.latitude, w2.longitude)
                        leg_dur = max(5, int((leg_dist / 60.0) * 60))

                    legs.append(
                        RouteLeg(
                            leg_index=leg_idx + 1,
                            from_title=w1.location if w1.point_type in ("origin", "destination") and w1.location else w1.title,
                            to_title=w2.location if w2.point_type in ("origin", "destination") and w2.location else w2.title,
                            from_order_index=w1.order_index,
                            to_order_index=w2.order_index,
                            distance_km=leg_dist,
                            estimated_duration_minutes=leg_dur,
                            status="available",
                        )
                    )

                calculation_method = "geoapify_roads"
                distance_type = "geoapify_road_route"
                duration_type = "geoapify_verified_duration"
                is_approximate = False
                provider = "geoapify"
            else:
                # Fallback to geodesic Haversine distance
                total_dist = 0.0
                for leg_idx in range(len(placed_journey_waypoints) - 1):
                    w1 = placed_journey_waypoints[leg_idx]
                    w2 = placed_journey_waypoints[leg_idx + 1]
                    leg_dist = haversine_distance_km(w1.latitude, w1.longitude, w2.latitude, w2.longitude)
                    total_dist += leg_dist
                    est_minutes = max(5, int((leg_dist / 60.0) * 60))
                    legs.append(
                        RouteLeg(
                            leg_index=leg_idx + 1,
                            from_title=w1.location if w1.point_type in ("origin", "destination") and w1.location else w1.title,
                            to_title=w2.location if w2.point_type in ("origin", "destination") and w2.location else w2.title,
                            from_order_index=w1.order_index,
                            to_order_index=w2.order_index,
                            distance_km=leg_dist,
                            estimated_duration_minutes=est_minutes,
                            status="available",
                        )
                    )

                total_distance_km = round(total_dist, 2)
                total_duration_minutes = max(1, int((total_distance_km / 60.0) * 60))
                calculation_method = "geodesic_haversine"
                distance_type = "haversine_straight_line"
                duration_type = "unverified_estimate"
                is_approximate = True
                provider = "haversine"

        dist_fmt = (
            f"{total_distance_km:,.1f} km"
            if total_distance_km >= 1000
            else f"{total_distance_km:.1f} km"
        )
        if total_duration_minutes <= 0:
            dur_fmt = "Unavailable" if len(placed_journey_waypoints) < 2 else "0 min"
        elif total_duration_minutes < 60:
            dur_fmt = f"{total_duration_minutes} min"
        else:
            h = total_duration_minutes // 60
            m = total_duration_minutes % 60
            dur_fmt = f"{h}h {m}m" if m > 0 else f"{h} hrs"

        summary = TripRouteSummary(
            trip_id=trip_resp.id,
            title=trip_resp.title,
            starting_location=trip_resp.starting_location,
            ending_location=trip_resp.ending_location,
            total_waypoints=len(waypoints),
            total_stops=len(sorted_stops),
            valid_coordinates_count=valid_coords,
            missing_coordinates_count=missing_coords,
            has_missing_coordinates=has_missing_coordinates,
            total_distance_km=total_distance_km,
            estimated_duration_minutes=total_duration_minutes,
            distance_formatted=dist_fmt,
            duration_formatted=dur_fmt,
            calculation_method=calculation_method,
            distance_type=distance_type,
            duration_type=duration_type,
            is_approximate=is_approximate,
            provider=provider,
            route_geometry=route_geometry,
            waypoints=waypoints,
            legs=legs,
            routing_error=routing_error,
        )

        if len(cls._route_cache) > 500:
            cls._route_cache.clear()
        cls._route_cache[cache_key] = summary

        return summary

