# MICHI (道) — Phase 3 Task Breakdown & Acceptance Criteria

**Document Version:** 1.2 (Final Architecture Corrections Revision)  
**Status:** Approved for Review (Pre-Implementation Work Breakdown Structure)  
**Date:** November 2026  
**Authors:** Lead Full-Stack Engineer & Project Coordinator  
**Source of Truth:** [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API.md](API.md), [SECURITY.md](SECURITY.md), [USER_FLOWS.md](USER_FLOWS.md), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md), [PHASE3_GAP_ANALYSIS.md](PHASE3_GAP_ANALYSIS.md)

---

## 1. Epic Overview & Dependency Flow

```mermaid
flowchart TD
    subgraph Epic1["Epic 1: Database & Migrations"]
        T_DB1[TASK-P3-DB-01: Schema & Enums Migration]
        T_DB2[TASK-P3-DB-02: RLS Policies & Grants]
        T_DB3[TASK-P3-DB-03: Timestamps & Triggers]
    end

    subgraph Epic2["Epic 2: Backend Models & Schemas"]
        T_BE1[TASK-P3-BE-01: SQLAlchemy ORM Models]
        T_BE2[TASK-P3-BE-02: Pydantic Trip Schemas - No Status in Patch]
        T_BE3[TASK-P3-BE-03: Pydantic Stop Schemas]
    end

    subgraph Epic3["Epic 3: Backend Services"]
        T_BE4[TASK-P3-BE-04: TripService Lifecycle & Dedicated Operations]
        T_BE5[TASK-P3-BE-05: TripStopService Pessimistic Lock & Reordering]
    end

    subgraph Epic4["Epic 4: Backend API Routers"]
        T_BE6[TASK-P3-BE-06: /api/v1/trips Router - Publish/Archive/Restore/Unpublish]
        T_BE7[TASK-P3-BE-07: /api/v1/trips/{id}/stops Router]
        T_BE8[TASK-P3-BE-08: Router Registration & OpenAPI]
    end

    subgraph Epic5["Epic 5: Frontend Types & Client Services"]
        T_FE1[TASK-P3-FE-01: TypeScript Types & Interfaces]
        T_FE2[TASK-P3-FE-02: tripService.ts Client]
    end

    subgraph Epic6["Epic 6: Frontend UI Components & Screens"]
        T_FE3[TASK-P3-FE-03: JourneyTimeline Component]
        T_FE4[TASK-P3-FE-04: TripCard & TripBadge Atoms]
        T_FE5[TASK-P3-FE-05: CreateTripScreen (Screen 13)]
        T_FE6[TASK-P3-FE-06: TripEditorScreen (Screen 14)]
        T_FE7[TASK-P3-FE-07: StopModal & StopEditor (Screens 15/16)]
        T_FE8[TASK-P3-FE-08: TripDetailsScreen (Screen 19)]
        T_FE9[TASK-P3-FE-09: AccessDenied & Dialogs (Screens 33/35)]
        T_FE10[TASK-P3-FE-10: MyProfile Trips Tab & Navigation]
    end

    subgraph Epic7["Epic 7: Automated Testing & Verification"]
        T_TST1[TASK-P3-TEST-01: Pytest Trip CRUD & Lifecycle Suite]
        T_TST2[TASK-P3-TEST-02: Pytest Stop Reordering & Pessimistic Lock Suite]
        T_TST3[TASK-P3-TEST-03: SQLite Emulated Unit Test Suite]
        T_TST4[TASK-P3-TEST-04: PostgreSQL Integration RLS Suite]
        T_TST5[TASK-P3-TEST-05: Frontend Vitest Suite]
        T_TST6[TASK-P3-TEST-06: Build & Final Verification]
    end

    T_DB1 --> T_DB2 --> T_DB3
    T_DB3 --> T_BE1
    T_BE1 --> T_BE2 --> T_BE3
    T_BE3 --> T_BE4 --> T_BE5
    T_BE5 --> T_BE6 --> T_BE7 --> T_BE8
    T_BE8 --> T_FE1 --> T_FE2
    T_FE2 --> T_FE3 & T_FE4
    T_FE3 & T_FE4 --> T_FE5 --> T_FE6 --> T_FE7 --> T_FE8 --> T_FE9 --> T_FE10
    T_BE8 --> T_TST1 & T_TST2 & T_TST3 & T_TST4
    T_FE10 --> T_TST5
    T_TST1 & T_TST2 & T_TST3 & T_TST4 & T_TST5 --> T_TST6
```

