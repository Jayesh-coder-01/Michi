-- ==============================================================================
-- MICHI (道) — Phase 3: Database Migration
-- Tables: public.trips & public.trip_stops
-- Aligned with PRD Modules 3 & 4 and docs/DATABASE.md Sections 3.2 & 3.3
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Prerequisite & Pre-flight Drift Verification
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- 1.1 Verify Phase 2 public.profiles table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        RAISE EXCEPTION 'Prerequisite failed: public.profiles table does not exist. Ensure Phase 2 migrations (20261124000000_phase2_auth_profiles.sql) have been applied before running Phase 3.';
    END IF;

    -- 1.2 Verify Phase 2 public.handle_updated_at() trigger function exists with exact signature:
    -- zero arguments (pronargs = 0) and returning trigger (prorettype = 'trigger'::regtype)
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.proname = 'handle_updated_at'
          AND p.pronargs = 0
          AND p.prorettype = 'trigger'::regtype
    ) THEN
        RAISE EXCEPTION 'Prerequisite failed: public.handle_updated_at() trigger function (0 arguments, RETURNS trigger) does not exist. Ensure Phase 2 migrations have been applied before running Phase 3.';
    END IF;

    -- 1.3 Verify target tables do not already exist to prevent silent schema drift
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'trips'
    ) THEN
        RAISE EXCEPTION 'Pre-flight check failed: table public.trips already exists prior to migration. Aborting to prevent silent schema drift.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'trip_stops'
    ) THEN
        RAISE EXCEPTION 'Pre-flight check failed: table public.trip_stops already exists prior to migration. Aborting to prevent silent schema drift.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Schema-Qualified Custom ENUM Types with Drift Verification
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    existing_labels text[];
BEGIN
    -- 2.1 public.trip_visibility
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'trip_visibility'
    ) THEN
        -- Verify it is actually an enum type ('e')
        IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typname = 'trip_visibility' AND t.typtype = 'e'
        ) THEN
            RAISE EXCEPTION 'Schema conflict: object public.trip_visibility exists but is not an enum type.';
        END IF;

        SELECT ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder)
        INTO existing_labels
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public' AND t.typname = 'trip_visibility';

        IF existing_labels IS DISTINCT FROM ARRAY['public', 'private']::text[] THEN
            RAISE EXCEPTION 'Schema drift detected: type public.trip_visibility exists but with invalid labels: % (expected: {public,private})', existing_labels;
        END IF;
    ELSE
        CREATE TYPE public.trip_visibility AS ENUM ('public', 'private');
    END IF;

    -- 2.2 public.trip_status
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'trip_status'
    ) THEN
        -- Verify it is actually an enum type ('e')
        IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typname = 'trip_status' AND t.typtype = 'e'
        ) THEN
            RAISE EXCEPTION 'Schema conflict: object public.trip_status exists but is not an enum type.';
        END IF;

        SELECT ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder)
        INTO existing_labels
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public' AND t.typname = 'trip_status';

        IF existing_labels IS DISTINCT FROM ARRAY['draft', 'published', 'archived']::text[] THEN
            RAISE EXCEPTION 'Schema drift detected: type public.trip_status exists but with invalid labels: % (expected: {draft,published,archived})', existing_labels;
        END IF;
    ELSE
        CREATE TYPE public.trip_status AS ENUM ('draft', 'published', 'archived');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Create public.trips Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    starting_location VARCHAR(255) NOT NULL,
    ending_location VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    category VARCHAR(50) DEFAULT 'Other' NOT NULL,
    visibility public.trip_visibility DEFAULT 'private'::public.trip_visibility NOT NULL,
    status public.trip_status DEFAULT 'draft'::public.trip_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT valid_category CHECK (category IN (
        'Solo travel', 'Road trip', 'Backpacking', 'Family trip', 'Adventure',
        'Trekking', 'Cultural exploration', 'Beach vacation', 'International travel', 'Other'
    ))
);

