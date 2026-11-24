# API Design & Endpoint Specification
## Project: MICHI (道) — The Adventure Explorer Travel Social Platform

**Version:** 1.0  
**Status:** Approved Specification (FastAPI Backend Architecture)  
**Date:** November 2026  
**Document Owner:** Backend Engineering Team  

---

## 1. API Architecture & Standards

- **Framework**: **Python FastAPI**, running asynchronously on **Render**.
- **Base URL**: `https://api.michi.travel/api/v1` (Production) / `http://localhost:8000/api/v1` (Development).
- **Format**: JSON request and response payloads, encoded in UTF-8.
- **Authentication**: Supabase Bearer JWT tokens passed in the standard `Authorization` header:
  ```http
  Authorization: Bearer <SUPABASE_JWT_ACCESS_TOKEN>
  ```
- **Response Format**: Predictable envelopes with HTTP status codes:
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null
  }
  ```

---

## 2. Core Endpoint Groups (FastAPI Routers)

### 2.1 Authentication & Profiles (`/api/v1/profiles` and `/api/v1/auth`)

> **Architecture Rule**: User authentication (Sign Up, Sign In, Sign Out, Password Recovery, and Google OAuth) is authoritative and handled directly through **Supabase Auth**. FastAPI acts as a resource server validating incoming Supabase Bearer JWTs using the project JWKS endpoint.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/auth/session` | Inspect and validate current Supabase JWT token claims | Yes |
| `GET` | `/profiles/me` | Get current authenticated user's profile and settings | Yes |
| `PATCH` | `/profiles/me` | Update display name, bio, location, cover, social links | Yes |
| `PATCH` | `/profiles/me/ai-settings` | Enable or disable the AI chatbot on user profile (FR-AI-10) | Yes |
| `GET` | `/profiles/check-username` | Real-time username availability check | Conditional |
| `GET` | `/profiles/{username}` | Get public traveller profile, stats, and published trip count | No |

### 2.2 Trip Management (`/api/v1/trips`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/trips` | List trips owned by current user (drafts, published, archived) | Yes |
| `POST` | `/trips` | Create a new trip (starting/ending locations, category, dates, visibility) | Yes |
| `GET` | `/trips/{trip_id}` | Retrieve complete trip details, route, stops, and media | Conditional |
| `PATCH` | `/trips/{trip_id}` | Edit trip information, cover image, visibility, or status | Yes (Owner) |
| `DELETE` | `/trips/{trip_id}` | Delete a trip and associated stops | Yes (Owner) |
| `POST` | `/trips/{trip_id}/publish` | Publish a draft trip | Yes (Owner) |
| `POST` | `/trips/{trip_id}/archive` | Archive a trip | Yes (Owner) |

### 2.3 Journey Stops (`/api/v1/trips/{trip_id}/stops`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/trips/{trip_id}/stops` | Retrieve stops ordered chronologically | Conditional |
| `POST` | `/trips/{trip_id}/stops` | Add a stop (coordinates, dates, accommodation, notes) | Yes (Owner) |
| `PUT` | `/trips/{trip_id}/stops/reorder` | Update the sequence order of stops (FR-STOP-04) | Yes (Owner) |
| `PATCH` | `/trips/{trip_id}/stops/{stop_id}` | Update stop details, accommodation, or activities | Yes (Owner) |
| `DELETE` | `/trips/{trip_id}/stops/{stop_id}` | Remove a stop from the trip | Yes (Owner) |

### 2.4 Maps & Routing (`/api/v1/maps`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/maps/geocode` | Proxy Google Maps Geocoding API to resolve address/lat/lng | Yes |
| `GET` | `/maps/places-autocomplete` | Google Places autocomplete for stop discovery | Yes |
| `GET` | `/trips/{trip_id}/route` | Query Google Directions API for verified road route polylines | Conditional |

### 2.5 Travel Experiences (`/api/v1/experiences`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/experiences` | Add an experience attached to a trip or stop | Yes |
| `GET` | `/trips/{trip_id}/experiences` | List all experiences logged for a trip | Conditional |
| `PATCH` | `/experiences/{experience_id}` | Edit experience details, date/time, or category | Yes (Owner) |
| `DELETE` | `/experiences/{experience_id}` | Delete an experience | Yes (Owner) |

