-- ==============================================================================
-- Migration: Google OAuth Profile Synchronization & Name Mapping
-- Migration ID: 20261124010000_google_oauth_profile_sync
-- Purpose:
--   1. Update handle_new_user() trigger to map Google OAuth metadata correctly
--      using the strict 4-tier metadata priority:
--        Tier 1: full_name (Google account full name)
--        Tier 2: name (Google OIDC standard claim alias)
--        Tier 3: email prefix (fallback before generic placeholder)
--        Tier 4: 'New Traveller' (final fallback if no usable string)
--   2. Map avatar_url from avatar_url or picture claims.
--   3. Keep username generation separate from display-name generation.
--   4. Safely backfill existing profiles that hold default "New Traveller"
--      WITHOUT overwriting any manually customized display names or avatars.
-- ==============================================================================

-- 1. Upgrade handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_username TEXT;
    final_username TEXT;
    raw_display_name TEXT;
    counter INT := 0;
BEGIN
    -- Extract display name using strict 4-tier metadata priority:
    -- Tier 1: full_name
    -- Tier 2: name
    -- Tier 3: Email prefix
    -- Tier 4: 'New Traveller' (fallback)
    raw_display_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(SPLIT_PART(NEW.email, '@', 1)), ''),
        'New Traveller'
    );

    -- Extract or derive base username (strictly separate from display name)
    raw_username := LOWER(COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
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

    -- Insert initial profile with resolved display name and avatar
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
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
            NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'), ''),
            NULL
        ),
        NULL,
        NULL,
        NULL,
        TRUE
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Safe Backfill for Existing Profiles
-- Updates existing profiles holding default "New Traveller" without overwriting customized names or avatars
UPDATE public.profiles p
SET 
    display_name = COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(SPLIT_PART(u.email, '@', 1)), ''),
        p.display_name
    ),
    avatar_url = COALESCE(
        p.avatar_url,
        NULLIF(TRIM(u.raw_user_meta_data->>'avatar_url'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'picture'), '')
    )
FROM auth.users u
WHERE p.id = u.id
  AND (p.display_name = 'New Traveller' OR p.display_name IS NULL OR TRIM(p.display_name) = '');
