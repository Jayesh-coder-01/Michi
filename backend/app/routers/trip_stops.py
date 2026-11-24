"""
Trip Stops Router
Endpoints for adding, editing, deleting, listing, and batch-reordering stops within a trip.
Aligned with docs/PHASE3_API_DESIGN.md Section 4 and PRD Module 4.
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status
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
    TripStopCreate,
    TripStopUpdate,
    TripStopResponse,
    TripStopReorderRequest,
)
from app.services.trip_stop_service import TripStopService

router = APIRouter(prefix="/trips/{trip_id}/stops", tags=["Trip Stops"])


@router.get(
    "",
    response_model=APIResponse[List[TripStopResponse]],
    summary="List all stops for a trip in chronological order",
)
def list_stops(
    trip_id: str,
    optional_user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db_for_optional_user),
):
    user_id = optional_user.id if optional_user else None
    stops = TripStopService.list_stops(db, str(trip_id), current_user_id=user_id)
    return APIResponse(data=stops)


@router.post(
    "",
    response_model=APIResponse[TripStopResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Add a new stop to a trip (auto-assigns sequential order_index under parent lock)",
)
def add_stop(
    trip_id: str,
    req: TripStopCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    created = TripStopService.add_stop(db, str(trip_id), current_user.id, req)
    return APIResponse(data=created)


@router.patch(
    "/{stop_id}",
    response_model=APIResponse[TripStopResponse],
    summary="Update details, dates, coordinates, or notes for a stop",
)
def update_stop(
    trip_id: str,
    stop_id: str,
    req: TripStopUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    updated = TripStopService.update_stop(
        db,
        trip_id=str(trip_id),
        stop_id=str(stop_id),
        owner_id=current_user.id,
        req=req,
    )
    return APIResponse(data=updated)


@router.delete(
    "/{stop_id}",
    response_model=APIResponse[Dict[str, Any]],
    summary="Remove a stop from a trip and re-index subsequent stops",
)
def delete_stop(
    trip_id: str,
    stop_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    result = TripStopService.delete_stop(
        db,
        trip_id=str(trip_id),
        stop_id=str(stop_id),
        owner_id=current_user.id,
    )
    return APIResponse(data=result)


@router.put(
    "/reorder",
    response_model=APIResponse[List[TripStopResponse]],
    summary="Batch reorder stops atomically using the Two-Phase Positive Disjoint Offset Algorithm",
)
@router.post(
    "/reorder",
    response_model=APIResponse[List[TripStopResponse]],
    summary="Batch reorder stops atomically using the Two-Phase Positive Disjoint Offset Algorithm (POST alias)",
)
def reorder_stops(
    trip_id: str,
    req: TripStopReorderRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db_for_authenticated_user),
):
    reordered = TripStopService.reorder_stops(
        db,
        trip_id=str(trip_id),
        owner_id=current_user.id,
        ordered_stop_ids=req.ordered_stop_ids,
    )
    return APIResponse(data=reordered)
