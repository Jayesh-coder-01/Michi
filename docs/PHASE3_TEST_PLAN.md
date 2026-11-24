# MICHI (道) — Phase 3 Test Plan & Quality Assurance Strategy

**Document Version:** 1.2 (Architecture Harmonization & Concurrency Verification)  
**Status:** Approved for Review (Verification Strategy & Quality Gates)  
**Date:** November 2026  
**Authors:** QA Lead & Full-Stack Testing Engineer  
**Source of Truth:** [PRD.md](PRD.md), [TESTING.md](TESTING.md), [SECURITY.md](SECURITY.md), [API.md](API.md), [PHASE3_GAP_ANALYSIS.md](PHASE3_GAP_ANALYSIS.md)

---

## 1. Testing Philosophy & Quality Gates

In accordance with PRD Section 15 and [docs/TESTING.md](TESTING.md), the core quality mandates for Phase 3 are:
1. **Zero Data Leakage:** A user must never be able to retrieve or mutate another user's private trip, draft journey, or associated stops through the frontend, API, or database layer.
2. **Stop Ownership Integrity:** Stop mutations must verify parent-trip ownership and immediately reject foreign stop IDs belonging to other trips.
3. **Atomic Reordering Integrity:** Journey stops reordering must validate against duplicate, omitted, or foreign IDs, executing inside an atomic transaction with complete rollback on failure.
4. **Mandatory Publishing Checklist:** Trips must pass full validation (title, category, starting/ending locations, valid date range; PRD Module 3 does not mandate intermediate stops, so point-to-point journeys with 0 stops are valid) before entering `published` status.
5. **Lifecycle State Integrity:** Trip status cannot be updated via ordinary `PATCH /trips/{id}`. Dedicated lifecycle endpoints (`/publish`, `/unpublish`, `/archive`, `/restore`) enforce valid state transitions.
6. **Concurrency & Locking Proof:** Add, delete, and reorder operations on stops serialize using parent trip `SELECT ... FOR UPDATE` row locks in PostgreSQL. Intermediate reorder updates strictly preserve non-negativity (`order_index >= 0`) and uniqueness via Two-Phase Positive Disjoint Offset.
7. **Database Engine Clarity & Separation:** SQLite tests emulate application logic, schema mapping, and Pydantic validation. SQLite does **not** support `SELECT ... FOR UPDATE` or `DEFERRABLE` unique constraints. Real row-level locking, MVCC serialization, and PostgreSQL constraint semantics must be verified against native PostgreSQL.

---

## 2. Test Architecture & Environment

```mermaid
flowchart TD
    subgraph SQLiteHarness["Local Unit Test Harness (SQLite Emulation)"]
        PYTEST_LOCAL["pytest (Local CLI & Fast CI)"]
        SQLITE_DB["In-Memory SQLite (Hermetic Emulation via Triggers)"]
        DISCLAIMER["Notice: Emulation only; does NOT prove PostgreSQL RLS"]
    end

    subgraph PostgresHarness["PostgreSQL Integration Harness (Dedicated Container)"]
        PYTEST_PG["pytest (tests/test_postgres_rls_integration.py)"]
        POSTGRES_DB["Real PostgreSQL 15+ Container via POSTGRES_TEST_DATABASE_URL"]
        RLS_PROOF["Mandatory Production Security Proof: SET LOCAL ROLE authenticated"]
    end

    subgraph FrontendHarness["Frontend Vitest Harness"]
        VITEST["Vitest 1.6+ & JSDOM"]
        RTL["@testing-library/react"]
        ROUTER_CTX["MemoryRouter (Simulated Navigation)"]
    end

    PYTEST_LOCAL --> SQLITE_DB
    PYTEST_PG --> POSTGRES_DB
```