---

## 2. Granular Task Breakdown

### Epic 1: Database & Migrations

#### `TASK-P3-DB-01`: Schema & Enums Migration
- **Description:** Author the Supabase/PostgreSQL migration script defining ENUM types (`trip_visibility`, `trip_status`), the `public.trips` table, and the `public.trip_stops` table with exact check constraints and deferrable unique ordering.
- **Dependencies:** Phase 2 Profile Migration (`20261124000000_phase2_auth_profiles.sql`).
- **Target Files:** `supabase/migrations/20261125000000_phase3_trips_stops.sql`.
- **Acceptance Criteria:**
  - [ ] `trip_visibility` ENUM created (`'public'`, `'private'`).
  - [ ] `trip_status` ENUM created (`'draft'`, `'published'`, `'archived'`).
  - [ ] `public.trips` table created with `owner_id` FK referencing `public.profiles(id)` `ON DELETE CASCADE`.
  - [ ] `visibility` column defaults to `'private' NOT NULL`.
  - [ ] Check constraint `valid_dates` enforced: `end_date IS NULL OR start_date IS NULL OR end_date >= start_date`.
  - [ ] Check constraint `valid_category` enforced: strictly 1 of 10 PRD categories.
  - [ ] `public.trip_stops` table created with `trip_id` FK referencing `public.trips(id)` `ON DELETE CASCADE`.
  - [ ] Check constraints `valid_lat` (-90 to 90), `valid_lng` (-180 to 180), and `valid_order_index` (>= 0).
  - [ ] Deferred unique constraint: `CONSTRAINT uq_trip_stops_trip_order UNIQUE (trip_id, order_index) DEFERRABLE INITIALLY DEFERRED`.
  - [ ] Indexes created on `trips(owner_id)`, `trips(visibility, status)`, and `trip_stops(trip_id, order_index)`.
- **Priority:** P0 (Blocker)

#### `TASK-P3-DB-02`: Row Level Security (RLS) Policies & Stop Immutability Trigger
- **Description:** Implement database-level RLS policies on `public.trips` and `public.trip_stops` enforcing strict owner isolation and parent-trip binding, plus an immutable trigger blocking `trip_id` changes.
- **Dependencies:** `TASK-P3-DB-01`.
- **Target Files:** `supabase/migrations/20261125000000_phase3_trips_stops.sql`.
- **Acceptance Criteria:**
  - [ ] RLS enabled on `public.trips` and `public.trip_stops`.
  - [ ] Trips SELECT policy: `(visibility = 'public' AND status = 'published') OR (auth.uid() = owner_id)`.
  - [ ] Trips INSERT, UPDATE, DELETE policies strictly restrict modifications to `auth.uid() = owner_id`.
  - [ ] Stops SELECT policy: readable only if parent trip is readable under caller's context.
  - [ ] Stops INSERT, UPDATE, DELETE policies require caller to own parent trip (`EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND owner_id = auth.uid())`).
  - [ ] Trigger `check_stop_trip_immutable` prevents altering `trip_id` on existing stop rows.
  - [ ] Table privileges granted cleanly to `anon` (SELECT on public/published rows) and `authenticated` (SELECT and owner-restricted writes).
- **Priority:** P0 (Blocker)

#### `TASK-P3-DB-03`: Updated_at Automatic Trigger
- **Description:** Attach the automated `handle_updated_at()` trigger function to both `public.trips` and `public.trip_stops`.
- **Dependencies:** `TASK-P3-DB-01`.
- **Target Files:** `supabase/migrations/20261125000000_phase3_trips_stops.sql`.
- **Acceptance Criteria:**
  - [ ] `BEFORE UPDATE` trigger on `public.trips` updates `updated_at = NOW()`.
  - [ ] `BEFORE UPDATE` trigger on `public.trip_stops` updates `updated_at = NOW()`.
- **Priority:** P1

---

### Epic 2: Backend Models & Schemas

