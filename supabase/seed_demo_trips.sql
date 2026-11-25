-- ==============================================================================
-- MICHI (道) — Presentation Demo Seed Script for Supabase (PostgreSQL)
-- Run this in Supabase Dashboard -> SQL Editor to populate 4 demo travellers
-- and 5 public, published demo trips with 22 stops for the Explore page.
-- Idempotent: safe to run multiple times.
-- ==============================================================================

BEGIN;

-- 1. Ensure demo users exist in auth.users (required by public.profiles FK)
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'kenji@michi.travel',
        '',
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"kenji_travels","display_name":"Kenji Sato"}'::jsonb,
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000002'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'maya@michi.travel',
        '',
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"maya_wanderer","display_name":"Maya Lin"}'::jsonb,
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000003'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'aarav@michi.travel',
        '',
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"aarav_explorer","display_name":"Aarav Mehta"}'::jsonb,
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000004'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'elena@michi.travel',
        '',
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"elena_nomad","display_name":"Elena Rossi"}'::jsonb,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- 2. Upsert demo profiles
INSERT INTO public.profiles (
    id, username, display_name, avatar_url, cover_image_url,
    bio, location, social_links, is_ai_chatbot_enabled, created_at, updated_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'kenji_travels',
        'Kenji Sato',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
        'Slow-travel writer & architecture enthusiast documenting rail corridors, tea houses, and historic trails across Japan.',
        'Tokyo, Japan',
        '{}'::jsonb,
        TRUE,
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000002'::uuid,
        'maya_wanderer',
        'Maya Lin',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        'Coastal road-tripper, campervan builder, and sunrise surf chaser mapping scenic highways and cliffside campgrounds.',
        'San Francisco, CA',
        '{}'::jsonb,
        TRUE,
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000003'::uuid,
        'aarav_explorer',
        'Aarav Mehta',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
        'High-altitude trekker and landscape photographer exploring Himalayan passes, monasteries, and remote mountain valleys.',
        'Leh & New Delhi, India',
        '{}'::jsonb,
        TRUE,
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000004'::uuid,
        'elena_nomad',
        'Elena Rossi',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        'Alpine backpacker and Mediterranean island hopper. Sharing rifugio tips, ridge trails, and coastal ferry routes.',
        'Milan, Italy',
        '{}'::jsonb,
        TRUE,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    cover_image_url = EXCLUDED.cover_image_url,
    bio = EXCLUDED.bio,
    location = EXCLUDED.location,
    updated_at = NOW();

-- 3. Upsert 5 public, published demo trips
INSERT INTO public.trips (
    id, owner_id, title, description, cover_image_url,
    starting_location, ending_location, start_date, end_date,
    category, visibility, status, created_at, updated_at
)
VALUES
    (
        '11111111-1111-4111-8111-111111111101'::uuid,
        '00000000-0000-0000-0000-000000000003'::uuid,
        'Zanskar & Ladakh High-Altitude Traverse',
        'An unforgettable 10-day overland and trekking expedition crossing high Himalayan passes from Manali through Zanskar''s remote monasteries to the turquoise waters of Pangong Tso.',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
        'Manali, Himachal Pradesh, India',
        'Leh, Ladakh, India',
        '2026-07-10',
        '2026-07-20',
        'Trekking',
        'public',
        'published',
        '2026-11-25T18:05:00Z'::timestamptz,
        NOW()
    ),
    (
        '11111111-1111-4111-8111-111111111102'::uuid,
        '00000000-0000-0000-0000-000000000002'::uuid,
        'Pacific Coast Highway: Big Sur to San Diego',
        'Classic 8-day California coastal road trip down Highway 1 with oceanfront camp spots, redwood canyons, sea-otter coves, and sunset surf sessions.',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        'San Francisco, CA, USA',
        'San Diego, CA, USA',
        '2026-09-04',
        '2026-09-12',
        'Road trip',
        'public',
        'published',
        '2026-11-25T18:04:00Z'::timestamptz,
        NOW()
    ),
    (
        '11111111-1111-4111-8111-111111111103'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        'Kyoto to Nara: Autumn Temple & Tea Trail',
        'A slow-paced 7-day cultural journey linking Kyoto''s hidden moss gardens, Uji''s historic matcha houses, and Nara''s ancient cedar-lined shrines.',
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
        'Kyoto, Japan',
        'Nara, Japan',
        '2026-10-15',
        '2026-10-22',
        'Cultural exploration',
        'public',
        'published',
        '2026-11-25T18:03:00Z'::timestamptz,
        NOW()
    ),
    (
        '11111111-1111-4111-8111-111111111104'::uuid,
        '00000000-0000-0000-0000-000000000004'::uuid,
        'Dolomites & Lake Como Alpine Backpacking',
        'Nine days of dramatic limestone spires, turquoise glacial lakes, and mountain rifugios linking northern Italy''s Lake Como to the heart of the Dolomites.',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        'Milan, Italy',
        'Cortina d''Ampezzo, Italy',
        '2026-08-02',
        '2026-08-11',
        'Backpacking',
        'public',
        'published',
        '2026-11-25T18:02:00Z'::timestamptz,
        NOW()
    ),
    (
        '11111111-1111-4111-8111-111111111105'::uuid,
        '00000000-0000-0000-0000-000000000004'::uuid,
        'Amalfi Coast & Capri Island Hopping',
        'Sun-drenched 6-day coastal escape along Campania''s lemon groves, cliffside villages, and turquoise Mediterranean coves by ferry and foot.',
        'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
        'Naples, Italy',
        'Positano, Italy',
        '2026-06-12',
        '2026-06-18',
        'Beach vacation',
        'public',
        'published',
        '2026-11-25T18:01:00Z'::timestamptz,
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    cover_image_url = EXCLUDED.cover_image_url,
    starting_location = EXCLUDED.starting_location,
    ending_location = EXCLUDED.ending_location,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    category = EXCLUDED.category,
    visibility = EXCLUDED.visibility,
    status = EXCLUDED.status,
    created_at = EXCLUDED.created_at,
    updated_at = NOW();

-- 4. Replace stops for these 5 demo trips
DELETE FROM public.trip_stops
WHERE trip_id IN (
    '11111111-1111-4111-8111-111111111101'::uuid,
    '11111111-1111-4111-8111-111111111102'::uuid,
    '11111111-1111-4111-8111-111111111103'::uuid,
    '11111111-1111-4111-8111-111111111104'::uuid,
    '11111111-1111-4111-8111-111111111105'::uuid
);

INSERT INTO public.trip_stops (
    id, trip_id, stop_name, location, latitude, longitude,
    arrival_date, departure_date, accommodation_details,
    activities, notes, order_index, created_at, updated_at
)
VALUES
    -- Trip 1: Zanskar & Ladakh
    ('22222222-2222-4222-8222-222222220101'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'Atal Tunnel & Keylong Base', 'Keylong, Himachal Pradesh, India', 32.5710, 77.0320, '2026-07-10', '2026-07-11', 'Zostel Keylong — warm timber dorms with valley views', 'Acclimatization walk to Kardang Monastery, gear check', 'Hydrate heavily and keep day one slow above 3,000 m.', 0, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220102'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'Baralacha La & Suraj Tal', 'Baralacha La, Himachal Pradesh, India', 32.7614, 77.4178, '2026-07-12', '2026-07-12', 'Sarchu Eco Camp Tents', 'High-pass photography at 4,850 m, emerald Suraj Tal stop', 'Cross before noon to avoid strong afternoon mountain winds.', 1, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220103'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'Padum Valley & Karsha Monastery', 'Padum, Zanskar, Ladakh, India', 33.4659, 76.8753, '2026-07-13', '2026-07-15', 'Padum Heritage Homestay with local butter tea & thukpa', 'Sunrise prayers at Karsha Gompa, Zanskar River suspension bridge', 'Offline maps are essential here; cell reception is intermittent.', 2, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220104'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'Pangong Tso Lakeside Camp', 'Spangmik, Pangong Tso, Ladakh, India', 33.7595, 78.6674, '2026-07-16', '2026-07-18', 'Starlight Lakeside Cottages, Spangmik', 'Milky Way astrophotography, shoreline hike at golden hour', 'Temperatures drop near freezing after sunset even in July.', 3, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220105'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'Leh Old Town & Shanti Stupa', 'Leh, Ladakh, India', 34.1526, 77.5771, '2026-07-18', '2026-07-20', 'The Grand Dragon Ladakh', 'Shanti Stupa sunset, Tibetan kitchen tasting, Leh Palace', 'Great finale to rest, upload photos, and celebrate the crossing.', 4, NOW(), NOW()),

    -- Trip 2: Pacific Coast Highway
    ('22222222-2222-4222-8222-222222220201'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, 'Golden Gate & Lands End', 'San Francisco, California, USA', 37.8199, -122.4783, '2026-09-04', '2026-09-05', 'Campervan parked near Ocean Beach', 'Dawn coffee at Lands End Labyrinth, Sutro Baths ruins', 'Check coastal fog forecast before heading south on Cabrillo Hwy.', 0, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220202'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, 'Monterey Bay & 17-Mile Drive', 'Monterey, California, USA', 36.6002, -121.8947, '2026-09-05', '2026-09-06', 'Asilomar Conference Grounds Coastal Lodge', 'Sea kayaking in Elkhorn Slough, Lone Cypress viewpoint', 'Spot sea otters right off Cannery Row in the morning calm.', 1, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220203'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, 'Bixby Creek Bridge & McWay Falls', 'Big Sur, California, USA', 36.3714, -121.9017, '2026-09-07', '2026-09-08', 'Pfeiffer Big Sur State Park Campground', 'Redwood grove trail, sunset overlook at Bixby Bridge', 'Fuel up in Carmel before entering Big Sur; gas stations are scarce.', 2, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220204'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, 'Santa Barbara Pier & Funk Zone', 'Santa Barbara, California, USA', 34.4208, -119.6982, '2026-09-09', '2026-09-10', 'Palihouse Santa Barbara', 'Bike ride along Cabrillo Blvd, tacos & local espresso', 'Perfect mid-trip recharge with warm Mediterranean breezes.', 3, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220205'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, 'La Jolla Cove & Torrey Pines', 'La Jolla, San Diego, California, USA', 32.8505, -117.2727, '2026-09-11', '2026-09-12', 'Scripps Inn Oceanfront', 'Snorkeling with leopard sharks, Torrey Pines gliderport sunset', 'Arrive before 9 AM for easy coastal parking near the cove.', 4, NOW(), NOW()),

    -- Trip 3: Kyoto to Nara
    ('22222222-2222-4222-8222-222222220301'::uuid, '11111111-1111-4111-8111-111111111103'::uuid, 'Arashiyama Bamboo Grove & Tenryu-ji', 'Arashiyama, Kyoto, Japan', 35.0168, 135.6713, '2026-10-15', '2026-10-17', 'Suiran Luxury Collection Ryokan', '6:30 AM bamboo path walk, Okochi Sanso tea garden', 'Early morning arrival gives you the entire grove in quiet mist.', 0, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220302'::uuid, '11111111-1111-4111-8111-111111111103'::uuid, 'Fushimi Inari Summit Ridge', 'Fushimi Ward, Kyoto, Japan', 34.9671, 135.7727, '2026-10-17', '2026-10-18', 'Machiya Townhouse near Higashiyama', 'Full 2-hour Mt. Inari torii gate loop, Nishiki Market dinner', 'Most crowds turn back halfway; the upper loop is serene.', 1, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220303'::uuid, '11111111-1111-4111-8111-111111111103'::uuid, 'Uji Byodo-in & Tea Houses', 'Uji, Kyoto Prefecture, Japan', 34.8893, 135.8077, '2026-10-19', '2026-10-20', 'Hanayashiki Ukifune-en Riverside Inn', 'Stone-milled matcha ceremony, Byodo-in Phoenix Hall', 'Try the roasted hojicha parfaits along Byodo-in Omotesando.', 2, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220304'::uuid, '11111111-1111-4111-8111-111111111103'::uuid, 'Todai-ji & Kasuga Taisha Lanterns', 'Nara, Nara Prefecture, Japan', 34.6890, 135.8398, '2026-10-20', '2026-10-22', 'Nara Hotel Classic Wing (1909)', 'Great Buddha Hall, stone lantern walk through primeval forest', 'Stroll Naramachi''s preserved merchant alleys for handmade crafts.', 3, NOW(), NOW()),

    -- Trip 4: Dolomites & Lake Como
    ('22222222-2222-4222-8222-222222220401'::uuid, '11111111-1111-4111-8111-111111111104'::uuid, 'Varenna & Villa Monastero', 'Varenna, Lake Como, Italy', 46.0108, 9.2836, '2026-08-02', '2026-08-04', 'Albergo Milano Lakefront Rooms', 'Ferry hop to Bellagio, hike up to Castello di Vezio', 'Direct regional train from Milano Centrale takes just 1 hour.', 0, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220402'::uuid, '11111111-1111-4111-8111-111111111104'::uuid, 'Bolzano & South Tyrol Gateway', 'Bolzano, South Tyrol, Italy', 46.4983, 11.3548, '2026-08-04', '2026-08-05', 'Hotel Figl Piazza Erbe', 'Ritten cable car plateau walk, South Tyrol food market', 'Stock up on trail snacks and trekking poles in town.', 1, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220403'::uuid, '11111111-1111-4111-8111-111111111104'::uuid, 'Seceda Ridgeline & Alpe di Siusi', 'Ortisei, Val Gardena, Italy', 46.5983, 11.7244, '2026-08-06', '2026-08-08', 'Rifugio Firenze (2,037 m)', 'Seceda Odle peaks ridge hike, alpine meadow sunrise', 'Book rifugio half-board bunks at least a month in advance.', 2, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220404'::uuid, '11111111-1111-4111-8111-111111111104'::uuid, 'Lago di Braies & Tre Cime Loop', 'Braies, South Tyrol, Italy', 46.6943, 12.0854, '2026-08-09', '2026-08-11', 'Cortina d''Ampezzo Mountain Chalet', 'Dawn rowboat on Lago di Braies, Tre Cime di Lavaredo circuit', 'First shuttle bus at 6:30 AM beats the midday tour buses.', 3, NOW(), NOW()),

    -- Trip 5: Amalfi Coast & Capri
    ('22222222-2222-4222-8222-222222220501'::uuid, '11111111-1111-4111-8111-111111111105'::uuid, 'Sorrento Cliffside Marina', 'Sorrento, Campania, Italy', 40.6263, 14.3758, '2026-06-12', '2026-06-13', 'Maison La Minervetta', 'Lemon grove tasting, sunset aperitivo above Marina Grande', 'Use Sorrento as a ferry hub instead of driving narrow coastal roads.', 0, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220502'::uuid, '11111111-1111-4111-8222-222222220502'::uuid, 'Capri & Monte Solaro Chairlift', 'Anacapri, Capri, Italy', 40.5507, 14.2228, '2026-06-14', '2026-06-15', 'Hotel Caesar Augustus, Anacapri', 'Wooden boat tour around Faraglioni rocks, Monte Solaro summit', 'Stay overnight on Capri to enjoy the island after day-trippers leave.', 1, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220503'::uuid, '11111111-1111-4111-8111-111111111105'::uuid, 'Ravello & Path of the Gods', 'Ravello, Campania, Italy', 40.6489, 14.6128, '2026-06-16', '2026-06-17', 'Villa Cimbrone Terrace', 'Terrace of Infinity gardens, Sentiero degli Dei coastal hike', 'Start the Path of the Gods in Bomerano for panoramic downhill views.', 2, NOW(), NOW()),
    ('22222222-2222-4222-8222-222222220504'::uuid, '11111111-1111-4111-8111-111111111105'::uuid, 'Spiaggia Grande, Positano', 'Positano, Campania, Italy', 40.6281, 14.4850, '2026-06-17', '2026-06-18', 'Hotel Poseidon Positano', 'Morning swim at Fornillo Beach, cliffside seafood dinner', 'Fornillo Beach is a 10-minute walk from the main pier and far quieter.', 3, NOW(), NOW());

COMMIT;