-- ------------------------------------------------------------------------------
-- 4. Create public.trip_stops Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.trip_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    stop_name VARCHAR(150) NOT NULL,
    location VARCHAR(255) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    arrival_date DATE,
    departure_date DATE,
    accommodation_details TEXT,
    activities TEXT,
    notes TEXT,
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT valid_lat CHECK (latitude BETWEEN -90.0000000 AND 90.0000000),
    CONSTRAINT valid_lng CHECK (longitude BETWEEN -180.0000000 AND 180.0000000),
    CONSTRAINT valid_stop_dates CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date),
    CONSTRAINT valid_order_index CHECK (order_index >= 0),
    CONSTRAINT uq_trip_stops_trip_order UNIQUE (trip_id, order_index) DEFERRABLE INITIALLY DEFERRED
);

-- ------------------------------------------------------------------------------
-- 5. Indexes for Performance and Feed Discovery
-- ------------------------------------------------------------------------------
-- Note: uq_trip_stops_trip_order already provides a B-Tree index on (trip_id, order_index);
-- no redundant index is created on trip_stops.
CREATE INDEX idx_trips_owner_id ON public.trips(owner_id);
CREATE INDEX idx_trips_visibility_status ON public.trips(visibility, status);
CREATE INDEX idx_trips_created_at ON public.trips(created_at DESC);

-- ------------------------------------------------------------------------------
-- 6. Attach Updated_at Triggers (Reusing Phase 2 Function)
-- ------------------------------------------------------------------------------
CREATE TRIGGER set_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_trip_stops_updated_at
    BEFORE UPDATE ON public.trip_stops
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. Immutable trip_id Trigger for Stops
-- ------------------------------------------------------------------------------
CREATE FUNCTION public.prevent_stop_trip_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
        RAISE EXCEPTION 'trip_id cannot be modified on an existing stop';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER check_stop_trip_immutable
    BEFORE UPDATE ON public.trip_stops
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_stop_trip_reassignment();

-- ------------------------------------------------------------------------------
-- 8. Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 9. RLS Policies for public.trips
-- ------------------------------------------------------------------------------
-- Policy 1: Anyone (including anon) can view public published trips, or owners can view any of their own trips
CREATE POLICY "Public trips are readable by everyone"
    ON public.trips FOR SELECT
    USING ((visibility = 'public' AND status = 'published') OR (auth.uid() = owner_id));

-- Policy 2: Owners can create trips (assigned to their own owner_id)
CREATE POLICY "Owners can create trips"
    ON public.trips FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Policy 3: Owners can update their own trips
CREATE POLICY "Owners can update their own trips"
    ON public.trips FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Policy 4: Owners can delete their own trips
CREATE POLICY "Owners can delete their own trips"
    ON public.trips FOR DELETE
    USING (auth.uid() = owner_id);

-- ------------------------------------------------------------------------------
-- 10. RLS Policies for public.trip_stops
-- ------------------------------------------------------------------------------
-- Policy 1: Stops are readable if the parent trip is readable by the caller
CREATE POLICY "Stops readable if parent trip is readable"
    ON public.trip_stops FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id
        AND ((t.visibility = 'public' AND t.status = 'published') OR (t.owner_id = auth.uid()))
    ));

-- Policy 2: Only the owner of the parent trip can insert stops
CREATE POLICY "Owners can add stops to their trips"
    ON public.trip_stops FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id AND t.owner_id = auth.uid()
    ));

-- Policy 3: Only the owner of the parent trip can update stops
CREATE POLICY "Owners can update stops in their trips"
    ON public.trip_stops FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id AND t.owner_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id AND t.owner_id = auth.uid()
    ));

-- Policy 4: Only the owner of the parent trip can delete stops
CREATE POLICY "Owners can delete stops in their trips"
    ON public.trip_stops FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id AND t.owner_id = auth.uid()
    ));

-- ------------------------------------------------------------------------------
-- 11. Configure Grants (Principle of Least Privilege)
-- ------------------------------------------------------------------------------
-- 11.1 Explicit privilege cleanup: Revoke existing table privileges
REVOKE ALL ON TABLE public.trips FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.trip_stops FROM PUBLIC, anon, authenticated, service_role;

-- 11.2 Grant intended permissions
-- Anon role: Read-only access to published public trips and their stops
GRANT SELECT ON TABLE public.trips TO anon;
GRANT SELECT ON TABLE public.trip_stops TO anon;

-- Authenticated role: Full CRUD on trips and stops (strictly governed by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_stops TO authenticated;

-- Service role: Superuser access for maintenance and migrations
GRANT ALL ON TABLE public.trips TO service_role;
GRANT ALL ON TABLE public.trip_stops TO service_role;