#### `TASK-P3-BE-01`: SQLAlchemy ORM Models
- **Description:** Define Python SQLAlchemy ORM entities for `TripModel` and `TripStopModel` with relationships, table bindings, and foreign keys.
- **Dependencies:** `TASK-P3-DB-01`.
- **Target Files:**
  - `backend/app/models/trip.py`
  - `backend/app/models/trip_stop.py`
  - `backend/app/models/__init__.py`
- **Acceptance Criteria:**
  - [ ] `TripModel` maps to `public.trips` with columns matching database schema.
  - [ ] `TripStopModel` maps to `public.trip_stops` with columns matching database schema.
  - [ ] Relationship `TripModel.stops` defined with cascade delete and ordered by `order_index ASC`.
  - [ ] Relationship `TripModel.owner` referencing `ProfileModel`.
- **Priority:** P0

#### `TASK-P3-BE-02`: Pydantic Trip Schemas (No Status in Patch)
- **Description:** Define Pydantic v2 schemas for Trip request bodies, update patches (explicitly excluding `status`), responses, and publish requests.
- **Dependencies:** None.
- **Target Files:**
  - `backend/app/schemas/trip.py`
  - `backend/app/schemas/__init__.py`
- **Acceptance Criteria:**
  - [ ] `TripCreate`: requires `title`, `starting_location`, `ending_location`, `category`; optional `description`, `cover_image_url`, `start_date`, `end_date`; defaults `visibility = TripVisibility.PRIVATE`.
  - [ ] `TripUpdate`: all metadata fields optional; **MUST NOT include `status`**. Any attempt to pass `status` is forbidden.
  - [ ] `TripPublishRequest`: optional `visibility: Optional[TripVisibility] = None`.
  - [ ] Validator verifies `end_date >= start_date` when both dates are provided.
  - [ ] `TripCategory` enum matches all 10 PRD categories.
  - [ ] `TripResponse` includes owner profile snippet, formatted timestamps, stop count, and stops list.
- **Priority:** P0

#### `TASK-P3-BE-03`: Pydantic Stop Schemas
- **Description:** Define Pydantic v2 schemas for Stop creation, updating, and batch reordering with pre-flight validators.
- **Dependencies:** None.
- **Target Files:**
  - `backend/app/schemas/trip_stop.py`
  - `backend/app/schemas/__init__.py`
- **Acceptance Criteria:**
  - [ ] `TripStopCreate`: validates `stop_name`, `location`, `latitude` (-90 to 90), `longitude` (-180 to 180), dates, accommodation, activities, notes.
  - [ ] `TripStopUpdate`: partial updates for stop attributes.
  - [ ] `TripStopReorderRequest`: accepts `ordered_stop_ids: List[UUID]` with validator verifying `len(ids) == len(set(ids))` (no duplicates).
  - [ ] `TripStopResponse`: returns full stop attributes and `order_index`.
- **Priority:** P0

---

### Epic 3: Backend Services & Business Logic

#### `TASK-P3-BE-04`: TripService Lifecycle & Dedicated Operations
- **Description:** Implement business logic service for trip operations, enforcing mandatory publishing validation, lifecycle state transitions, and owner-only mutation.
- **Dependencies:** `TASK-P3-BE-01`, `TASK-P3-BE-02`.
- **Target Files:** `backend/app/services/trip_service.py`.
- **Acceptance Criteria:**
  - [ ] `create_trip`: initializes trip with status `draft`, assigns `owner_id = current_user.id`, defaults visibility to `private`.
  - [ ] `get_trip_by_id`: verifies access permissions; returns trip or raises 403 Forbidden / 404 Not Found.
  - [ ] `update_trip`: updates metadata fields only. **Does NOT allow updating `status`**.
  - [ ] `publish_trip`: validates mandatory publishing checklist:
    - Non-empty title (min 3 chars).
    - Valid category.
    - Non-empty starting and ending destinations.
    - Populated start and end dates with `end_date >= start_date`.
    - Explicit visibility setting (`public` or `private`).
    - **Does NOT require intermediate stops** (0 stops valid per PRD Module 3).
    - Rejects invalid publication with HTTP 422 (`PUBLISH_VALIDATION_FAILED`).
    - Transitions status to `published`.
  - [ ] `archive_trip`: transitions `published` $\rightarrow$ `archived`. Rejects archiving a draft with HTTP 422 (`INVALID_STATE_TRANSITION`).
  - [ ] `restore_trip`: transitions `archived` $\rightarrow$ `published` after re-validating publishing checklist.
  - [ ] `unpublish_trip`: transitions `published` $\rightarrow$ `draft`. Rejects unpublishing a draft with HTTP 422.
  - [ ] `delete_trip`: verifies ownership and removes trip (cascading to child stops).
