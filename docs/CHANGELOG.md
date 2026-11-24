# Changelog & Specification History
## Project: MICHI (道) — The Adventure Explorer Travel Social Platform

All notable changes to the MICHI documentation, specifications, and architecture are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.4] - 2026-11-24

### Security — Phase 2 Final RLS Security Corrections & Integration Harness
- **Public Profile Exposure Audit & Column-Level Security**:
  - Audited `public.profiles` column inventory against PRD Module 2 privacy rules.
  - Implemented `public.public_profiles` secure view (`WITH (security_invoker = true)`) in [supabase/migrations/20261124000000_phase2_auth_profiles.sql](file:///d:/travel%20social%20medio%20web/michi/supabase/migrations/20261124000000_phase2_auth_profiles.sql) selecting strictly public attributes (`id`, `username`, `display_name`, `avatar_url`, `cover_image_url`, `bio`, `location`, `social_links`, `is_ai_chatbot_enabled`, `created_at`).
  - Guaranteed column-level defense-in-depth: internal timestamps and future sensitive fields are not exposed to anon or unauthenticated callers.
  - Confirmed `drafts_count` is masked (`None`) on all public profile endpoints.
- **Dedicated PostgreSQL Integration Test Suite**:
  - Created [backend/tests/test_postgres_rls_integration.py](file:///d:/travel%20social%20medio%20web/michi/backend/tests/test_postgres_rls_integration.py) containing dedicated integration tests against real PostgreSQL:
    - `test_postgres_authenticated_role_switching`
    - `test_postgres_jwt_claim_forwarding_and_auth_uid_resolution`
    - `test_postgres_select_insert_update_delete_policies`
    - `test_postgres_transaction_rollback_and_connection_pool_reuse`
    - `test_postgres_behavior_after_exceptions`
    - `test_postgres_admin_connection_isolation`
  - Documented Docker run command and configuration via `POSTGRES_TEST_DATABASE_URL` for CI/staging runners.
- **Engine Transparency**:
  - Explicitly distinguished in-memory SQLite emulation tests from native PostgreSQL tests.

---

## [1.1.3] - 2026-11-24

### Fixed — Phase 2 Final Remediation: PostgreSQL RLS Claim Forwarding Architecture
- **Transaction-Scoped JWT Claim Forwarding & Role Switching**:
  - Implemented `set_session_rls_context` and `reset_session_rls_context` in [app/database.py](file:///d:/travel%20social%20medio%20web/michi/backend/app/database.py).
  - For PostgreSQL transactions, executes safe parameterized `set_config('request.jwt.claims', :claims, true)`, `set_config('request.jwt.claim.sub', :sub, true)`, and `set_config('request.jwt.claim.role', :role, true)` followed by `SET LOCAL ROLE authenticated`.
  - Guarantees that PostgreSQL's native `auth.uid()` evaluates to the authenticated user's UUID for all queries, eliminating the `NULL` `auth.uid()` gap.
- **FastAPI Dependency Layer Separation**:
  - Added `get_db_for_authenticated_user` (`get_authenticated_db`) in [app/dependencies.py](file:///d:/travel%20social%20medio%20web/michi/backend/app/dependencies.py) to automatically scope transactions to verified JWT claims.
  - Added `get_db_for_optional_user` for public/optional-auth endpoints, applying `role = 'anon'` when unauthenticated.
  - Added `get_admin_db` with explicit documentation and restricted access for internal maintenance and trigger simulations.
  - Rewired [app/routers/profiles.py](file:///d:/travel%20social%20medio%20web/michi/backend/app/routers/profiles.py) to utilize `get_db_for_authenticated_user` and `get_db_for_optional_user`.
- **Hermetic SQLite RLS Emulation**:
  - Added SQLite connection event listener registering `auth_uid()`, `current_setting()`, and `set_config()`.
  - Added `after_create` table event on `Profile.__table__` in [app/models/profile.py](file:///d:/travel%20social%20medio%20web/michi/backend/app/models/profile.py) creating SQLite triggers mirroring Supabase RLS update/delete policies (`auth.uid() = id`).
- **Comprehensive Security Test Suite**:
  - Expanded [tests/test_rls_verification.py](file:///d:/travel%20social%20medio%20web/michi/backend/tests/test_rls_verification.py) to 11 automated test cases covering:
    - `auth.uid()` evaluation (returns user UUID when authenticated, NULL when unauthenticated).
    - Database-level aborts on cross-user UPDATE and DELETE attempts.
    - End-to-end API isolation between User A and User B.
    - AI settings mutation isolation.
    - Immediate rejection of unauthenticated access (HTTP 401).
    - Explicit restriction of privileged admin database sessions.
    - Connection pool checkin sanitization and post-rollback claim isolation.
    - Transaction lifecycle persistence across commit boundaries via `after_begin`.
  - Added explicit DELETE RLS policy (`USING (auth.uid() = id)`) to [supabase/migrations/20261124000000_phase2_auth_profiles.sql](file:///d:/travel%20social%20medio%20web/michi/supabase/migrations/20261124000000_phase2_auth_profiles.sql).
  - Backend test suite expanded to 29 passed tests (0 failures).

---

## [1.1.2] - 2026-11-24

### Security & Verification — Phase 2 Final Security Verification
- **PostgreSQL Row Level Security (RLS) & Isolation Audit**:
  - Conducted technical inspection of database query execution across `database.py`, `dependencies.py`, and `profile_service.py`.
  - Identified architectural boundary: FastAPI connects to PostgreSQL via direct connection pool (service role / database owner), bypassing PostgreSQL RLS for server-side queries.
  - Implemented 2-user test suite `tests/test_rls_verification.py` verifying User A (Alice) and User B (Bob) data isolation: User A cannot access or mutate User B's profile, private statistics (drafts_count) are suppressed for non-owners, and AI chatbot toggles are strictly isolated.
  - Documented dual-tier security architecture: Application-level authorization (`Profile.id == current_user.id`) protects FastAPI API routes; PostgreSQL RLS policies protect direct client PostgREST/Storage access.
- **JWT Validation Rigor**:
  - Implemented explicit token issuer validation (`iss == f"{SUPABASE_URL}/auth/v1"`) rejecting cross-tenant tokens.
  - Added dynamic JWKS key rotation recovery: when a token arrives with an unknown `kid`, the validator force-refreshes the remote JWKS cache before rejecting.
  - Expanded `test_supabase_jwt.py` with test cases for wrong issuer rejection and key rotation flow.
- **Frontend Authentication Flow Coverage**:
  - Expanded `src/tests/auth.test.tsx` to 9 tests covering initial session restoration from `supabase.auth.getSession()` and logout session clearing via `supabase.auth.signOut()`.
- **Credential Hygiene & Secret Audit**:
  - Verified that no live secrets or real API keys are committed in documentation or code.
  - Replaced environment project endpoints with generic placeholders (`https://your-project-id.supabase.co`).
  - Identified plain-text exposure of `SUPABASE_SECRET_KEY` (service role) and `SUPABASE_PUBLISHABLE_KEY` in conversation history, issuing immediate recommendation for key rotation in the Supabase Dashboard.

---

## [1.1.1] - 2026-11-24

### Fixed — Phase 2 Remediation: Unified Authentication Architecture
- **Supabase Auth as Single Identity Provider**:
  - Replaced custom FastAPI user table and password storage with direct Supabase Auth integration (`@supabase/supabase-js`).
  - Rewired `AuthContext.tsx` and all screens (`LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `EmailVerificationScreen`) to delegate authentication, session lifecycle, and Google OAuth to Supabase GoTrue.
  - Removed duplicate `User` model; `public.profiles.id` maps 1:1 to Supabase `auth.users.id`.
- **Backend Resource Server Model**:
  - Refactored `security.py` to validate incoming Supabase-issued Bearer JWTs via project JWKS endpoint (`SUPABASE_JWKS_URL`) and audience (`aud = 'authenticated'`).
  - Removed custom token minting and legacy password reset endpoints from FastAPI.
  - Eliminated `dev_reset_token` from API responses to prevent account takeover.
  - Added session inspection endpoint `GET /api/v1/auth/session`.
- **Database & Trigger Alignment**:
  - Confirmed schema migration [20261124000000_phase2_auth_profiles.sql](file:///d:/travel%20social%20medio%20web/michi/supabase/migrations/20261124000000_phase2_auth_profiles.sql) provisions profiles automatically via `on_auth_user_created` trigger on `auth.users`.
  - Added backend fallback profile auto-provisioning in `ProfileService.get_or_create_profile` for resilient local development.
- **Testing & Verification**:
  - Created Pytest suite `tests/test_supabase_jwt.py` testing valid Supabase JWTs, missing tokens, malformed tokens, bad signatures, expired tokens, and wrong audience rejection.
  - Updated `tests/test_profiles.py` verifying profile CRUD, ownership isolation, and auto-provisioning.
  - Updated frontend Vitest suite `src/tests/auth.test.tsx` verifying Supabase `signInWithPassword`, `signUp`, `signInWithOAuth`, `resetPasswordForEmail`, and `verifyOtp`.

---

## [1.1.0] - 2026-11-24

### Added — Phase 2: Project Foundation & Authentication
- **Backend Application Architecture (`michi/backend/`)**:
  - Python FastAPI async application running with standard JSON envelope (`APIResponse[T]` with `success`, `data`, `error`).
  - Pydantic Settings configuration (`config.py`) managing environment variables (`ENVIRONMENT`, `JWT_SECRET_KEY`, `SUPABASE_*`, `CORS_ORIGINS`).
  - Database layer (`database.py`) supporting Supabase PostgreSQL with SQLite fallback for local development and testing.
  - SQLAlchemy relational models: `User` and `Profile` mapping directly to `public.profiles` (`DATABASE.md` Section 3.1).
  - Routers and Endpoints:
    - `/api/v1/auth`: `register`, `login`, `forgot-password`, `reset-password`, `verify-email`, `refresh`, `logout`.
    - `/api/v1/profiles`: `me` (GET/PATCH), `me/ai-settings` (PATCH), `check-username` (GET), `{username}` (GET).
  - Security suite (`utils/security.py`): bcrypt password hashing, JWT creation/validation, and Bearer token dependency injection (`dependencies.py`).
  - Pytest automated test suites (`test_auth.py`, `test_profiles.py`).
- **Database Schema Migration (`michi/supabase/migrations/`)**:
  - `20261124000000_phase2_auth_profiles.sql`: Creates `public.profiles` table with all fields (`username`, `display_name`, `avatar_url`, `cover_image_url`, `bio`, `location`, `social_links`, `is_ai_chatbot_enabled`), indexes, automatic `updated_at` trigger, and `on_auth_user_created` trigger for Supabase Auth provisioning.
  - Row Level Security (RLS) policies: public profiles readable by anyone; users can insert and update only their own profile (`auth.uid() = id`).
- **Frontend Application Architecture (`michi/frontend/`)**:
  - React 18, TypeScript, Vite, Tailwind CSS with full Adventure Explorer tokens (`adventure-orange`, `forest-green`, `sky-blue`, `sunshine-yellow`, light/dark palettes, Manrope & Inter fonts).
  - Reusable UI component library (`Button`, `Input`, `Card`, `Badge`, `Alert`, `Modal`, `ThemeToggle`).
  - State & Context: `ThemeContext` (persisted light/dark mode) and `AuthContext` (session management, user state, profile caching).
  - Navigation & Layouts: `Navbar`, `AuthLayout` (split-screen with travel photography hero), `AppLayout`, `ProtectedRoute`.
  - Application Screens:
    1. `LoginScreen`: email/password, error preview, remember me, Google OAuth button, forgot password link.
    2. `RegisterScreen`: display name, username with live debounced availability check, password strength indicator, terms checkbox.
    3. `ForgotPasswordScreen`: recovery request and confirmation state.
    4. `EmailVerificationScreen`: activation code/token entry, countdown timer, resend button.
    5. `MyProfileScreen`: owner profile header, avatar, cover banner, stats counters, "Manage Trips", "AI Chatbot Settings" toggle (`is_ai_chatbot_enabled`), and account details.
    6. `EditProfileModal`: modal for editing profile information with live username uniqueness validation.
    7. `PublicProfileScreen`: public view of travellers with "Follow" and "Ask AI About This Traveller" preview buttons.
    8. `HomeScreen` & `NotFoundScreen`: landing page and 404 path not found.
  - Vitest test suite (`auth.test.tsx`).

---

## [1.0.0] - 2026-11-24

### Added
- **Approved Product Requirements Document (PRD v1.0)**:
  - Official brand tagline: *"Every Path Has a Story."*
  - Complete 14 functional modules: Authentication, Profiles, Trips, Stops & Timeline, Maps (Google Maps Platform), Experiences, Blogs, Photography, Vlogs & Videos, Social Networking, Explore & Discovery, AI Traveller Profile Chatbot (FastAPI + pgvector RAG), Notifications, and Privacy/Safety.
  - Complete specifications for 35 application screens across Public, Authenticated, and Shared System screens.
  - 5 primary user journeys (A through E).
  - 14 database tables specified for the PostgreSQL data model.
  - 8-phase development roadmap (Phase 1 UI/UX Design through Phase 8 Testing & Deployment).
  - Comprehensive testing strategy with TestSprite and Pytest.
- **Supporting Architecture & Documentation Suite**:
  - `ARCHITECTURE.md`: Decoupled React (Vercel) + Python FastAPI (Render) + PostgreSQL with pgvector (Supabase) + Google Maps Platform architecture.
  - `DATABASE.md`: Relational schemas and ERD for all 14 tables, with strict public/private RLS policies.
  - `API.md`: FastAPI async endpoint documentation across 10 functional groups.
  - `DESIGN_SYSTEM.md`: Approved Adventure Explorer palette (Adventure Orange `#FF7138`, Forest Green `#246B4A`, Sky Blue `#45B8E8`, Sunshine Yellow `#FFD166`, Light `#F7F8F3`/`#FFFFFF`, Dark `#141A18`/`#202925`) and typography (Manrope + Inter).
  - `UI_UX_GUIDELINES.md`: Google Stitch design rules, mapping of all 35 screens, timeline visual hierarchy (Start $\rightarrow$ Stops $\rightarrow$ End), and 5 core UX experiences.
  - `USER_FLOWS.md`: End-to-end Mermaid flowcharts for User Journeys A, B, C, D, and E.
  - `SECURITY.md`: Public vs Private trip protection, RLS enforcement, private media security, and strict server-side AI retrieval boundaries.
  - `TESTING.md`: TestSprite UI flows, Pytest API tests, and Critical Security Acceptance Test.
  - `DEPLOYMENT.md`: Hosting blueprint on Vercel, Render, and Supabase with explicit developer safety authorization rules.
  - `DEVELOPMENT_ROADMAP.md`: 8-phase execution timeline from Google Stitch design to production launch.
  - `STITCH_DESIGN_AUDIT.md`: Google Stitch export inventory, responsive/theme coverage, design tokens, and PRD parity audit.
  - `AI_SYSTEM.md`: AI Traveller Profile Chatbot architecture, PostgreSQL pgvector RAG pipeline, strict profile privacy isolation, and grounded citations.
  - `MEDIA_PIPELINE.md`: Scalable photo and vlog architecture, direct-to-object-storage pre-signed URLs, asynchronous video transcoding, and signed URL privacy controls.
  - `CONTRIBUTING.md`: Development environment setup, TypeScript/Python coding standards, Git conventional commit conventions, TestSprite/Pytest testing standards, and Antigravity AI-agent collaboration rules.
  - `README.md`: Central project hub and documentation index.
  - `.gitignore`: Production configuration.
