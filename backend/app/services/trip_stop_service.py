"""
Trip Stop Service
Handles trip stops CRUD and atomic collision-free reordering using the Two-Phase Positive Disjoint Offset algorithm.
Aligned with PRD Module 4 and docs/PHASE3_API_DESIGN.md Section 4
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.trip import Trip, TripStop
from app.services.trip_service import TripService
from app.schemas.trip import (
    TripStopCreate,
    TripStopUpdate,
    TripStopResponse,
    TripStopReorderRequest,
)

SAFE_MAX_ORDER_INDEX = 1_000_000_000


class TripStopService:
    @classmethod
    def list_stops(
        cls,
        db: Session,
        trip_id: str,
        current_user_id: Optional[str] = None,
    ) -> List[TripStopResponse]:
        """Retrieve all stops for a trip in chronological order_index sequence, enforcing trip visibility."""
        # Validates trip existence and readability
        TripService.get_trip(db, trip_id, current_user_id)

        stops = (
            db.query(TripStop)
            .filter(TripStop.trip_id == str(trip_id))
            .order_by(TripStop.order_index.asc())
            .all()
        )
        return [TripStopResponse.model_validate(s) for s in stops]

    @classmethod
    def add_stop(
        cls,
        db: Session,
        trip_id: str,
        owner_id: str,
        req: TripStopCreate,
    ) -> TripStopResponse:
        """
        Append a new waypoint to the journey.
        Acquires exclusive pessimistic lock on parent trip to serialize concurrent additions
        and prevent order_index race conditions.
        """
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
                detail="You do not have permission to add stops to this trip.",
            )

        # Compute next sequential order_index
        max_idx = (
            db.query(func.max(TripStop.order_index))
            .filter(TripStop.trip_id == str(trip_id))
            .scalar()
        )
        next_idx = 0 if max_idx is None else max_idx + 1

        stop = TripStop(
            trip_id=str(trip_id),
            stop_name=req.stop_name.strip(),
            location=req.location.strip(),
            latitude=req.latitude,
            longitude=req.longitude,
            arrival_date=req.arrival_date,
            departure_date=req.departure_date,
            accommodation_details=req.accommodation_details,
            activities=req.activities,
            notes=req.notes,
            order_index=next_idx,
        )
        try:
            db.add(stop)
            db.commit()
            db.refresh(stop)
        except Exception:
            db.rollback()
            raise
        return TripStopResponse.model_validate(stop)

    @classmethod
    def update_stop(
        cls,
        db: Session,
        trip_id: str,
        stop_id: str,
        owner_id: str,
        req: TripStopUpdate,
    ) -> TripStopResponse:
        """
        Update stop details, coordinates, activities, or notes.
        Verifies trip ownership and rejects foreign stop IDs.
        """
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
                detail="You do not have permission to update stops in this trip.",
            )

        stop = db.query(TripStop).filter(TripStop.id == str(stop_id)).first()
        if not stop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stop does not exist.",
            )

        if str(stop.trip_id) != str(trip_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stop does not belong to this trip.",
            )

        update_data = req.model_dump(exclude_unset=True)

        # Validate dates against existing if only one date updated
        new_arrival = update_data.get("arrival_date", stop.arrival_date)
        new_departure = update_data.get("departure_date", stop.departure_date)
        if new_arrival and new_departure and new_departure < new_arrival:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="departure_date cannot be earlier than arrival_date",
            )

        try:
            for key, val in update_data.items():
                if hasattr(stop, key):
                    setattr(stop, key, val)

            db.commit()
            db.refresh(stop)
        except Exception:
            db.rollback()
            raise
        return TripStopResponse.model_validate(stop)

    @classmethod
    def delete_stop(
        cls,
        db: Session,
        trip_id: str,
        stop_id: str,
        owner_id: str,
    ) -> Dict[str, Any]:
        """
        Remove a stop and normalize order_index for subsequent stops.
        Acquires exclusive pessimistic lock on parent trip.
        """
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
                detail="You do not have permission to delete stops from this trip.",
            )

        stop = db.query(TripStop).filter(TripStop.id == str(stop_id)).first()
        if not stop or str(stop.trip_id) != str(trip_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stop does not belong to this trip.",
            )

        try:
            deleted_idx = stop.order_index
            db.delete(stop)
            db.flush()

            # Re-index subsequent stops to maintain contiguous 0..N-1 sequence
            db.query(TripStop).filter(
                TripStop.trip_id == str(trip_id),
                TripStop.order_index > deleted_idx,
            ).update(
                {TripStop.order_index: TripStop.order_index - 1},
                synchronize_session="fetch",
            )

            db.commit()
            return {"deleted": True, "id": str(stop_id)}
        except Exception:
            db.rollback()
            raise

    @classmethod
    def reorder_stops(
        cls,
        db: Session,
        trip_id: str,
        owner_id: str,
        ordered_stop_ids: List[UUID],
    ) -> List[TripStopResponse]:
        """
        Batch reorder stops atomically using the Two-Phase Positive Disjoint Offset Algorithm.
        Enforces parent pessimistic locking, duplicate rejection, omission checks,
        foreign ID rejection, empty stop list safety, and overflow guards.
        """
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
                detail="You do not have permission to reorder stops in this trip.",
            )

        existing_stops = (
            db.query(TripStop)
            .filter(TripStop.trip_id == str(trip_id))
            .all()
        )
        existing_id_set = {str(s.id) for s in existing_stops}
        submitted_id_list = [str(sid) for sid in ordered_stop_ids]

        # 1. Duplicate check (guard against payload bypass)
        if len(submitted_id_list) != len(set(submitted_id_list)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Duplicate stop IDs submitted in reorder sequence.",
            )

        # 2. Empty list handling & count match
        if len(existing_stops) == 0:
            if len(submitted_id_list) == 0:
                # Idempotent no-op for empty trip
                return []
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Trip currently has no stops. Submitted stop IDs do not belong to this trip.",
            )

        if len(submitted_id_list) != len(existing_stops):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Incomplete stop sequence. Submitted {len(submitted_id_list)} stops, but trip has {len(existing_stops)} stops.",
            )

        # 3. Foreign / missing checks
        submitted_id_set = set(submitted_id_list)
        foreign_ids = submitted_id_set - existing_id_set
        if foreign_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Submitted stop sequence contains foreign or non-existent stops: {list(foreign_ids)}",
            )

        missing_ids = existing_id_set - submitted_id_set
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Submitted stop sequence omits existing trip stops: {list(missing_ids)}",
            )

        # 4. Overflow guard
        current_max = (
            db.query(func.max(TripStop.order_index))
            .filter(TripStop.trip_id == str(trip_id))
            .scalar()
            or 0
        )
        if current_max > SAFE_MAX_ORDER_INDEX:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="order_index exceeds safe calculation threshold.",
            )

        # ----------------------------------------------------------------------
        # Two-Phase Positive Disjoint Offset Algorithm
        # ----------------------------------------------------------------------
        safe_offset = current_max + 1000

        try:
            # Phase 1: Shift existing stops to disjoint positive range
            db.query(TripStop).filter(TripStop.trip_id == str(trip_id)).update(
                {TripStop.order_index: TripStop.order_index + safe_offset},
                synchronize_session="fetch",
            )
            db.flush()

            # Phase 2: Assign final sequential indices 0..N-1
            for target_idx, stop_id_str in enumerate(submitted_id_list):
                db.query(TripStop).filter(
                    TripStop.id == stop_id_str,
                    TripStop.trip_id == str(trip_id),
                ).update(
                    {TripStop.order_index: target_idx},
                    synchronize_session="fetch",
                )
            db.flush()

            db.commit()
        except Exception:
            db.rollback()
            raise

        # Fetch and return final ordered stops
        reordered_stops = (
            db.query(TripStop)
            .filter(TripStop.trip_id == str(trip_id))
            .order_by(TripStop.order_index.asc())
            .all()
        )
        return [TripStopResponse.model_validate(s) for s in reordered_stops]
