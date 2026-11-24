# MICHI (道) — Phase 3 Planning Gap Analysis & Architecture Corrections

**Document Version:** 1.2 (Final Architecture Corrections Revision)  
**Status:** Approved for Review (Pre-Implementation Architecture Audit)  
**Date:** November 2026  
**Authors:** Lead Full-Stack Engineer & System Architect  
**Source of Truth:** [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API.md](API.md), [SECURITY.md](SECURITY.md), [USER_FLOWS.md](USER_FLOWS.md), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)

---

## 1. Executive Summary

This document formalizes the final architectural corrections applied to the Phase 3 planning package prior to Wave 1 implementation. Following an exhaustive technical review, four critical architectural areas were identified and corrected across all planning documents:

1. **Strict Lifecycle Enforcement & Mutation Isolation:** Total removal of `status` from general `TripUpdate`/`PATCH` endpoints; restriction of lifecycle transitions to dedicated endpoints (`/publish`, `/archive`, `/restore`, `/unpublish`) with strict service-level transition validation.
2. **Concurrent Stop Operations & Parent-Trip Locking:** Implementation of pessimistic row-level locking (`SELECT ... FOR UPDATE`) on the parent trip record for all stop mutations (add, delete, reorder) to serialize concurrent operations, accompanied by a collision-free update strategy for `(trip_id, order_index)`.
3. **Product Requirement Truth Audit (Minimum Intermediate Stop):** Exhaustive search of [docs/PRD.md](PRD.md) confirmed that the PRD contains **no requirement** that published trips must contain at least one intermediate stop. Point-to-point journeys (Origin $\rightarrow$ Destination) are fully supported. The invented 1-stop requirement has been removed from publishing validation and test plans.
4. **Visibility Selection & Default Harmonization:** Resolution of the contradiction between defaulting visibility to `private` and requiring user selection. Established a unified rule: `private` default in DB schema and API schemas, with the UI defaulting to `private` while allowing explicit user toggle to `public`.

---

## 2. Detailed Issue Analysis & Remediation Matrix

### Issue 1: Lifecycle Enforcement & Mutation Isolation
* **Finding:** Allowing `status` in the general `TripUpdate` Pydantic model and `PATCH /api/v1/trips/{id}` endpoint creates a security hole where clients could bypass publishing validation (e.g., publishing a trip without dates or destinations) simply by sending `{"status": "published"}`.
* **Remediation:**
  1. **Removed `status` from `TripUpdate`:** The `status` field is completely stripped from `TripUpdate`. Clients cannot modify status via `PATCH /trips/{id}`.
  2. **Dedicated Lifecycle Endpoints:** Status changes are restricted exclusively to explicit lifecycle actions:
     - `POST /api/v1/trips/{id}/publish`: Transitions `draft` $\rightarrow$ `published` (or `archived` $\rightarrow$ `published`). Enforces mandatory publishing checklist.
     - `POST /api/v1/trips/{id}/archive`: Transitions `published` $\rightarrow$ `archived`.
     - `POST /api/v1/trips/{id}/restore`: Transitions `archived` $\rightarrow$ `published` (re-validates publishing rules).
     - `POST /api/v1/trips/{id}/unpublish`: Transitions `published` $\rightarrow$ `draft`.
  3. **Service Layer Validation Matrix:** `TripService` validates current trip status against permitted transitions. Attempting an illegal transition (e.g., archiving a draft, or unpublishing an archived trip) raises HTTP 422 (`INVALID_STATE_TRANSITION`).

---

