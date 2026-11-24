"""
Profile Schemas
Aligned with docs/DATABASE.md Section 3.1 & docs/API.md Section 2.1
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
import re


class ProfileBase(BaseModel):
    username: str
    display_name: str
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    social_links: Dict[str, Any] = Field(default_factory=dict)
    is_ai_chatbot_enabled: bool = True


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    username: Optional[str] = Field(None, min_length=3, max_length=32)
    bio: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        clean = v.strip().lower()
        if not re.match(r"^[a-z0-9_.]+$", clean):
            raise ValueError("Username can only contain lowercase letters, numbers, underscores, and periods")
        return clean


class ProfileStats(BaseModel):
    published_trips_count: int = 0
    drafts_count: Optional[int] = 0
    followers_count: int = 0
    following_count: int = 0


class ProfileResponse(ProfileBase):
    id: str
    created_at: datetime
    updated_at: datetime
    stats: ProfileStats = Field(default_factory=ProfileStats)

    model_config = {"from_attributes": True}


class UsernameCheckResponse(BaseModel):
    username: str
    available: bool
    message: str


class AISettingsUpdate(BaseModel):
    is_ai_chatbot_enabled: bool
