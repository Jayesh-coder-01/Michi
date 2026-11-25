"""
Idempotent Demo Data Seed Script for MICHI Presentation
Populates 4 demo traveller profiles and 5 rich public, published demo trips
with realistic multi-stop itineraries, coordinates, accommodations, and notes.

Usage:
    python seed_demo_trips.py [path_to_sqlite_db]
"""

import sqlite3
import sys
import json
from datetime import datetime, timezone
from pathlib import Path


DEMO_PROFILES = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "username": "kenji_travels",
        "display_name": "Kenji Sato",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
        "bio": "Slow-travel writer & architecture enthusiast documenting rail corridors, tea houses, and historic trails across Japan.",
        "location": "Tokyo, Japan",
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "username": "maya_wanderer",
        "display_name": "Maya Lin",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "bio": "Coastal road-tripper, campervan builder, and sunrise surf chaser mapping scenic highways and cliffside campgrounds.",
        "location": "San Francisco, CA",
    },
    {
        "id": "00000000-0000-0000-0000-000000000003",
        "username": "aarav_explorer",
        "display_name": "Aarav Mehta",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        "bio": "High-altitude trekker and landscape photographer exploring Himalayan passes, monasteries, and remote mountain valleys.",
        "location": "Leh & New Delhi, India",
    },
    {
        "id": "00000000-0000-0000-0000-000000000004",
        "username": "elena_nomad",
        "display_name": "Elena Rossi",
        "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
        "bio": "Alpine backpacker and Mediterranean island hopper. Sharing rifugio tips, ridge trails, and coastal ferry routes.",
        "location": "Milan, Italy",
    },
]