- **Priority:** P0

#### `TASK-P3-BE-05`: TripStopService Pessimistic Lock & Atomic Reordering
- **Description:** Implement business logic service for stop operations, acquiring parent-trip lock (`SELECT ... FOR UPDATE`) on all mutations and executing collision-free batch reordering.
- **Dependencies:** `TASK-P3-BE-01`, `TASK-P3-BE-03`.
- **Target Files:** `backend/app/services/trip_stop_service.py`.
- **Acceptance Criteria:**
  - [ ] `add_stop`, `delete_stop`, and `reorder_stops` acquire parent-trip lock via `db.query(TripModel).filter(...).with_for_update().first()`.
  - [ ] Enforces parent-trip ownership (`trip.owner_id == current_user.id`) for all additions, edits, deletions, and reorderings.
  - [ ] Single-stop actions (`update_stop`, `delete_stop`) verify `stop.trip_id == trip.id`; reject foreign stop IDs with HTTP 404.
  - [ ] `add_stop`: calculates next sequential `order_index = max(order_index) + 1` while holding lock.
  - [ ] `delete_stop`: removes stop and re-normalizes subsequent stops' `order_index` sequence ($0, 1, 2...$) while holding lock.
  - [ ] `reorder_stops`:
    - Enforces integer boundary guard: rejects if `current_max > 1_000_000_000` with HTTP 422 (`ORDER_INDEX_OVERFLOW`).
    - Handles empty stop lists: returns `[]` with 200 OK for 0-stop trips; rejects with HTTP 422 (`INCOMPLETE_STOP_SEQUENCE`) for $>0$-stop trips.
    - Seamlessly normalizes non-contiguous existing indices (e.g. $0, 50, 9999$) into contiguous $0..N-1$.
    - Validates no duplicates in list.
    - Validates count and IDs match existing stop IDs for `trip_id` exactly (no omitted or foreign IDs).
    - Executes Two-Phase Positive Disjoint Offset algorithm (`order_index = order_index + safe_offset` then `order_index = target_idx`) while holding parent lock, strictly satisfying `CHECK (order_index >= 0)` and preventing collisions.
    - Performs complete rollback if any error occurs.
- **Priority:** P0

---

### Epic 4: Backend API Routers & Endpoints

#### `TASK-P3-BE-06`: `/api/v1/trips` Router & Dedicated Lifecycle Endpoints
- **Description:** Implement FastAPI router exposing endpoints for trip management and dedicated lifecycle operations.
- **Dependencies:** `TASK-P3-BE-04`.
- **Target Files:** `backend/app/routers/trips.py`.
- **Acceptance Criteria:**
  - [ ] `POST /trips`: Protected endpoint, creates draft trip.
  - [ ] `GET /trips`: Protected endpoint, lists current user's trips.
  - [ ] `GET /trips/public`: Public endpoint, returns community published trips.
  - [ ] `GET /trips/{trip_id}`: Conditional auth endpoint, checks visibility/owner.
  - [ ] `PATCH /trips/{trip_id}`: Protected endpoint (owner only; updates metadata only; cannot update status).
  - [ ] `DELETE /trips/{trip_id}`: Protected endpoint (owner only; cascades to stops).
  - [ ] `POST /trips/{trip_id}/publish`: Protected endpoint (owner only; enforces checklist).
  - [ ] `POST /trips/{trip_id}/archive`: Protected endpoint (owner only).
  - [ ] `POST /trips/{trip_id}/restore`: Protected endpoint (owner only; re-validates checklist).
  - [ ] `POST /trips/{trip_id}/unpublish`: Protected endpoint (owner only; transitions to draft).
- **Priority:** P0