> [!CAUTION]
> **Database Engine Distinction & Capability Boundaries:**
> - Tests tagged `[SQLite Emulated]` prove application endpoint logic, schema validation, and Pydantic models. SQLite does **not** support PostgreSQL's `SELECT ... FOR UPDATE` row locks or `DEFERRABLE INITIALLY DEFERRED` unique constraints.
> - Tests tagged `[PostgreSQL Native RLS & Concurrency]` prove actual database security policies, role switching, MVCC row-level locking, and deferred uniqueness on PostgreSQL.
> - **Rule:** Passing SQLite tests does not prove PostgreSQL RLS security or row-locking concurrency.

---

## 3. Backend Test Matrix (Pytest)

### 3.1 Trip CRUD & Lifecycle Suite (`tests/test_trips.py`) [SQLite Emulated]

| Test ID | Description | Input / Setup | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `TC-TRIP-01` | Create valid draft trip | Valid `TripCreate` payload with start/end destinations | HTTP 201; `status == 'draft'`; `owner_id == user.id`; ID is UUID |
| `TC-TRIP-02` | Reject trip with missing required fields | Payload missing `title` or `starting_location` | HTTP 422 Unprocessable Entity; error details list missing field |
| `TC-TRIP-03` | Reject invalid category | `category: 'Space travel'` | HTTP 422 Unprocessable Entity |
| `TC-TRIP-04` | Reject invalid date range | `start_date: '2027-08-10'`, `end_date: '2027-08-01'` | HTTP 422 Unprocessable Entity; date validation error |
| `TC-TRIP-05` | Retrieve owned trip by ID | Valid trip ID owned by caller | HTTP 200; returns full `TripResponse` with owner snippet |
| `TC-TRIP-06` | Update trip metadata | Partial `TripUpdate` modifying title, category, and dates | HTTP 200; attributes updated; `updated_at` refreshed |
| `TC-TRIP-07` | Publish valid draft trip (with stops) | Trip with all fields and 1+ stops; call `POST /publish` | HTTP 200; `status` transitions to `published` |
| `TC-TRIP-08` | Publish point-to-point journey (0 stops) | Draft trip with title, category, starting/ending location, valid dates, 0 stops; call `POST /publish` | HTTP 200; `status` transitions to `published` (Conforms to PRD Module 3) |
| `TC-TRIP-09` | Reject publishing trip with missing required fields | Draft trip missing dates or starting location; call `POST /publish` | HTTP 422; code `PUBLISH_VALIDATION_FAILED` |
| `TC-TRIP-10` | Archive published trip | Published trip; call `POST /archive` | HTTP 200; `status` transitions to `archived` |
| `TC-TRIP-11` | Restore archived trip | Archived trip meeting publishing checklist; call `POST /restore` | HTTP 200; `status` transitions to `published` |
| `TC-TRIP-12` | Unpublish trip to draft | Published trip; call `POST /api/v1/trips/{id}/unpublish` | HTTP 200; `status` transitions to `draft` |
| `TC-TRIP-13` | Delete owned trip (Cascading) | Call `DELETE /api/v1/trips/{id}` on trip with 3 stops | HTTP 200; trip and all child stops removed from database |
| `TC-TRIP-14` | List my trips | User with 2 drafts, 1 published, 1 archived trip | HTTP 200; returns all 4 trips; status filter correctly subsets |
| `TC-TRIP-15` | Reject invalid lifecycle transitions | Draft trip calling `/restore` or `/unpublish`; archived trip calling `/publish` directly | HTTP 422; code `INVALID_STATE_TRANSITION` |
| `TC-TRIP-16` | Reject PATCH payload containing `status` | Call `PATCH /trips/{id}` with `{"status": "published"}` | HTTP 422 Unprocessable Entity (`extra_forbidden`); status cannot be modified via PATCH |

---

### 3.2 Journey Stops & Reordering Suite (`tests/test_trip_stops.py`) [SQLite Emulated]