DEMO_TRIPS = [
    {
        "id": "11111111-1111-4111-8111-111111111101",
        "owner_id": "00000000-0000-0000-0000-000000000003",
        "title": "Zanskar & Ladakh High-Altitude Traverse",
        "description": (
            "An unforgettable 10-day overland and trekking expedition crossing high Himalayan passes "
            "from Manali through Zanskar's remote monasteries to the turquoise waters of Pangong Tso."
        ),
        "cover_image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        "starting_location": "Manali, Himachal Pradesh, India",
        "ending_location": "Leh, Ladakh, India",
        "start_date": "2026-07-10",
        "end_date": "2026-07-20",
        "category": "Trekking",
        "visibility": "public",
        "status": "published",
        "created_at": "2026-11-25T18:05:00",
        "stops": [
            {
                "id": "22222222-2222-4222-8222-222222220101",
                "stop_name": "Atal Tunnel & Keylong Base",
                "location": "Keylong, Himachal Pradesh, India",
                "latitude": 32.5710,
                "longitude": 77.0320,
                "arrival_date": "2026-07-10",
                "departure_date": "2026-07-11",
                "accommodation_details": "Zostel Keylong — warm timber dorms with valley views",
                "activities": "Acclimatization walk to Kardang Monastery, gear check",
                "notes": "Hydrate heavily and keep day one slow above 3,000 m.",
                "order_index": 0,
            },
            {
                "id": "22222222-2222-4222-8222-222222220102",
                "stop_name": "Baralacha La & Suraj Tal",
                "location": "Baralacha La, Himachal Pradesh, India",
                "latitude": 32.7614,
                "longitude": 77.4178,
                "arrival_date": "2026-07-12",
                "departure_date": "2026-07-12",
                "accommodation_details": "Sarchu Eco Camp Tents",
                "activities": "High-pass photography at 4,850 m, emerald Suraj Tal stop",
                "notes": "Cross before noon to avoid strong afternoon mountain winds.",
                "order_index": 1,
            },
            {
                "id": "22222222-2222-4222-8222-222222220103",
                "stop_name": "Padum Valley & Karsha Monastery",
                "location": "Padum, Zanskar, Ladakh, India",
                "latitude": 33.4659,
                "longitude": 76.8753,
                "arrival_date": "2026-07-13",
                "departure_date": "2026-07-15",
                "accommodation_details": "Padum Heritage Homestay with local butter tea & thukpa",
                "activities": "Sunrise prayers at Karsha Gompa, Zanskar River suspension bridge",
                "notes": "Offline maps are essential here; cell reception is intermittent.",
                "order_index": 2,
            },
            {
                "id": "22222222-2222-4222-8222-222222220104",
                "stop_name": "Pangong Tso Lakeside Camp",
                "location": "Spangmik, Pangong Tso, Ladakh, India",
                "latitude": 33.7595,
                "longitude": 78.6674,
                "arrival_date": "2026-07-16",
                "departure_date": "2026-07-18",
                "accommodation_details": "Starlight Lakeside Cottages, Spangmik",
                "activities": "Milky Way astrophotography, shoreline hike at golden hour",
                "notes": "Temperatures drop near freezing after sunset even in July.",
                "order_index": 3,
            },
            {
                "id": "22222222-2222-4222-8222-222222220105",
                "stop_name": "Leh Old Town & Shanti Stupa",
                "location": "Leh, Ladakh, India",
                "latitude": 34.1526,
                "longitude": 77.5771,
                "arrival_date": "2026-07-18",
                "departure_date": "2026-07-20",
                "accommodation_details": "The Grand Dragon Ladakh",
                "activities": "Shanti Stupa sunset, Tibetan kitchen tasting, Leh Palace",
                "notes": "Great finale to rest, upload photos, and celebrate the crossing.",
                "order_index": 4,
            },
        ],
    },
    {
        "id": "11111111-1111-4111-8111-111111111102",
        "owner_id": "00000000-0000-0000-0000-000000000002",
        "title": "Pacific Coast Highway: Big Sur to San Diego",
        "description": (
            "Classic 8-day California coastal road trip down Highway 1 with oceanfront camp spots, "
            "redwood canyons, sea-otter coves, and sunset surf sessions."
        ),
        "cover_image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "starting_location": "San Francisco, CA, USA",
        "ending_location": "San Diego, CA, USA",
        "start_date": "2026-09-04",
        "end_date": "2026-09-12",
        "category": "Road trip",
        "visibility": "public",
        "status": "published",
        "created_at": "2026-11-25T18:04:00",
        "stops": [
            {
                "id": "22222222-2222-4222-8222-222222220201",
                "stop_name": "Golden Gate & Lands End",
                "location": "San Francisco, California, USA",
                "latitude": 37.8199,
                "longitude": -122.4783,
                "arrival_date": "2026-09-04",
                "departure_date": "2026-09-05",
                "accommodation_details": "Campervan parked near Ocean Beach",
                "activities": "Dawn coffee at Lands End Labyrinth, Sutro Baths ruins",
                "notes": "Check coastal fog forecast before heading south on Cabrillo Hwy.",
                "order_index": 0,
            },
            {
                "id": "22222222-2222-4222-8222-222222220202",
                "stop_name": "Monterey Bay & 17-Mile Drive",
                "location": "Monterey, California, USA",
                "latitude": 36.6002,
                "longitude": -121.8947,
                "arrival_date": "2026-09-05",
                "departure_date": "2026-09-06",
                "accommodation_details": "Asilomar Conference Grounds Coastal Lodge",
                "activities": "Sea kayaking in Elkhorn Slough, Lone Cypress viewpoint",
                "notes": "Spot sea otters right off Cannery Row in the morning calm.",
                "order_index": 1,
            },
            {
                "id": "22222222-2222-4222-8222-222222220203",
                "stop_name": "Bixby Creek Bridge & McWay Falls",
                "location": "Big Sur, California, USA",
                "latitude": 36.3714,
                "longitude": -121.9017,
                "arrival_date": "2026-09-07",
                "departure_date": "2026-09-08",
                "accommodation_details": "Pfeiffer Big Sur State Park Campground",
                "activities": "Redwood grove trail, sunset overlook at Bixby Bridge",
                "notes": "Fuel up in Carmel before entering Big Sur; gas stations are scarce.",
                "order_index": 2,
            },
            {
                "id": "22222222-2222-4222-8222-222222220204",
                "stop_name": "Santa Barbara Pier & Funk Zone",
                "location": "Santa Barbara, California, USA",
                "latitude": 34.4208,
                "longitude": -119.6982,
                "arrival_date": "2026-09-09",
                "departure_date": "2026-09-10",
                "accommodation_details": "Palihouse Santa Barbara",
                "activities": "Bike ride along Cabrillo Blvd, tacos & local espresso",
                "notes": "Perfect mid-trip recharge with warm Mediterranean breezes.",
                "order_index": 3,
            },
            {
                "id": "22222222-2222-4222-8222-222222220205",
                "stop_name": "La Jolla Cove & Torrey Pines",
                "location": "La Jolla, San Diego, California, USA",
                "latitude": 32.8505,
                "longitude": -117.2727,
                "arrival_date": "2026-09-11",
                "departure_date": "2026-09-12",
                "accommodation_details": "Scripps Inn Oceanfront",
                "activities": "Snorkeling with leopard sharks, Torrey Pines gliderport sunset",
                "notes": "Arrive before 9 AM for easy coastal parking near the cove.",
                "order_index": 4,
            },
        ],
    },
    {
        "id": "11111111-1111-4111-8111-111111111103",
        "owner_id": "00000000-0000-0000-0000-000000000001",
        "title": "Kyoto to Nara: Autumn Temple & Tea Trail",
        "description": (
            "A slow-paced 7-day cultural journey linking Kyoto's hidden moss gardens, "
            "Uji's historic matcha houses, and Nara's ancient cedar-lined shrines."
        ),
        "cover_image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
        "starting_location": "Kyoto, Japan",
        "ending_location": "Nara, Japan",
        "start_date": "2026-10-15",
        "end_date": "2026-10-22",
        "category": "Cultural exploration",
        "visibility": "public",
        "status": "published",
        "created_at": "2026-11-25T18:03:00",
        "stops": [
            {
                "id": "22222222-2222-4222-8222-222222220301",
                "stop_name": "Arashiyama Bamboo Grove & Tenryu-ji",
                "location": "Arashiyama, Kyoto, Japan",
                "latitude": 35.0168,
                "longitude": 135.6713,
                "arrival_date": "2026-10-15",
                "departure_date": "2026-10-17",
                "accommodation_details": "Suiran Luxury Collection Ryokan",
                "activities": "6:30 AM bamboo path walk, Okochi Sanso tea garden",
                "notes": "Early morning arrival gives you the entire grove in quiet mist.",
                "order_index": 0,
            },
            {
                "id": "22222222-2222-4222-8222-222222220302",
                "stop_name": "Fushimi Inari Summit Ridge",
                "location": "Fushimi Ward, Kyoto, Japan",
                "latitude": 34.9671,
                "longitude": 135.7727,
                "arrival_date": "2026-10-17",
                "departure_date": "2026-10-18",
                "accommodation_details": "Machiya Townhouse near Higashiyama",
                "activities": "Full 2-hour Mt. Inari torii gate loop, Nishiki Market dinner",
                "notes": "Most crowds turn back halfway; the upper loop is serene.",
                "order_index": 1,
            },
            {
                "id": "22222222-2222-4222-8222-222222220303",
                "stop_name": "Uji Byodo-in & Tea Houses",
                "location": "Uji, Kyoto Prefecture, Japan",
                "latitude": 34.8893,
                "longitude": 135.8077,
                "arrival_date": "2026-10-19",
                "departure_date": "2026-10-20",
                "accommodation_details": "Hanayashiki Ukifune-en Riverside Inn",
                "activities": "Stone-milled matcha ceremony, Byodo-in Phoenix Hall",
                "notes": "Try the roasted hojicha parfaits along Byodo-in Omotesando.",
                "order_index": 2,
            },
            {
                "id": "22222222-2222-4222-8222-222222220304",
                "stop_name": "Todai-ji & Kasuga Taisha Lanterns",
                "location": "Nara, Nara Prefecture, Japan",
                "latitude": 34.6890,
                "longitude": 135.8398,
                "arrival_date": "2026-10-20",
                "departure_date": "2026-10-22",
                "accommodation_details": "Nara Hotel Classic Wing (1909)",
                "activities": "Great Buddha Hall, stone lantern walk through primeval forest",
                "notes": "Stroll Naramachi's preserved merchant alleys for handmade crafts.",
                "order_index": 3,
            },
        ],
    },
    {
        "id": "11111111-1111-4111-8111-111111111104",
        "owner_id": "00000000-0000-0000-0000-000000000004",
        "title": "Dolomites & Lake Como Alpine Backpacking",
        "description": (
            "Nine days of dramatic limestone spires, turquoise glacial lakes, and mountain rifugios "
            "linking northern Italy's Lake Como to the heart of the Dolomites."
        ),
        "cover_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
        "starting_location": "Milan, Italy",
        "ending_location": "Cortina d'Ampezzo, Italy",
        "start_date": "2026-08-02",
        "end_date": "2026-08-11",
        "category": "Backpacking",
        "visibility": "public",
        "status": "published",
        "created_at": "2026-11-25T18:02:00",
        "stops": [
            {
                "id": "22222222-2222-4222-8222-222222220401",
                "stop_name": "Varenna & Villa Monastero",
                "location": "Varenna, Lake Como, Italy",
                "latitude": 46.0108,
                "longitude": 9.2836,
                "arrival_date": "2026-08-02",
                "departure_date": "2026-08-04",
                "accommodation_details": "Albergo Milano Lakefront Rooms",
                "activities": "Ferry hop to Bellagio, hike up to Castello di Vezio",
                "notes": "Direct regional train from Milano Centrale takes just 1 hour.",
                "order_index": 0,
            },
            {
                "id": "22222222-2222-4222-8222-222222220402",
                "stop_name": "Bolzano & South Tyrol Gateway",
                "location": "Bolzano, South Tyrol, Italy",
                "latitude": 46.4983,
                "longitude": 11.3548,
                "arrival_date": "2026-08-04",
                "departure_date": "2026-08-05",
                "accommodation_details": "Hotel Figl Piazza Erbe",
                "activities": "Ritten cable car plateau walk, South Tyrol food market",
                "notes": "Stock up on trail snacks and trekking poles in town.",
                "order_index": 1,
            },
            {
                "id": "22222222-2222-4222-8222-222222220403",
                "stop_name": "Seceda Ridgeline & Alpe di Siusi",
                "location": "Ortisei, Val Gardena, Italy",
                "latitude": 46.5983,
                "longitude": 11.7244,
                "arrival_date": "2026-08-06",
                "departure_date": "2026-08-08",
                "accommodation_details": "Rifugio Firenze (2,037 m)",
                "activities": "Seceda Odle peaks ridge hike, alpine meadow sunrise",
                "notes": "Book rifugio half-board bunks at least a month in advance.",
                "order_index": 2,
            },
            {
                "id": "22222222-2222-4222-8222-222222220404",
                "stop_name": "Lago di Braies & Tre Cime Loop",
                "location": "Braies, South Tyrol, Italy",
                "latitude": 46.6943,
                "longitude": 12.0854,
                "arrival_date": "2026-08-09",
                "departure_date": "2026-08-11",
                "accommodation_details": "Cortina d'Ampezzo Mountain Chalet",
                "activities": "Dawn rowboat on Lago di Braies, Tre Cime di Lavaredo circuit",
                "notes": "First shuttle bus at 6:30 AM beats the midday tour buses.",
                "order_index": 3,
            },
        ],
    },
    {
        "id": "11111111-1111-4111-8111-111111111105",
        "owner_id": "00000000-0000-0000-0000-000000000004",
        "title": "Amalfi Coast & Capri Island Hopping",
        "description": (
            "Sun-drenched 6-day coastal escape along Campania's lemon groves, cliffside villages, "
            "and turquoise Mediterranean coves by ferry and foot."
        ),
        "cover_image_url": "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
        "starting_location": "Naples, Italy",
        "ending_location": "Positano, Italy",
        "start_date": "2026-06-12",
        "end_date": "2026-06-18",
        "category": "Beach vacation",
        "visibility": "public",
        "status": "published",
        "created_at": "2026-11-25T18:01:00",
        "stops": [
            {
                "id": "22222222-2222-4222-8222-222222220501",
                "stop_name": "Sorrento Cliffside Marina",
                "location": "Sorrento, Campania, Italy",
                "latitude": 40.6263,
                "longitude": 14.3758,
                "arrival_date": "2026-06-12",
                "departure_date": "2026-06-13",
                "accommodation_details": "Maison La Minervetta",
                "activities": "Lemon grove tasting, sunset aperitivo above Marina Grande",
                "notes": "Use Sorrento as a ferry hub instead of driving narrow coastal roads.",
                "order_index": 0,
            },
            {
                "id": "22222222-2222-4222-8222-222222220502",
                "stop_name": "Capri & Monte Solaro Chairlift",
                "location": "Anacapri, Capri, Italy",
                "latitude": 40.5507,
                "longitude": 14.2228,
                "arrival_date": "2026-06-14",
                "departure_date": "2026-06-15",
                "accommodation_details": "Hotel Caesar Augustus, Anacapri",
                "activities": "Wooden boat tour around Faraglioni rocks, Monte Solaro summit",
                "notes": "Stay overnight on Capri to enjoy the island after day-trippers leave.",
                "order_index": 1,
            },
            {
                "id": "22222222-2222-4222-8222-222222220503",
                "stop_name": "Ravello & Path of the Gods",
                "location": "Ravello, Campania, Italy",
                "latitude": 40.6489,
                "longitude": 14.6128,
                "arrival_date": "2026-06-16",
                "departure_date": "2026-06-17",
                "accommodation_details": "Villa Cimbrone Terrace",
                "activities": "Terrace of Infinity gardens, Sentiero degli Dei coastal hike",
                "notes": "Start the Path of the Gods in Bomerano for panoramic downhill views.",
                "order_index": 2,
            },
            {
                "id": "22222222-2222-4222-8222-222222220504",
                "stop_name": "Spiaggia Grande, Positano",
                "location": "Positano, Campania, Italy",
                "latitude": 40.6281,
                "longitude": 14.4850,
                "arrival_date": "2026-06-17",
                "departure_date": "2026-06-18",
                "accommodation_details": "Hotel Poseidon Positano",
                "activities": "Morning swim at Fornillo Beach, cliffside seafood dinner",
                "notes": "Fornillo Beach is a 10-minute walk from the main pier and far quieter.",
                "order_index": 3,
            },
        ],
    },
]


