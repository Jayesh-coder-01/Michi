"""
Profile Model
Matches public.profiles schema from docs/DATABASE.md Section 3.1
id UUID is the primary key and corresponds 1:1 to Supabase auth.users(id)
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON, event, text
from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True)
    username = Column(String(32), unique=True, index=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(Text, nullable=True)
    cover_image_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    social_links = Column(JSON, default=dict, nullable=False)
    is_ai_chatbot_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


@event.listens_for(Profile.__table__, "after_create")
def _create_sqlite_rls_triggers(target, connection, **kw):
    """
    On SQLite databases, create triggers mirroring Supabase Row Level Security (RLS) policies:
    1. Users can update only their own profile (auth.uid() = id).
    2. Users can delete only their own profile (auth.uid() = id).
    """
    if connection.dialect.name == "sqlite":
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS enforce_profiles_rls_update
            BEFORE UPDATE ON profiles
            FOR EACH ROW
            WHEN auth_uid() IS NOT NULL AND auth_uid() != OLD.id
            BEGIN
                SELECT RAISE(ABORT, 'RLS policy violation: users can update only their own profile');
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS enforce_profiles_rls_delete
            BEFORE DELETE ON profiles
            FOR EACH ROW
            WHEN auth_uid() IS NOT NULL AND auth_uid() != OLD.id
            BEGIN
                SELECT RAISE(ABORT, 'RLS policy violation: users can delete only their own profile');
            END;
        """))