| Test ID | Description | Input / Setup | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `TC-STOP-01` | Add first stop to trip | Valid `TripStopCreate` payload | HTTP 201; `order_index == 0`; stop associated with trip |
| `TC-STOP-02` | Add multiple sequential stops | Add 3 stops consecutively | Stops receive `order_index` values `0`, `1`, `2` |
| `TC-STOP-03` | Reject invalid latitude | `latitude: 95.5` ($> 90$) | HTTP 422 Unprocessable Entity; coordinate error |
| `TC-STOP-04` | Reject invalid longitude | `longitude: -185.0` ($< -180$) | HTTP 422 Unprocessable Entity; coordinate error |
| `TC-STOP-05` | Reject departure before arrival | `arrival: '2027-07-15'`, `departure: '2027-07-12'` | HTTP 422 Unprocessable Entity; date validation error |
| `TC-STOP-06` | Edit stop details | Partial `TripStopUpdate` modifying notes and activities | HTTP 200; attributes modified successfully |
| `TC-STOP-07` | Reject editing foreign stop ID | Call `PATCH /trips/{trip_A}/stops/{stop_B_id}` | **HTTP 404 Not Found** (Stop does not belong to trip) |
| `TC-STOP-08` | Reject deleting foreign stop ID | Call `DELETE /trips/{trip_A}/stops/{stop_B_id}` | **HTTP 404 Not Found** (Stop does not belong to trip) |
| `TC-STOP-09` | Remove stop & re-normalize | Trip with stops $[A(0), B(1), C(2)]$; delete $B$ | HTTP 200; remaining stops re-indexed to $[A(0), C(1)]$ |
| `TC-STOP-10` | Valid batch reorder stops | Reorder $[A, B, C] \rightarrow [C, A, B]$ via `/reorder` | HTTP 200; database reflects new order indices $C(0), A(1), B(2)$ |
| `TC-STOP-11` | Reject reorder with duplicate IDs | Payload: `[A, A, B]` | HTTP 422; code `DUPLICATE_STOP_IDS` |
| `TC-STOP-12` | Reject reorder with omitted stop | Trip has $[A, B, C]$; Payload: `[A, B]` | HTTP 422; code `INCOMPLETE_STOP_SEQUENCE` |
| `TC-STOP-13` | Reject reorder with foreign stop | Payload: `[A, B, foreign_stop_id]` | HTTP 422; code `FOREIGN_STOP_ID` |
| `TC-STOP-14` | Transactional rollback on error | Trigger synthetic DB error midway during batch update | HTTP 500; entire reorder rolled back to pristine sequence |
| `TC-STOP-15` | Concurrent stop addition serialization | Two concurrent asynchronous requests adding stops to the same trip | Parent lock (`with_for_update()`) serializes execution; both succeed with consecutive `order_index` (e.g. 0 and 1); no duplicate key errors |
| `TC-STOP-16` | Concurrent reorder and mutation isolation | Concurrent `PUT /reorder` and `DELETE /stops/{id}` on same trip | Parent lock serializes execution; two-phase positive disjoint offset prevents index collisions and preserves `order_index >= 0`; database state remains consistent |
| `TC-STOP-17` | Reorder empty stop list behavior | 1) Trip has 0 stops, payload `[]`; 2) Trip has 2 stops, payload `[]` | 1) HTTP 200 OK, returns `[]` (idempotent no-op); 2) HTTP 422 Unprocessable Entity (`INCOMPLETE_STOP_SEQUENCE`) |
| `TC-STOP-18` | Reorder non-contiguous indices normalization | Trip has stops at sparse indices $[0, 50, 9999]$; payload reverses order | HTTP 200 OK; indices normalized seamlessly to $[0, 1, 2]$ without collision |

---

### 3.3 Privacy & RLS Authorization Isolation Suite (`tests/test_trip_privacy_rls.py`) [SQLite Emulated]

