-- ==============================================================================
-- MICHI (道) — Phase 2: Database Migration
-- Table: public.profiles & Auth Provisioning Trigger
-- Aligned with PRD v1.0 Module 2 & docs/DATABASE.md Section 3.1
-- ==============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    cover_image_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    social_links JSONB DEFAULT '{}'::jsonb,
    is_ai_chatbot_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Policy 1: Anyone can view public profiles
DROP POLICY IF EXISTS "Public profiles are readable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are readable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

-- Policy 2: Users can update only their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy 4: Users can delete their own profile
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

-- 6. Secure Public Profile View (Column-level security for public reads)
-- Restricts public/anon access to explicitly safe public columns,
-- preventing leakage of internal fields, timestamps, or future sensitive settings.
CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT 
    id,
    username,
    display_name,
    avatar_url,
    cover_image_url,
    bio,
    location,
    social_links,
    is_ai_chatbot_enabled,
    created_at
FROM public.profiles;

-- Column-Level Access Control:
-- Revoke full table SELECT from both anon and authenticated to prevent direct querying of internal/excluded columns
REVOKE SELECT ON public.profiles FROM anon, authenticated;

-- Grant column-specific SELECT to anon and authenticated only on the approved public columns
GRANT SELECT (id, username, display_name, avatar_url, cover_image_url, bio, location, social_links, is_ai_chatbot_enabled, created_at)
    ON public.profiles TO anon, authenticated;

-- Grant authenticated users write operations (strictly governed by RLS policies)
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Grant view access to both anon and authenticated
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 7. Updated_at automatic timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. Automatic Profile Provisioning Trigger on Signup
-- Handles user registration from Supabase Auth (Email or OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_username TEXT;
    final_username TEXT;
    raw_display_name TEXT;
    counter INT := 0;
BEGIN
    -- Extract or default display name
    raw_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Extract or derive base username
    raw_username := LOWER(COALESCE(
        NEW.raw_user_meta_data->>'username',
        REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9_.]', '', 'g')
    ));

    IF LENGTH(raw_username) < 3 THEN
        raw_username := 'traveller_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 6);
    END IF;

    -- Ensure username uniqueness
    final_username := raw_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
        counter := counter + 1;
        final_username := raw_username || counter::TEXT;
    END LOOP;

    -- Insert initial profile
    INSERT INTO public.profiles (
        id,
        username,
        display_name,
        avatar_url,
        cover_image_url,
        bio,
        location,
        is_ai_chatbot_enabled
    ) VALUES (
        NEW.id,
        final_username,
        raw_display_name,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        NULL,
        NULL,
        NULL,
        TRUE
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution after auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
