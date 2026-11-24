"""
Trip and TripStop Models
Aligned with docs/DATABASE.md Sections 3.2 & 3.3 and Phase 3 Database Migration
(20261125000000_phase3_trips_stops.sql)
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Date,
    DateTime,
    Numeric,
    Integer,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(
        String(36),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(Text, nullable=True)
    starting_location = Column(String(255), nullable=False)
    ending_location = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    category = Column(String(50), default="Other", nullable=False)
    visibility = Column(String(20), default="private", nullable=False)
    status = Column(String(20), default="draft", nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="valid_dates",
        ),
        CheckConstraint(
            "category IN ('Solo travel', 'Road trip', 'Backpacking', 'Family trip', "
            "'Adventure', 'Trekking', 'Cultural exploration', 'Beach vacation', "
            "'International travel', 'Other')",
            name="valid_category",
        ),
    )

    # Relationships
    owner = relationship("Profile", backref="trips", lazy="joined")
    stops = relationship(
        "TripStop",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripStop.order_index",
    )


class TripStop(Base):
    __tablename__ = "trip_stops"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id = Column(
        String(36),
        ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stop_name = Column(String(150), nullable=False)
    location = Column(String(255), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    arrival_date = Column(Date, nullable=True)
    departure_date = Column(Date, nullable=True)
    accommodation_details = Column(Text, nullable=True)
    activities = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("trip_id", "order_index", name="uq_trip_stops_trip_order"),
        CheckConstraint(
            "latitude BETWEEN -90.0000000 AND 90.0000000",
            name="valid_lat",
        ),
        CheckConstraint(
            "longitude BETWEEN -180.0000000 AND 180.0000000",
            name="valid_lng",
        ),
        CheckConstraint(
            "departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date",
            name="valid_stop_dates",
        ),
        CheckConstraint("order_index >= 0", name="valid_order_index"),
    )

    # Relationships
    trip = relationship("Trip", back_populates="stops")


@event.listens_for(Trip.__table__, "after_create")
def _create_sqlite_trips_triggers(target, connection, **kw):
    """
    On SQLite databases, create triggers mirroring Supabase Row Level Security (RLS) policies:
    1. Only the owner can update their trip.
    2. Only the owner can delete their trip.
    """
    if connection.dialect.name == "sqlite":
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS enforce_trips_rls_update
            BEFORE UPDATE ON trips
            FOR EACH ROW
            WHEN auth_uid() IS NOT NULL AND auth_uid() != OLD.owner_id
            BEGIN
                SELECT RAISE(ABORT, 'RLS policy violation: users can update only their own trips');
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS enforce_trips_rls_delete
            BEFORE DELETE ON trips
            FOR EACH ROW
            WHEN auth_uid() IS NOT NULL AND auth_uid() != OLD.owner_id
            BEGIN
                SELECT RAISE(ABORT, 'RLS policy violation: users can delete only their own trips');
            END;
        """))


@event.listens_for(TripStop.__table__, "after_create")
def _create_sqlite_trip_stops_triggers(target, connection, **kw):
    """
    On SQLite databases, create triggers mirroring:
    1. Immutable trip_id protection (prevent_stop_trip_reassignment trigger).
    2. Parent trip ownership checks for update/delete.
    """
    if connection.dialect.name == "sqlite":
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS check_stop_trip_immutable
            BEFORE UPDATE ON trip_stops
            FOR EACH ROW
            WHEN NEW.trip_id != OLD.trip_id
            BEGIN
                SELECT RAISE(ABORT, 'trip_id cannot be modified on an existing stop');
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS enforce_trip_stops_rls_update
            BEFORE UPDATE ON trip_stops
            FOR EACH ROW
            WHEN auth_uid() IS NOT NULL AND (SELECT owner_id FROM trips WHERE id = OLD.trip_id) != auth_uid()
            BEGIN
                SELECT RAISE(ABORT, 'RLS policy violation: only trip owner can update stops');
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS enforce_trip_stops_rls_delete
            BEFORE DELETE ON trip_stops
            FOR EACH ROW
            WHEN auth_uid() IS NOT NULL AND (SELECT owner_id FROM trips WHERE id = OLD.trip_id) != auth_uid()
            BEGIN
                SELECT RAISE(ABORT, 'RLS policy violation: only trip owner can delete stops');
            END;
        """))