| Test ID | Scenario | Actor | Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| `TC-SEC-01` | Private trip visibility | User B (Non-owner) | GET `/trips/{user_a_private_trip_id}` | **HTTP 403 Forbidden** (`PERMISSION_DENIED`) |
| `TC-SEC-02` | Private trip unauthenticated | Anonymous Visitor | GET `/trips/{user_a_private_trip_id}` | **HTTP 403 Forbidden** (`PERMISSION_DENIED`) |
| `TC-SEC-03` | Draft trip visibility | User B (Non-owner) | GET `/trips/{user_a_draft_trip_id}` | **HTTP 403 Forbidden** (Drafts are strictly private) |
| `TC-SEC-04` | Published public trip | Anonymous Visitor | GET `/trips/{user_a_public_trip_id}` | **HTTP 200 OK** (Publicly accessible) |
| `TC-SEC-05` | Private stop inheritance | User B (Non-owner) | GET `/trips/{user_a_private_trip_id}/stops` | **HTTP 403 Forbidden** |
| `TC-SEC-06` | Modify foreign trip | User B (Non-owner) | PATCH `/trips/{user_a_trip_id}` | **HTTP 403 Forbidden** |
| `TC-SEC-07` | Delete foreign trip | User B (Non-owner) | DELETE `/trips/{user_a_trip_id}` | **HTTP 403 Forbidden** |
| `TC-SEC-08` | Add stop to foreign trip | User B (Non-owner) | POST `/trips/{user_a_trip_id}/stops` | **HTTP 403 Forbidden** |
| `TC-SEC-09` | Delete stop from foreign trip | User B (Non-owner) | DELETE `/trips/{user_a_trip_id}/stops/{stop}`| **HTTP 403 Forbidden** |
| `TC-SEC-10` | Unauthenticated trip listing | Anonymous Visitor | GET `/trips` (User Dashboard) | **HTTP 401 Unauthorized** |
| `TC-SEC-11` | Community public feed | Anonymous Visitor | GET `/trips/public` | **HTTP 200 OK** (Excludes all private & draft trips) |

---

### 3.4 PostgreSQL Native RLS & Concurrency Integration Suite (`tests/test_postgres_rls_integration.py`) [PostgreSQL Native RLS]

* **Environment:** Real PostgreSQL container connected via `POSTGRES_TEST_DATABASE_URL`.
* **Execution:** Real PostgreSQL engine executing `SET LOCAL ROLE authenticated` and `set_config('request.jwt.claims', ...)`.

| Test ID | PostgreSQL Specific Verification | Expected Result |
| :--- | :--- | :--- |
| `TC-PG-01` | Role switching to `authenticated` with User A's claims | `auth.uid()` evaluates to User A UUID |
| `TC-PG-02` | Direct SQL `SELECT` on `public.trips` by User B | User A's private trips are invisible (0 rows returned) |
| `TC-PG-03` | Direct SQL `UPDATE` on `public.trips` by User B | 0 rows affected; RLS prevents modification |
| `TC-PG-04` | Direct SQL `INSERT` into `public.trip_stops` by User B for User A's trip | `ERROR: 42501` (new row violates RLS policy) |
| `TC-PG-05` | Stop `trip_id` immutability trigger | Direct UPDATE attempting `trip_id = new_trip_id` raises exception |
| `TC-PG-06` | Transaction rollback and connection pool sanitization | `RESET ROLE; DISCARD TEMP;` verified; no claim leakage |
| `TC-PG-07` | PostgreSQL Two-Phase Positive Offset Reorder | Reorder stops using positive disjoint offset on real PostgreSQL; verify `order_index >= 0` check constraint is strictly satisfied at every statement, uniqueness is maintained, and final sequence matches target order |
| `TC-PG-08` | PostgreSQL Reorder Rollback on Failure | Induce mid-transaction failure during Phase 2; verify transaction rolls back completely to pristine sequence with zero residual positive offsets |
| `TC-PG-09` | PostgreSQL Constraint Enforcement (`CHECK >= 0` & Unique) | Direct SQL attempt to set `order_index < 0` immediately raises `check_violation (23514)`; duplicate `(trip_id, order_index)` at commit raises `unique_violation (23505)` |
| `TC-PG-10` | PostgreSQL Concurrent Mutation Serialization (`SELECT ... FOR UPDATE`) | Open two concurrent sessions on same trip; Session 1 locks trip via `SELECT ... FOR UPDATE`; Session 2 attempts stop mutation; verify Session 2 blocks until Session 1 commits |
| `TC-PG-11` | PostgreSQL Non-Contiguous Index Normalization & Boundary Values | Setup trip with stops at sparse indices $[0, 500, 999999]$; execute reorder; verify Phase 1 disjoint shift ($safe\_offset = 1,000,999 \ge 1000$), Phase 2 sequential write ($0, 1, 2$), non-negative CHECK validity at all times, and zero collisions. Also verify empty stop list on 0-stop trip succeeds |
| `TC-PG-12` | PostgreSQL Integer Boundary Enforcement & Overflow Rejection | Part A: Reorder trip with stop at `order_index = 1_000_000_001` ($> 10^9$) is immediately rejected with HTTP 422 (`ORDER_INDEX_OVERFLOW`) before DB mutation. Part B: Direct SQL setting `order_index = 2_147_483_648` ($2^{31}$) raises PostgreSQL error `22003 (numeric_value_out_of_range)`; setting `2_147_483_647` succeeds |