### Issue 2: Concurrent Stop Operations & Parent-Trip Locking
* **Finding:** If multiple requests to add, delete, or reorder stops on the same trip execute concurrently, race conditions can cause duplicate `order_index` values, gaps in sequences, or index collision deadlocks.
* **Remediation:**
  1. **Parent-Trip Locking (`SELECT ... FOR UPDATE`):**
     Every stop operation (`POST /stops`, `DELETE /stops/{id}`, `PUT /stops/reorder`) begins by acquiring an exclusive row-level lock on the parent trip record:
     ```python
     parent_trip = db.query(TripModel).filter(TripModel.id == trip_id).with_for_update().first()
     ```
     This serializes all concurrent stop modifications for that journey at the database lock level in PostgreSQL.
  2. **Resolution of Non-Negative CHECK, Integer Boundaries, and Unique Constraint Contradiction:**
     - The schema enforces `CONSTRAINT valid_order_index CHECK (order_index >= 0)` and `CONSTRAINT uq_trip_stops_trip_order UNIQUE (trip_id, order_index) DEFERRABLE INITIALLY DEFERRED`.
     - In PostgreSQL, **CHECK constraints cannot be deferred**. Assigning temporary negative numbers (`order_index = -(order_index + 1)`) causes an immediate `check_violation (23514)` error.
     - **Integer Boundary & Overflow Guard:** `order_index` is stored as 32-bit signed `INT` ($0$ to $2,147,483,647$). To avoid integer overflow during positive offset shifts, `TripStopService` enforces `SAFE_MAX_ORDER_INDEX = 1_000_000_000`. If `current_max > 1_000_000_000`, the reorder request is rejected with HTTP 422 (`ORDER_INDEX_OVERFLOW`).
       - *Mathematical Proof:* For `current_max <= 10^9`, $\text{safe\_offset} \le 1,000,001,000$, and shifted indices reach at most $2,000,001,000 < 2,147,483,647$ (`INT4_MAX`).
     - **Empty Stop List (`[]`) Handling:** Reordering with `[]` on a 0-stop trip succeeds as an idempotent no-op (`200 OK`, returns `[]`). On a trip with $N > 0$ stops, submitting `[]` fails the count check and is rejected with HTTP 422 (`INCOMPLETE_STOP_SEQUENCE`), guarding against accidental stop deletion.
     - **Non-Contiguous Index Normalization:** For trips with sparse or non-contiguous indices (e.g. $0, 50, 9999$), shifting by $+safe\_offset$ is strictly injective, preserving uniqueness in the disjoint range. Phase 2 assigns dense contiguous indices $0, \dots, N - 1$, automatically normalizing the sequence and eliminating gaps without collision.
     - To guarantee non-negative compliance and zero duplicate key collisions during intermediate updates, `TripStopService.reorder_stops` applies the **Two-Phase Positive Disjoint Offset Algorithm**:
       - **Compute Safe Disjoint Offset:** `safe_offset = (SELECT COALESCE(MAX(order_index), 0) + 1000 FROM trip_stops WHERE trip_id = :trip_id)`.
       - **Phase 1 (Shift to Disjoint Positive Range):** Set `order_index = order_index + safe_offset` for all stops of `trip_id`. Values shift into $[safe\_offset, safe\_offset + current\_max]$ ($\ge 1000 > 0$), strictly satisfying `CHECK (order_index >= 0)` and maintaining mutual uniqueness.
       - **Phase 2 (Assign Target Indices):** For each `(target_idx, stop_id)` in `enumerate(ordered_stop_ids)`, set `order_index = target_idx`. Since $[0, N - 1]$ and $[safe\_offset, safe\_offset + current\_max]$ are disjoint, no collision or negative value is ever produced.
     - Entire reorder runs inside a single atomic transaction while holding the parent trip lock; rolls back completely on any failure.
  3. **Clear Engine Separation (PostgreSQL vs. SQLite):**
     - **PostgreSQL**: Production engine providing true MVCC row locks (`SELECT ... FOR UPDATE`) and `DEFERRABLE INITIALLY DEFERRED` uniqueness.
     - **SQLite**: Local testing engine that does **not** support `SELECT ... FOR UPDATE` or `DEFERRABLE` unique constraints (relies on `BEGIN IMMEDIATE` file locking). The two-phase positive disjoint offset algorithm runs identically on both without syntax or integrity errors.
  4. **PostgreSQL Concurrency & Boundary Test Coverage:** Added dedicated PostgreSQL tests (`TC-PG-07` through `TC-PG-12`) proving atomic reorder, rollback on failure, non-negative constraint preservation, concurrent mutation serialization, sparse index normalization, and integer overflow boundary rejection.

---

### Issue 3: Minimum Intermediate Stop Requirement Audit
* **Finding:** Prior planning documents required at least 1 intermediate stop to publish (`len(trip.stops) >= 1`).
* **PRD Audit:**
  - An exhaustive regex audit of `docs/PRD.md` confirmed:
    - Zero occurrences of "at least", "minimum", or mandatory stop counts for publication.
    - Module 3 Section 3.1: Trips require Starting Location, Ending Location, Title, Category, Dates, Visibility, Status.
    - FR-TRIP-04: "Users can add starting and ending destinations."
    - FR-TRIP-05: "Users can add multiple stops." (Permissive capability, not a mandatory prerequisite).
  - Many authentic journeys are direct point-to-point trips (e.g., Delhi $\rightarrow$ Agra, Tokyo $\rightarrow$ Kyoto) without intermediate waypoints.
* **Remediation:**
  - Removed the 1-stop requirement from publishing validation.
  - Trips with 0 stops can be published if all core journey attributes (title, category, starting location, ending location, valid dates, visibility) are satisfied.
  - Intermediate stops remain fully supported and optional.

---

### Issue 4: Visibility Selection & Default Harmonization
* **Finding:** Planning documents contained a contradiction between saying visibility is defaulted to `private` vs. requiring explicit user selection.
* **Remediation:** Established a unified, unambiguous rule across all tiers:
  1. **Database Tier:** `visibility trip_visibility DEFAULT 'private' NOT NULL`. Guaranteed privacy-by-default at the physical storage engine level.
  2. **API Tier (Creation):** `TripCreate` defaults `visibility = TripVisibility.PRIVATE`. If omitted, the trip is securely private.
  3. **API Tier (Publishing):** `POST /api/v1/trips/{id}/publish` accepts an optional payload: `{"visibility": "public" | "private"}`. If omitted, the trip's existing visibility setting is preserved. At no point is visibility null or ambiguous.
  4. **Frontend Tier:** The `CreateTripScreen` and `PublishTripModal` pre-select "Private" by default (safe by default), allowing the traveller to actively toggle to "Public" if desired.