#### `TASK-P3-BE-07`: `/api/v1/trips/{trip_id}/stops` Router
- **Description:** Implement FastAPI router exposing endpoints for journey stop operations.
- **Dependencies:** `TASK-P3-BE-05`.
- **Target Files:** `backend/app/routers/trip_stops.py`.
- **Acceptance Criteria:**
  - [ ] `GET /trips/{trip_id}/stops`: Conditional auth endpoint, returns chronological stops.
  - [ ] `POST /trips/{trip_id}/stops`: Protected endpoint (owner only; acquires parent lock).
  - [ ] `PATCH /trips/{trip_id}/stops/{stop_id}`: Protected endpoint (owner only; rejects foreign stop ID).
  - [ ] `DELETE /trips/{trip_id}/stops/{stop_id}`: Protected endpoint (owner only; acquires parent lock; rejects foreign stop ID).
  - [ ] `PUT /trips/{trip_id}/stops/reorder`: Protected endpoint (owner only; acquires parent lock; atomic two-phase reorder).
- **Priority:** P0

#### `TASK-P3-BE-08`: Router Registration & OpenAPI Documentation
- **Description:** Register `trips` and `trip_stops` routers in `backend/app/main.py` and verify OpenAPI tags and schemas.
- **Dependencies:** `TASK-P3-BE-06`, `TASK-P3-BE-07`.
- **Target Files:** `backend/app/main.py`.
- **Acceptance Criteria:**
  - [ ] Routers mounted under prefix `/api/v1`.
  - [ ] OpenAPI documentation displays `Trips` and `Trip Stops` tags with clear endpoint descriptions.
- **Priority:** P1

---

### Epic 5: Frontend Types & API Client Services

#### `TASK-P3-FE-01`: TypeScript Interfaces & Types
- **Description:** Define TypeScript interfaces mirroring the backend schemas for Trips, Stops, Categories, Visibility, Status, and Error models.
- **Dependencies:** `TASK-P3-BE-02`, `TASK-P3-BE-03`.
- **Target Files:** `frontend/src/types/trip.ts`.
- **Acceptance Criteria:**
  - [ ] `Trip`, `TripStop`, `TripVisibility`, `TripStatus`, `TripCategory` exported.
  - [ ] `TripUpdateInput` strictly omits `status`.
  - [ ] `TripPublishRequest` exported with optional `visibility`.
  - [ ] `ReorderStopsInput` exported.
- **Priority:** P0

#### `TASK-P3-FE-02`: `tripService.ts` Client Implementation
- **Description:** Implement Axios/Fetch client functions handling authentication headers, API responses, error envelope unwrapping, and lifecycle actions (`publish`, `archive`, `restore`, `unpublish`).
- **Dependencies:** `TASK-P3-FE-01`.
- **Target Files:** `frontend/src/services/tripService.ts`.
- **Acceptance Criteria:**
  - [ ] Methods implemented: `createTrip`, `getTripById`, `listMyTrips`, `listPublicTrips`, `updateTrip`, `deleteTrip`, `publishTrip`, `archiveTrip`, `restoreTrip`, `unpublishTrip`.
  - [ ] Stop methods: `getStops`, `addStop`, `updateStop`, `deleteStop`, `reorderStops`.
  - [ ] All methods pass Supabase Bearer token and handle 401/403/404/422 HTTP errors.
- **Priority:** P0

---

### Epic 6: Frontend UI Components & Screens

#### `TASK-P3-FE-03`: `JourneyTimeline` Component (Screen 17)
- **Description:** Build the vertical timeline component visualizing Start Destination $\rightarrow$ Optional Intermediate Stops $\rightarrow$ End Destination.
- **Dependencies:** `TASK-P3-FE-01`.
- **Target Files:** `frontend/src/components/trips/JourneyTimeline.tsx`.
- **Acceptance Criteria:**
  - [ ] Displays Start Location with origin badge.
  - [ ] If stops exist, displays Intermediate Stops in `order_index` order with dates, notes, and activity chips.
  - [ ] If 0 stops exist, cleanly connects Start Location directly to End Location with dashed direct journey indicator.
  - [ ] Displays End Location with checkered finish badge.
  - [ ] Supports interactive edit/delete controls when in owner edit mode.
- **Priority:** P0

