"""
Trip Service
Handles trip creation, updates, queries, and lifecycle state transitions
Aligned with PRD Module 3 and docs/PHASE3_API_DESIGN.md Section 3
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

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
)


class TripService:
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
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
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

        trip.status = TripStatus.PUBLISHED.value
        db.commit()
        db.refresh(trip)
        return cls._to_trip_response(trip)

    @classmethod
    def archive_trip(cls, db: Session, trip_id: str, owner_id: str) -> TripResponse:
        """Transition a published journey to archived status."""
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
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

        trip.status = TripStatus.ARCHIVED.value
        db.commit()
        db.refresh(trip)
        return cls._to_trip_response(trip)

    @classmethod
    def restore_trip(cls, db: Session, trip_id: str, owner_id: str) -> TripResponse:
        """Restore an archived journey back to published status after re-verifying publishing criteria."""
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
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

        trip.status = TripStatus.PUBLISHED.value
        db.commit()
        db.refresh(trip)
        return cls._to_trip_response(trip)

    @classmethod
    def unpublish_trip(cls, db: Session, trip_id: str, owner_id: str) -> TripResponse:
        """Transition a published or archived journey back to draft for revisions."""
        trip = db.query(Trip).filter(Trip.id == str(trip_id)).first()
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

        trip.status = TripStatus.DRAFT.value
        db.commit()
        db.refresh(trip)
        return cls._to_trip_response(trip)