def seed_database(db_path: Path) -> None:
    if not db_path.exists():
        print(f"[SKIP] Database not found: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    conn.create_function("auth_uid", 0, lambda: None)
    cur = conn.cursor()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

    # 1. Upsert demo profiles
    for p in DEMO_PROFILES:
        cur.execute(
            """
            INSERT INTO profiles (
                id, username, display_name, avatar_url, cover_image_url,
                bio, location, social_links, is_ai_chatbot_enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                display_name = excluded.display_name,
                avatar_url = excluded.avatar_url,
                cover_image_url = excluded.cover_image_url,
                bio = excluded.bio,
                location = excluded.location,
                updated_at = excluded.updated_at
            """,
            (
                p["id"],
                p["username"],
                p["display_name"],
                p["avatar_url"],
                p["cover_image_url"],
                p["bio"],
                p["location"],
                json.dumps({}),
                now_iso,
                now_iso,
            ),
        )

    # 2. Upsert demo trips & their stops
    for t in DEMO_TRIPS:
        cur.execute(
            """
            INSERT INTO trips (
                id, owner_id, title, description, cover_image_url,
                starting_location, ending_location, start_date, end_date,
                category, visibility, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                owner_id = excluded.owner_id,
                title = excluded.title,
                description = excluded.description,
                cover_image_url = excluded.cover_image_url,
                starting_location = excluded.starting_location,
                ending_location = excluded.ending_location,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                category = excluded.category,
                visibility = excluded.visibility,
                status = excluded.status,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at
            """,
            (
                t["id"],
                t["owner_id"],
                t["title"],
                t["description"],
                t["cover_image_url"],
                t["starting_location"],
                t["ending_location"],
                t["start_date"],
                t["end_date"],
                t["category"],
                t["visibility"],
                t["status"],
                t["created_at"],
                now_iso,
            ),
        )

        # Replace stops cleanly for this demo trip
        cur.execute("DELETE FROM trip_stops WHERE trip_id = ?", (t["id"],))
        for s in t["stops"]:
            cur.execute(
                """
                INSERT INTO trip_stops (
                    id, trip_id, stop_name, location, latitude, longitude,
                    arrival_date, departure_date, accommodation_details,
                    activities, notes, order_index, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    s["id"],
                    t["id"],
                    s["stop_name"],
                    s["location"],
                    s["latitude"],
                    s["longitude"],
                    s["arrival_date"],
                    s["departure_date"],
                    s["accommodation_details"],
                    s["activities"],
                    s["notes"],
                    s["order_index"],
                    now_iso,
                    now_iso,
                ),
            )

    conn.commit()
    total_public = cur.execute(
        "SELECT COUNT(*) FROM trips WHERE status='published' AND visibility='public'"
    ).fetchone()[0]
    total_stops = cur.execute("SELECT COUNT(*) FROM trip_stops").fetchone()[0]
    conn.close()
    print(f"[OK] Seeded {len(DEMO_PROFILES)} profiles and {len(DEMO_TRIPS)} demo trips in {db_path} "
          f"(total public trips: {total_public}, total stops: {total_stops})")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            seed_database(Path(arg))
    else:
        seed_database(Path(__file__).resolve().parent / "michi_dev.db")