#### `TASK-P3-FE-04`: `TripCard` & `TripBadge` Atoms
- **Description:** Build reusable trip card and badge components for displaying journeys in lists and dashboards.
- **Dependencies:** `TASK-P3-FE-01`.
- **Target Files:**
  - `frontend/src/components/trips/TripCard.tsx`
  - `frontend/src/components/trips/TripBadge.tsx`
- **Acceptance Criteria:**
  - [ ] Renders cover image, title, category chip, start/end dates, and starting/ending destinations.
  - [ ] Displays Visibility (`public` vs `private`) and Status (`draft`, `published`, `archived`) badges.
  - [ ] Matches design tokens (`bg-surface`, `rounded-2xl`, Adventure Orange accents).
- **Priority:** P1

#### `TASK-P3-FE-05`: `CreateTripScreen` (Screen 13)
- **Description:** Build the full-page trip creation wizard/form with privacy-by-default selection.
- **Dependencies:** `TASK-P3-FE-02`, `TASK-P3-FE-04`.
- **Target Files:** `frontend/src/screens/CreateTripScreen.tsx`.
- **Acceptance Criteria:**
  - [ ] Form inputs for title, category, starting/ending locations, dates, and visibility.
  - [ ] Visibility selector pre-selects "Private" by default with toggle to "Public".
  - [ ] Client-side validation for required fields and date logic (`end_date >= start_date`).
  - [ ] Submits to backend and redirects to `TripEditorScreen`.
- **Priority:** P0

#### `TASK-P3-FE-06`: `TripEditorScreen` (Screen 14)
- **Description:** Build the comprehensive trip management workspace for updating metadata, managing stops, and triggering lifecycle actions.
- **Dependencies:** `TASK-P3-FE-02`, `TASK-P3-FE-03`, `TASK-P3-FE-05`.
- **Target Files:** `frontend/src/screens/TripEditorScreen.tsx`.
- **Acceptance Criteria:**
  - [ ] Editable trip details (title, dates, category, visibility).
  - [ ] Interactive stops manager with "Add Stop" button.
  - [ ] Reordering controls (Move Up / Move Down or Drag-and-Drop) calling atomic `/reorder` endpoint.
  - [ ] Action buttons trigger dedicated endpoints: "Save Draft" (`PATCH`), "Publish Journey" (`/publish`), "Unpublish" (`/unpublish`), "Archive" (`/archive`), and "Delete Trip" (`DELETE`).
  - [ ] Displays publishing checklist modal if validation errors are returned.
- **Priority:** P0

#### `TASK-P3-FE-07`: `StopModal` & Stop Editor (Screens 15 & 16)
- **Description:** Build modal dialog for adding and editing individual journey stops.
- **Dependencies:** `TASK-P3-FE-01`.
- **Target Files:** `frontend/src/components/trips/StopModal.tsx`.
- **Acceptance Criteria:**
  - [ ] Form fields: stop name, location, latitude, longitude, arrival/departure dates, accommodation, notes.
  - [ ] Validates coordinate boundaries (-90..90, -180..180).
  - [ ] Accessible modal backdrop with Escape key and click-outside dismissal.
- **Priority:** P0

#### `TASK-P3-FE-08`: `TripDetailsScreen` (Screen 19)
- **Description:** Build the flagship trip viewer page with branching logic for owners vs. public visitors.
- **Dependencies:** `TASK-P3-FE-02`, `TASK-P3-FE-03`.
- **Target Files:** `frontend/src/screens/TripDetailsScreen.tsx`.
- **Acceptance Criteria:**
  - [ ] Renders hero cover image, title, owner profile chip, dates, category, and stats.
  - [ ] Renders the complete `JourneyTimeline`.
  - [ ] If Owner: displays quick "Edit Journey" button and draft/privacy indicators.
  - [ ] If Visitor accessing private trip: catches 403 and redirects to `AccessDeniedScreen`.
- **Priority:** P0

#### `TASK-P3-FE-09`: `AccessDeniedScreen` (Screen 33) & `ConfirmModal` (Screen 35)
- **Description:** Implement the 403 Forbidden unauthorized access screen and confirmation dialogs.
- **Dependencies:** None.
- **Target Files:**
  - `frontend/src/screens/AccessDeniedScreen.tsx`
  - `frontend/src/components/common/ConfirmModal.tsx`