---

## 3. Comprehensive Planning Document Correction Matrix

| Issue | Affected Files | Exact Changes Made | Verification Tests |
| :--- | :--- | :--- | :--- |
| **1. Lifecycle Enforcement** | `PHASE3_IMPLEMENTATION_PLAN.md`<br/>`PHASE3_TASK_BREAKDOWN.md`<br/>`PHASE3_API_DESIGN.md`<br/>`PHASE3_TEST_PLAN.md` | - Removed `status` from `TripUpdate` Pydantic model.<br/>- Added dedicated `POST /trips/{id}/unpublish` endpoint.<br/>- Codified lifecycle transition matrix in `TripService`.<br/>- Prevented status updates via `PATCH /trips/{id}`. | `TC-TRIP-06`: Verify `PATCH /trips/{id}` with `status` ignores/rejects status change.<br/>`TC-TRIP-15`: Test `unpublish` endpoint.<br/>`TC-TRIP-16`: Test invalid lifecycle transition rejection (HTTP 422). |
| **2. Concurrent Stop Operations & Reordering** | `PHASE3_IMPLEMENTATION_PLAN.md`<br/>`PHASE3_TASK_BREAKDOWN.md`<br/>`PHASE3_DATABASE_DESIGN.md`<br/>`PHASE3_API_DESIGN.md`<br/>`PHASE3_TEST_PLAN.md` | - Added `SELECT ... FOR UPDATE` parent-trip locking on PostgreSQL.<br/>- Documented `DEFERRABLE INITIALLY DEFERRED` constraint on `(trip_id, order_index)`.<br/>- Replaced negative offsets with Two-Phase Positive Disjoint Offset algorithm to respect `CHECK (order_index >= 0)`.<br/>- Enforced `SAFE_MAX_ORDER_INDEX = 1_000_000_000` to prevent 32-bit INT overflow.<br/>- Defined empty list `[]` idempotent behavior for 0 stops vs 422 rejection for $>0$ stops.<br/>- Defined automatic sequence normalization for sparse non-contiguous existing indices.<br/>- Separated PostgreSQL MVCC locking from SQLite file locking.<br/>- Bound add, delete, and reorder operations to parent lock. | `TC-STOP-15`: Concurrent stop addition race test.<br/>`TC-STOP-16`: Concurrent reorder and stop deletion lock serialization test.<br/>`TC-STOP-17`: Empty stop list reorder behavior.<br/>`TC-STOP-18`: Non-contiguous sparse indices reorder normalization.<br/>`TC-PG-07`: Two-phase positive offset reorder under PostgreSQL.<br/>`TC-PG-08`: Mid-reorder failure rollback.<br/>`TC-PG-09`: PostgreSQL non-negative & unique constraint verification.<br/>`TC-PG-10`: PostgreSQL concurrent mutation serialization (`SELECT ... FOR UPDATE`).<br/>`TC-PG-11`: PostgreSQL non-contiguous index normalization.<br/>`TC-PG-12`: PostgreSQL INT boundary & overflow rejection. |
| **3. Minimum Intermediate Stop** | `PHASE3_IMPLEMENTATION_PLAN.md`<br/>`PHASE3_TASK_BREAKDOWN.md`<br/>`PHASE3_API_DESIGN.md`<br/>`PHASE3_TEST_PLAN.md` | - Audited `PRD.md` and confirmed 0 stops required for point-to-point journeys.<br/>- Removed `len(stops) >= 1` requirement from publishing checklist.<br/>- Updated `TripService.publish_trip` validation logic.<br/>- Point-to-point journeys (0 stops) valid to publish. | `TC-TRIP-07`: Publish valid point-to-point trip (0 stops) succeeds (HTTP 200).<br/>`TC-TRIP-08`: Publish trip with intermediate stops succeeds (HTTP 200). |
| **4. Visibility Selection** | `PHASE3_IMPLEMENTATION_PLAN.md`<br/>`PHASE3_DATABASE_DESIGN.md`<br/>`PHASE3_API_DESIGN.md`<br/>`PHASE3_TEST_PLAN.md` | - Standardized `DEFAULT 'private'` at DB and schema level.<br/>- Defined `TripPublishRequest` with optional visibility override.<br/>- Aligned UI component specs to pre-select "Private" with clear toggle to "Public". | `TC-TRIP-01`: Verify default visibility is `private`.<br/>`TC-TRIP-17`: Verify `/publish` with explicit `visibility: 'public'` updates visibility. |
