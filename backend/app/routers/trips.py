"""
Trips Router
Endpoints for trip creation, listing, details, editing, deleting, and lifecycle operations.
Aligned with docs/PHASE3_API_DESIGN.md Section 3 and PRD Module 3.
"""

from typing import Optional, Dict, Any
from uuid import UUID
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
from app.schemas.trip import (
    TripCreate,
    TripUpdate,
    TripPublishRequest,
    TripResponse,
    PaginatedTripList,
    TripRouteSummary,
)
from app.services.trip_service import TripService

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.post(
    "",
    response_model=APIResponse[TripResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new trip in draft status",
)
def create_trip(
    req: TripCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    created = TripService.create_trip(db, current_user.id, req)
    return APIResponse(data=created)


@router.get(
    "",
    response_model=APIResponse[PaginatedTripList],
    summary="List all trips owned by the authenticated user",
)
def list_my_trips(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by draft, published, archived"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    result = TripService.list_my_trips(
        db,
        owner_id=current_user.id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )
    return APIResponse(data=result)


@router.get(
    "/public",
    response_model=APIResponse[PaginatedTripList],
    summary="List public, published trips for community explore",
)
def list_public_trips(
    category: Optional[str] = Query(None, description="Optional category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db_for_optional_user),
):
    result = TripService.list_public_trips(
        db,
        category=category,
        page=page,
        page_size=page_size,
    )
    return APIResponse(data=result)


@router.get(
    "/geocode",
    response_model=APIResponse[Optional[Dict[str, Any]]],
    summary="Geocode a location name server-side via Geoapify without exposing API keys",
)
def geocode_location(
    q: str = Query(..., min_length=1, max_length=255, description="Location name to geocode"),
):
    result = TripService.geocode_location(q)
    return APIResponse(data=result)


@router.get(
    "/{trip_id}",
    response_model=APIResponse[TripResponse],
    summary="Get trip details, stops, and timeline",
)
def get_trip_details(
    trip_id: str,
    optional_user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db_for_optional_user),
):
    user_id = optional_user.id if optional_user else None
    trip = TripService.get_trip(db, str(trip_id), current_user_id=user_id)
    return APIResponse(data=trip)


@router.get(
    "/{trip_id}/route",
    response_model=APIResponse[TripRouteSummary],
    summary="Get calculated route summary, waypoints, and metrics for a journey",
)
def get_trip_route(
    trip_id: str,
    optional_user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db_for_optional_user),
):
    user_id = optional_user.id if optional_user else None
    route_summary = TripService.get_trip_route(db, str(trip_id), current_user_id=user_id)
    return APIResponse(data=route_summary)


@router.patch(
    "/{trip_id}",
    response_model=APIResponse[TripResponse],
    summary="Update trip metadata (status changes strictly forbidden in PATCH)",
)
def update_trip(
    trip_id: str,
    req: TripUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    updated = TripService.update_trip(db, str(trip_id), current_user.id, req)
    return APIResponse(data=updated)


@router.delete(
    "/{trip_id}",
    response_model=APIResponse[Dict[str, Any]],
    summary="Permanently delete a trip and all its stops",
)
def delete_trip(
    trip_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    result = TripService.delete_trip(db, str(trip_id), current_user.id)
    return APIResponse(data=result)


# ------------------------------------------------------------------------------
# Lifecycle Transitions (Strictly Dedicated Endpoints)
# ------------------------------------------------------------------------------

@router.post(
    "/{trip_id}/publish",
    response_model=APIResponse[TripResponse],
    summary="Publish a draft trip after validating publishing checklist",
)
def publish_trip(
    trip_id: str,
    req: Optional[TripPublishRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    published = TripService.publish_trip(db, str(trip_id), current_user.id, req)
    return APIResponse(data=published)


@router.post(
    "/{trip_id}/archive",
    response_model=APIResponse[TripResponse],
    summary="Archive a published trip",
)
def archive_trip(
    trip_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    archived = TripService.archive_trip(db, str(trip_id), current_user.id)
    return APIResponse(data=archived)


@router.post(
    "/{trip_id}/restore",
    response_model=APIResponse[TripResponse],
    summary="Restore an archived trip back to published status",
)
def restore_trip(
    trip_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    restored = TripService.restore_trip(db, str(trip_id), current_user.id)
    return APIResponse(data=restored)


@router.post(
    "/{trip_id}/unpublish",
    response_model=APIResponse[TripResponse],
    summary="Revert a published or archived trip back to draft status for revisions",
)
def unpublish_trip(
    trip_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    drafted = TripService.unpublish_trip(db, str(trip_id), current_user.id)
    return APIResponse(data=drafted)