---

## 4. Frontend Component & Flow Tests (Vitest)

### 4.1 Component Unit Tests (`frontend/src/tests/timeline.test.tsx`)
- **`JourneyTimeline` Rendering:**
  - Verify Start Destination renders with starting pin badge.
  - Verify each intermediate stop renders with `order_index + 1` badge, location, dates, and notes.
  - Verify End Destination renders with checkered finish badge.
  - Verify connecting vertical line renders between nodes.
  - Verify edit and delete buttons appear when `isOwner={true}` and are hidden when `isOwner={false}`.

### 4.2 Screen & Interaction Tests (`frontend/src/tests/trips.test.tsx`)
- **`CreateTripScreen`:**
  - Verify all form inputs render (title, category, starting/ending locations, dates, visibility).
  - Verify submit button is disabled or triggers validation error on empty required fields.
  - Verify successful submission redirects to `/trips/:id/edit`.
- **`TripEditorScreen`:**
  - Verify existing trip details pre-populate form fields.
  - Verify "Add Stop" button triggers `StopModal`.
  - Verify "Publish Journey" displays error modal if checklist is unmet.
  - Verify successful publication updates status badge to `published`.
- **`TripDetailsScreen`:**
  - Verify owner controls ("Edit Journey", "Delete") render for the trip author.
  - Verify owner controls are hidden for non-owner visitors.
  - Verify 403 error from API renders `AccessDeniedScreen` with "Back to Explore" button.
- **`MyTripsScreen`:**
  - Verify tabs ("Published", "Drafts", "Archived") correctly filter displayed trip cards.
  - Verify "Create New Trip" hero button navigates to `/trips/create`.

---

## 5. Automated Verification & Execution Commands

### Backend Test Execution
```bash
# 1. Execute local SQLite emulated unit tests
cd michi/backend
.venv/Scripts/pytest tests/test_trips.py tests/test_trip_stops.py tests/test_trip_privacy_rls.py -v

# 2. Execute PostgreSQL Native RLS integration tests (requires Docker container)
$env:POSTGRES_TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/michi_test"
.venv/Scripts/pytest tests/test_postgres_rls_integration.py -v
```

### Frontend Test & Build Execution
```bash
# Execute Vitest component test suites
cd michi/frontend
npm test -- --run

# Execute TypeScript type check and production bundle compilation
npm run build
```

---

## 6. Phase 3 Approval & Exit Criteria

Phase 3 development will be deemed **COMPLETE and READY FOR PRODUCTION REVIEW** when:
1. All 16 backend trip CRUD, publishing checklist, and lifecycle tests pass.
2. All 18 backend stop CRUD, concurrency, overflow guard, and reordering tests pass.
3. All 11 backend SQLite emulated privacy tests pass.
4. All 12 PostgreSQL native RLS, constraint boundary, and concurrency integration tests pass against a real PostgreSQL engine when `POSTGRES_TEST_DATABASE_URL` is set.
5. All frontend Vitest component tests pass with zero warnings.
6. `npm run build` succeeds with zero TypeScript errors.
7. No secrets, credentials, or development reset tokens are exposed in code or responses.