- **Acceptance Criteria:**
  - [ ] `AccessDeniedScreen` informs visitor that the journey is private, providing a button to return to Explore or Home.
  - [ ] `ConfirmModal` displays customizable danger warnings before executing delete/archive operations.
- **Priority:** P1

#### `TASK-P3-FE-10`: `MyTripsScreen` & Route Configuration
- **Description:** Create personal trip dashboard and wire all new screens into `App.tsx` with `ProtectedRoute` guards.
- **Dependencies:** `TASK-P3-FE-05`, `TASK-P3-FE-06`, `TASK-P3-FE-08`, `TASK-P3-FE-09`.
- **Target Files:**
  - `frontend/src/screens/MyTripsScreen.tsx`
  - `frontend/src/App.tsx`
- **Acceptance Criteria:**
  - [ ] Routes configured:
    - `/trips/create` (Protected $\rightarrow$ `CreateTripScreen`)
    - `/trips/:id/edit` (Protected $\rightarrow$ `TripEditorScreen`)
    - `/trips/:id` (Public/Conditional $\rightarrow$ `TripDetailsScreen`)
    - `/my-trips` (Protected $\rightarrow$ `MyTripsScreen`)
    - `/access-denied` (Public $\rightarrow$ `AccessDeniedScreen`)
  - [ ] `MyTripsScreen` displays user journeys with tabs: "Published", "Drafts", "Archived".
- **Priority:** P0

---

### Epic 7: Automated Testing & Verification

#### `TASK-P3-TEST-01`: Pytest Trip CRUD & Lifecycle Suite [SQLite Emulated]
- **Target Files:** `backend/tests/test_trips.py`.
- **Engine Tag:** SQLite Emulated Unit Test.
- **Acceptance Criteria:**
  - [ ] Test trip creation with valid and invalid data (missing title, invalid category).
  - [ ] Test date validation (end date before start date rejected with 422).
  - [ ] Test that `PATCH /trips/{id}` with `status` does NOT modify trip status.
  - [ ] Test publishing point-to-point trip (0 stops) succeeds (HTTP 200).
  - [ ] Test publishing trip with stops succeeds (HTTP 200).
  - [ ] Test publishing trip with missing required fields (e.g. missing dates or destinations) fails with HTTP 422 (`PUBLISH_VALIDATION_FAILED`).
  - [ ] Test `POST /trips/{id}/archive` transitions `published` $\rightarrow$ `archived`.
  - [ ] Test `POST /trips/{id}/restore` transitions `archived` $\rightarrow$ `published` (re-verifying checklist).
  - [ ] Test `POST /trips/{id}/unpublish` transitions `published` $\rightarrow$ `draft`.
  - [ ] Test invalid lifecycle transitions (archiving draft, unpublishing draft) fail with HTTP 422 (`INVALID_STATE_TRANSITION`).
- **Priority:** P0

#### `TASK-P3-TEST-02`: Pytest Stop Reordering & Pessimistic Lock Suite [SQLite Emulated]
- **Target Files:** `backend/tests/test_trip_stops.py`.
- **Engine Tag:** SQLite Emulated Unit Test.
- **Acceptance Criteria:**
  - [ ] Test stop creation with sequential `order_index`.
  - [ ] Test coordinate range validation (lat > 90 or lng > 180 rejected).
  - [ ] Test foreign stop ID rejection: mutating `/trips/{trip_A}/stops/{stop_B_id}` fails with 404.
  - [ ] Test atomic stop reordering validation: duplicate stop IDs fail with 422 (`DUPLICATE_STOP_IDS`).
  - [ ] Test atomic stop reordering validation: omitted stop IDs fail with 422 (`INCOMPLETE_STOP_SEQUENCE`).
  - [ ] Test atomic stop reordering validation: foreign stop IDs fail with 422 (`FOREIGN_STOP_ID`).
  - [ ] Test empty stop list reorder behavior: 0 stops returns 200 OK (`[]`), $>0$ stops returns 422 (`INCOMPLETE_STOP_SEQUENCE`) (`TC-STOP-17`).
  - [ ] Test non-contiguous indices reorder normalization: sparse indices $[0, 50, 9999]$ normalized to $[0, 1, 2]$ (`TC-STOP-18`).
  - [ ] Test collision-free reordering using Two-Phase Positive Disjoint Offset, proving non-negativity (`order_index >= 0`) and uniqueness throughout.
  - [ ] Test concurrent stop operation simulation: parent trip locking serializes concurrent requests without deadlock or sequence gap.
