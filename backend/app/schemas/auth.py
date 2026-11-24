"""
Authentication Schemas
Session and Token Inspection Schemas for Supabase Auth
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel


class SessionUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "authenticated"
    claims: Dict[str, Any] = {}