### 2.6 Travel Blogs (`/api/v1/blogs`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/blogs` | Create a new blog post associated with a trip or stop | Yes |
| `GET` | `/blogs` | List published community blogs with pagination | No |
| `GET` | `/blogs/{blog_id}` | Get full blog post content and metadata | Conditional |
| `PATCH` | `/blogs/{blog_id}` | Edit blog title, content, or publication status | Yes (Author) |
| `DELETE` | `/blogs/{blog_id}` | Delete a blog post | Yes (Author) |

### 2.7 Media Management (Photos & Videos) (`/api/v1/media`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/media/upload-intent` | Generate pre-signed upload URL for Cloudinary / Object Storage | Yes |
| `POST` | `/media/confirm` | Confirm upload completion and record asset metadata | Yes |
| `PATCH` | `/media/{asset_id}` | Update caption, title, description, or order index | Yes (Owner) |
| `DELETE` | `/media/{asset_id}` | Delete photograph or video from trip and storage | Yes (Owner) |

### 2.8 Social Networking (`/api/v1/social`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/social/follow/{user_id}` | Follow a traveller | Yes |
| `DELETE` | `/social/follow/{user_id}` | Unfollow a traveller | Yes |
| `POST` | `/social/trips/{trip_id}/like` | Like a trip | Yes |
| `DELETE` | `/social/trips/{trip_id}/like` | Remove like from a trip | Yes |
| `GET` | `/social/trips/{trip_id}/comments` | List comments on a trip | Conditional |
| `POST` | `/social/trips/{trip_id}/comments` | Add a comment or reply | Yes |
| `POST` | `/social/trips/{trip_id}/save` | Save/bookmark a journey to personal library | Yes |
| `DELETE` | `/social/trips/{trip_id}/save` | Remove saved journey | Yes |
| `POST` | `/social/reports` | Report inappropriate content or user | Yes |
| `POST` | `/social/block/{user_id}` | Block a user | Yes |

### 2.9 Explore & Discovery (`/api/v1/explore`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/explore/featured` | Fetch curated and trending public journeys | No |
| `GET` | `/explore/recent` | Recently published trips feed | No |
| `GET` | `/explore/search` | Search by destination, country, city, username, title, category | No |
| `GET` | `/explore/destinations` | Popular travel destinations index | No |

### 2.10 AI Traveller Profile Chatbot (`/api/v1/ai`)

```http
POST /api/v1/ai/chat
Content-Type: application/json
```

#### Request Payload
```json
{
  "traveller_id": "c7a8b9d0-1234-5678-90ab-cdef12345678",
  "query": "Where did this traveller stay in Kasol, and how much did they spend?",
  "conversation_id": "optional-uuid"
}
```

#### Response Payload
```json
{
  "success": true,
  "data": {
    "answer": "During their trip to Kasol in May 2025, this traveller stayed at the Riverside Alpine Hut. They noted an approximate accommodation cost of ₹2,500 per night and recommended the outdoor terrace.",
    "sources": [
      {
        "trip_id": "8f2b...",
        "trip_title": "Himachal Monsoon Trek",
        "stop_id": "4d1a...",
        "stop_name": "Riverside Alpine Hut, Kasol",
        "url": "/trips/8f2b...#stop-4d1a"
      }
    ],
    "conversation_id": "3e9b..."
  },
  "error": null
}
```

If information is not present in the traveller's published content:
```json
{
  "success": true,
  "data": {
    "answer": "This traveller has not published information regarding their stay or expenses in Kasol.",
    "sources": [],
    "conversation_id": "3e9b..."
  },
  "error": null
}
```

---

## 3. Error Handling & Status Codes

All errors return the standardized error object:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "This trip is private and cannot be viewed or queried by visitors."
  }
}
```

Standard codes:
- `400 Bad Request`: Validation failure.
- `401 Unauthorized`: Missing or invalid JWT token.
- `403 Forbidden`: Attempting to access private trips or disabled AI chatbots.
- `404 Not Found`: Target resource not found.
- `429 Too Many Requests`: Rate limit exceeded on AI or geocoding APIs.

---

## 4. Cross-Reference Links

- Product Requirements Document: [PRD.md](PRD.md)
- Relational Schema: [DATABASE.md](DATABASE.md)
- System Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Security Guidelines: [SECURITY.md](SECURITY.md)
