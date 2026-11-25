-- ==============================================================================
-- MICHI (道) — Phase 3: Rollback / Down Migration
-- Migration ID: 20261125000000_phase3_trips_stops_down.sql
-- Purpose: Safely teardown Phase 3 tables, triggers, functions, and custom types
--          without using CASCADE, protecting unrelated dependent objects.
-- ==============================================================================

-- 1. Safely Drop Triggers (guarding against already-absent tables)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'trip_stops'
    ) THEN
        DROP TRIGGER IF EXISTS check_stop_trip_immutable ON public.trip_stops;
        DROP TRIGGER IF EXISTS set_trip_stops_updated_at ON public.trip_stops;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'trips'
    ) THEN
        DROP TRIGGER IF EXISTS set_trips_updated_at ON public.trips;
    END IF;
END $$;

-- 2. Drop Stop Immutability Trigger Function
DROP FUNCTION IF EXISTS public.prevent_stop_trip_reassignment();
-- Note: public.handle_updated_at() is PRESERVED because it is owned by Phase 2 (public.profiles)

-- 3. Drop Tables (in strict foreign-key dependency order, WITHOUT CASCADE)
-- Child table dropped first to eliminate foreign key references to public.trips
DROP TABLE IF EXISTS public.trip_stops;
-- Parent table dropped second
DROP TABLE IF EXISTS public.trips;

-- 4. Drop Schema-Qualified Custom ENUM Types (WITHOUT CASCADE)
DROP TYPE IF EXISTS public.trip_status;
DROP TYPE IF EXISTS public.trip_visibility;
