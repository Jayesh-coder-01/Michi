"""
Trip and TripStop Schemas
Aligned with docs/PHASE3_API_DESIGN.md and PRD Modules 3 & 4
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class TripVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class TripStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class TripCategory(str, Enum):
    SOLO_TRAVEL = "Solo travel"
    ROAD_TRIP = "Road trip"
    BACKPACKING = "Backpacking"
    FAMILY_TRIP = "Family trip"
    ADVENTURE = "Adventure"
    TREKKING = "Trekking"
    CULTURAL_EXPLORATION = "Cultural exploration"
    BEACH_VACATION = "Beach vacation"
    INTERNATIONAL_TRAVEL = "International travel"
    OTHER = "Other"


# ------------------------------------------------------------------------------
# Trip Stop Schemas
# ------------------------------------------------------------------------------

class TripStopBase(BaseModel):
    stop_name: str = Field(..., min_length=2, max_length=150, description="Name of destination/stop")
    location: str = Field(..., min_length=2, max_length=255, description="Address or geographic location")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 longitude")
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    accommodation_details: Optional[str] = Field(None, max_length=2000)
    activities: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.arrival_date and self.departure_date:
            if self.departure_date < self.arrival_date:
                raise ValueError("departure_date cannot be earlier than arrival_date")
        return self


class TripStopCreate(TripStopBase):
    pass


class TripStopUpdate(BaseModel):
    stop_name: Optional[str] = Field(None, min_length=2, max_length=150)
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    accommodation_details: Optional[str] = Field(None, max_length=2000)
    activities: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.arrival_date and self.departure_date:
            if self.departure_date < self.arrival_date:
                raise ValueError("departure_date cannot be earlier than arrival_date")
        return self


class TripStopResponse(TripStopBase):
    id: str
    trip_id: str
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TripStopReorderRequest(BaseModel):
    ordered_stop_ids: List[str] = Field(
        ...,
        description="Complete list of stop IDs in their intended sequence",
    )

    @field_validator("ordered_stop_ids")
    def validate_no_duplicates(cls, v):
        if len(v) != len(set(v)):
            raise ValueError("Duplicate stop IDs submitted in reorder sequence")
        return v


# ------------------------------------------------------------------------------
# Trip Schemas
# ------------------------------------------------------------------------------

class TripOwnerSnippet(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TripBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=150, description="Trip title")
    description: Optional[str] = Field(None, max_length=5000, description="Trip description")
    cover_image_url: Optional[str] = Field(None, description="Cover photograph URL")
    starting_location: str = Field(..., min_length=2, max_length=255, description="Origin location")
    ending_location: str = Field(..., min_length=2, max_length=255, description="Final destination")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    category: TripCategory = Field(default=TripCategory.OTHER)
    visibility: TripVisibility = Field(default=TripVisibility.PRIVATE)

    @model_validator(mode="after")
    def validate_trip_dates(self):
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end_date cannot be earlier than start_date")
        return self


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    """
    Schema for updating trip metadata.
    NOTE: 'status' is strictly excluded from TripUpdate (extra='forbid') to prevent
    unauthorized lifecycle bypass. All lifecycle transitions must use dedicated endpoints.
    """
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=3, max_length=150)
    description: Optional[str] = Field(None, max_length=5000)
    cover_image_url: Optional[str] = None
    starting_location: Optional[str] = Field(None, min_length=2, max_length=255)
    ending_location: Optional[str] = Field(None, min_length=2, max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    category: Optional[TripCategory] = None
    visibility: Optional[TripVisibility] = None

    @model_validator(mode="after")
    def validate_trip_dates(self):
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end_date cannot be earlier than start_date")
        return self


class TripPublishRequest(BaseModel):
    """Optional payload to confirm or override visibility on publication."""
    visibility: Optional[TripVisibility] = Field(
        None,
        description="Explicitly set or confirm visibility on publication ('public' or 'private'). Defaults to current trip visibility.",
    )


class TripResponse(TripBase):
    id: str
    owner_id: str
    status: TripStatus
    created_at: datetime
    updated_at: datetime
    owner: TripOwnerSnippet
    stops_count: int = 0
    stops: List[TripStopResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TripListItem(BaseModel):
    id: str
    owner_id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    starting_location: str
    ending_location: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    category: TripCategory
    visibility: TripVisibility
    status: TripStatus
    created_at: datetime
    stops_count: int = 0
    owner: TripOwnerSnippet

    model_config = ConfigDict(from_attributes=True)


class PaginatedTripList(BaseModel):
    items: List[TripListItem]
    total: int
    page: int
    page_size: int
    has_more: bool


# ------------------------------------------------------------------------------
# Route Planning & Waypoint Schemas (Phase 4)
# ------------------------------------------------------------------------------

class RouteWaypoint(BaseModel):
    point_type: str = Field(..., description="'origin', 'stop', or 'destination'")
    stop_id: Optional[str] = None
    title: str
    location: str
    order_index: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    has_coordinates: bool = True
    country: Optional[str] = None
    country_code: Optional[str] = None
    state: Optional[str] = None
    resolved_name: Optional[str] = None
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None


class RouteLeg(BaseModel):
    leg_index: int
    from_title: str
    to_title: str
    from_order_index: int
    to_order_index: int
    distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    status: str = Field(..., description="'available', 'missing_coordinates', or 'unrouted'")


class TripRouteSummary(BaseModel):
    trip_id: str
    title: str
    starting_location: str
    ending_location: str
    total_waypoints: int
    total_stops: int
    valid_coordinates_count: int
    missing_coordinates_count: int
    has_missing_coordinates: bool
    total_distance_km: float
    estimated_duration_minutes: Optional[int] = None
    distance_formatted: str
    duration_formatted: str
    calculation_method: str = Field(default="geodesic_haversine", description="'geoapify_roads' or 'geodesic_haversine'")
    distance_type: str = Field(default="haversine_straight_line", description="'geoapify_road_route' or 'haversine_straight_line'")
    duration_type: str = Field(default="unverified_estimate", description="'geoapify_verified_duration' or 'unverified_estimate'")
    is_approximate: bool = True
    provider: str = Field(default="haversine", description="'geoapify' or 'haversine'")
    route_geometry: Optional[Dict[str, Any]] = None
    waypoints: List[RouteWaypoint] = []
    legs: List[RouteLeg] = []
    routing_error: Optional[str] = None