- **Priority:** P0

#### `TASK-P3-TEST-03`: SQLite Emulated Privacy Suite [SQLite Emulated]
- **Target Files:** `backend/tests/test_trip_privacy_rls.py`.
- **Engine Tag:** SQLite Emulated Unit Test (Explicit Disclaimer: Emulation only; does not support `SELECT ... FOR UPDATE` or `DEFERRABLE UNIQUE`).
- **Acceptance Criteria:**
  - [ ] User A creates private trip $\rightarrow$ User B GET returns 403 Forbidden.
  - [ ] Unauthenticated visitor GET on private trip returns 403 Forbidden.
  - [ ] User A creates draft trip $\rightarrow$ User B GET returns 403 Forbidden.
  - [ ] User A publishes public trip $\rightarrow$ Visitor and User B GET returns 200 OK.
  - [ ] User B attempts PATCH or DELETE on User A's trip $\rightarrow$ 403 Forbidden.
  - [ ] User B attempts to add or delete stops on User A's trip $\rightarrow$ 403 Forbidden.
- **Priority:** P0

#### `TASK-P3-TEST-04`: PostgreSQL Native RLS & Concurrency Integration Suite [PostgreSQL Container]
- **Target Files:** `backend/tests/test_postgres_rls_integration.py`.
- **Engine Tag:** Native PostgreSQL Engine (Production Security & Concurrency Proof).
- **Acceptance Criteria:**
  - [ ] Gated by `POSTGRES_TEST_DATABASE_URL` (dedicated PostgreSQL container).
  - [ ] Verifies actual PostgreSQL role switching (`SET LOCAL ROLE authenticated`).
  - [ ] Verifies actual PostgreSQL `auth.uid()` evaluation against `public.trips` and `public.trip_stops`.
  - [ ] Verifies that User B cannot bypass RLS to read or mutate User A's private trips or stops at the raw SQL query level.
  - [ ] Verifies connection pool sanitization after transaction commit/rollback.
  - [ ] (`TC-PG-07`) Verifies atomic Two-Phase Positive Offset reorder under real PostgreSQL without check constraint violations.
  - [ ] (`TC-PG-08`) Verifies complete transaction rollback on failure during reorder with zero leftover positive offsets.
  - [ ] (`TC-PG-09`) Verifies direct SQL enforcement of `CHECK (order_index >= 0)` and `UNIQUE (trip_id, order_index)` at commit.
  - [ ] (`TC-PG-10`) Verifies concurrent mutation serialization via parent trip `SELECT ... FOR UPDATE` across two independent sessions.
  - [ ] (`TC-PG-11`) Verifies PostgreSQL non-contiguous index normalization ($0, 500, 999999 \rightarrow 0, 1, 2$) and boundary values without collisions, plus empty stop list on 0-stop trip.
  - [ ] (`TC-PG-12`) Verifies integer overflow guard (rejection of `order_index > 10^9` with HTTP 422) and direct SQL rejection of 32-bit INT overflow (`order_index = 2_147_483_648` raising error 22003).
- **Priority:** P0 (Production Gate)

#### `TASK-P3-TEST-05`: Frontend Vitest Suite
- **Target Files:**
  - `frontend/src/tests/trips.test.tsx`
  - `frontend/src/tests/timeline.test.tsx`
- **Acceptance Criteria:**
  - [ ] `CreateTripScreen` renders inputs with private visibility pre-selected.
  - [ ] `JourneyTimeline` renders direct connection when 0 intermediate stops exist.
  - [ ] `TripDetailsScreen` renders owner controls for owner and hides them for visitors.
  - [ ] `AccessDeniedScreen` renders when API returns 403.
- **Priority:** P1

#### `TASK-P3-TEST-06`: Production Build & Final Verification
- **Target Files:** Whole repository.
- **Acceptance Criteria:**
  - [ ] All backend unit and integration test suites pass.
  - [ ] All frontend Vitest component tests pass.
  - [ ] Frontend build succeeds: `npm run build` compiles cleanly with zero TypeScript errors.
- **Priority:** P0
