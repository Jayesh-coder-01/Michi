# Contributor Guidelines & Engineering Standards
## Project: MICHI (道) — The Adventure Explorer Travel Social Platform

**Version:** 1.0  
**Status:** Approved Standard (Aligned with PRD v1.0 Section 19)  
**Date:** November 2026  
**Document Owner:** Engineering Leadership & DevRel Team  
**Source of Truth:** [PRD.md](PRD.md)  

---

## 1. Project Overview & Philosophy

Welcome to the **MICHI (道)** contributor community.

MICHI is dedicated to the craft of travel storytelling. We hold our codebase to the same standards of intentionality, craftsmanship, and quiet elegance that guide our user experience. Every line of code should be clean, accessible, testable, and strictly aligned with our product architecture.

---

## 2. Repository Structure

```text
michi/
├── docs/                          # All system, architecture, API, and design documentation
│   ├── PRD.md                     # Source of Truth: Product Requirements Document v1.0
│   ├── ARCHITECTURE.md            # Decoupled React + FastAPI System Architecture
│   ├── DATABASE.md                # 14 Relational PostgreSQL Tables, pgvector & RLS
│   ├── API.md                     # FastAPI REST API Endpoints & Request/Response Contracts
│   ├── AI_SYSTEM.md               # AI Traveller Profile Chatbot (RAG & pgvector)
│   ├── MEDIA_PIPELINE.md          # Photo & Video Ingestion, Processing & CDN Architecture
│   ├── UI_UX_GUIDELINES.md        # Stitch Adventure UX & 35 Screen Specifications
│   ├── DESIGN_SYSTEM.md           # Tokens, Adventure Explorer Palette & Typography
│   ├── STITCH_DESIGN_AUDIT.md     # Google Stitch Export Audit & Screen Inventory
│   ├── USER_FLOWS.md              # End-to-End User Journeys (A through E)
│   ├── SECURITY.md                # Public/Private Privacy, RLS & Safe Locations
│   ├── TESTING.md                 # TestSprite & Pytest Testing Strategies
│   ├── DEPLOYMENT.md              # Vercel, Render & Supabase Hosting Blueprint
│   ├── DEVELOPMENT_ROADMAP.md     # 8-Phase Execution Timeline & Milestones
│   ├── CHANGELOG.md               # Historical Release Notes & Spec Changes
│   └── CONTRIBUTING.md            # Contributor Guidelines & Engineering Standards
│
├── frontend/                      # React + TypeScript + Tailwind CSS (Vercel)
├── backend/                       # Python FastAPI + SQLAlchemy + pgvector (Render)
├── README.md                      # Central Project Hub
└── .gitignore                     # Production Git Rules
```

---

## 3. Local Development Environment Setup

### 3.1 Prerequisites
- **Node.js**: `v20.x` or `v22.x LTS`
- **Python**: `v3.11+`
- **Docker Desktop**: For running local Supabase / PostgreSQL instances with `pgvector`
- **Supabase CLI**: For database migrations and local authentication (`npm install -g supabase`)
- **Git**: For version control

### 3.2 Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:3000
```

### 3.3 Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# API docs available at http://localhost:8000/docs
```

### 3.4 Local Database Setup
```bash
supabase start
supabase db reset  # Applies migrations and seed data
```

---

## 4. Coding Standards & Conventions

### 4.1 Frontend Conventions (React + TypeScript)
- **Framework**: React 19 with TypeScript in strict mode (`"strict": true`).
- **Styling**: **Tailwind CSS** using exclusively the design system tokens defined in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
- **Anti-Slop Craft Rule**: Avoid arbitrary pixel overrides (e.g. `mt-[13px]`), purple/neon gradients, and unnecessary glows. Use the 4px spacing scale and approved palette (`adventure-orange`, `forest-green`, `sky-blue`, `sunshine-yellow`).
- **Component Anatomy**: Reusable components live in `frontend/src/components/ui/` with explicit props typing.
- **Accessibility (a11y)**: Semantic HTML (`<nav>`, `<main>`, `<article>`, `<header>`), descriptive `aria-label` attributes on icon-only buttons, and a minimum 4.5:1 text contrast ratio.

### 4.2 Backend Conventions (Python + FastAPI)
- **Style Guide**: PEP 8 compliance, enforced via `ruff` and `black`.
- **Typing**: Strict type hints everywhere using Python standard typing and Pydantic v2 schemas.
- **Asynchronous I/O**: Use `async def` route handlers and async database drivers (`asyncpg`, `SQLAlchemy[asyncio]`).
- **Layer Separation**:
  - `routers/`: Pure request/response mapping and dependency injection.
  - `services/`: Core business logic (routing calculations, chunking, notifications).
  - `models/`: SQLAlchemy database entities.
  - `schemas/`: Pydantic request validation and serialization schemas.
- **Database Access**: Never write raw unstructured queries; use parameterized queries or ORM models to prevent SQL injection.

---

## 5. Git & GitHub Workflow

### 5.1 Branch Naming Conventions
Always branch from `main`:
- `feature/<issue-number>-<short-description>` (e.g., `feature/12-add-trip-stops`)
- `bugfix/<issue-number>-<short-description>` (e.g., `bugfix/45-fix-map-pin-focus`)
- `docs/<short-description>` (e.g., `docs/update-media-pipeline`)
- `refactor/<short-description>` (e.g., `refactor/fastapi-rag-chunker`)

### 5.2 Commit Message Standards (Conventional Commits)
All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:
```text
<type>(<scope>): <short description in imperative mood>

[optional body]

[optional issue reference]
```
- **Allowed Types**:
  - `feat`: A new user-facing feature.
  - `fix`: A bug fix.
  - `docs`: Documentation updates only.
  - `style`: Formatting, missing semicolons, no code changes.
  - `refactor`: Refactoring production code without changing behavior.
  - `test`: Adding or correcting tests.
  - `chore`: Build scripts, dependencies, tooling updates.

*Example*: `feat(stops): add draggable stop reordering endpoint and timeline animation`

### 5.3 Pull Request Checklist
Before submitting a Pull Request (PR):
- [ ] Code follows TypeScript and PEP 8 guidelines.
- [ ] All unit and integration tests pass locally (`pytest`, `npm test`).
- [ ] Documentation has been updated to reflect any API, schema, or UI changes.
- [ ] No `.env` secrets or credentials have been committed.
- [ ] Branch is rebased onto the latest `main`.
- [ ] PR description clearly explains the changes and references the related issue.

---

## 6. Testing & Quality Standards

- **Frontend Testing**: Every new UI workflow must have a corresponding **TestSprite** journey script (`testsprite/`).
- **Backend Testing**: Every FastAPI endpoint must include **Pytest** tests with $\ge 85\%$ test coverage for business logic.
- **Security Tests**: Any modification to trips, stops, media, blogs, or AI chat must verify that **private content remains unretrievable by unauthorized users**.

---

## 7. Environment Variables & Secrets Management

- **Rule**: **NEVER** commit `.env` files containing real API keys, Supabase service keys, or Google Maps keys.
- **Templates**: Always update `.env.example` in both `frontend/` and `backend/` whenever new environment variables are introduced.
- **Local Secrets**: Stored exclusively in `.env.local` (ignored by Git).

---

## 8. Antigravity AI-Agent Collaboration Rules (PRD Section 19)

Google Antigravity and AI coding agents collaborate with human engineers under strict behavioral boundaries:

### 8.1 Permitted Autonomous Actions
AI agents may independently:
1. **Inspect** local project files, schemas, and exported designs.
2. **Implement** approved features strictly aligned with the PRD and architecture specifications.
3. **Write and execute** local unit, integration, and UI tests.
4. **Fix** local bugs, compiler errors, and test regressions.
5. **Review** code against design system guidelines and security policies.
6. **Update** technical documentation in `docs/` and log entries in `CHANGELOG.md`.

### 8.2 Restricted Actions (Explicit Authorization Required)
AI agents are **strictly prohibited** from independently performing:
1. **Executing production database migrations** (`supabase db push --production`).
2. **Modifying production data** in live databases.
3. **Creating production authentication users**.
4. **Altering production secrets, API keys, or environment variables**.
5. **Triggering live production deployments** to Vercel or Render.
6. **Performing irreversible external operations** or publishing public releases.

> **Protocol**: When a task reaches a restricted boundary, the AI agent must halt, outline the proposed action, and wait for explicit human authorization.

---

## 9. Cross-Reference Links

- Product Requirements Document: [PRD.md](PRD.md)
- System Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Relational Schema: [DATABASE.md](DATABASE.md)
- Testing Strategy: [TESTING.md](TESTING.md)
- Deployment Strategy: [DEPLOYMENT.md](DEPLOYMENT.md)
- Version History: [CHANGELOG.md](CHANGELOG.md)
