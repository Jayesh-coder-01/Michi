# Deployment, Infrastructure & Hosting Blueprint
## Project: MICHI (道) — The Adventure Explorer Travel Social Platform

**Version:** 1.0  
**Status:** Approved Specification (Vercel, Render & Supabase Architecture)  
**Date:** November 2026  
**Document Owner:** DevOps & Infrastructure Engineering  

---

## 1. Hosting Topology Overview

As mandated in Section 9 and Section 19 of the PRD:
- **Frontend Hosting**: **Vercel** (Global Edge CDN hosting React + TypeScript).
- **Backend Hosting**: **Render** (FastAPI asynchronous Python web service).
- **Database & Authentication**: **Supabase** (Managed PostgreSQL 16 + pgvector, Supabase Auth).
- **Media Hosting**: **Cloudinary / Supabase Storage** for images; **dedicated media/object storage** for videos and vlogs.

```mermaid
flowchart TD
    subgraph FrontendVercel["Frontend Tier (Vercel)"]
        VERCEL_EDGE["Vercel Global Edge Network"]
        REACT_APP["React + TypeScript Application"]
        VERCEL_EDGE --> REACT_APP
    end

    subgraph BackendRender["Backend Service (Render)"]
        RENDER_SVC["Render Web Service (FastAPI / Uvicorn)"]
        FASTAPI_APP["Python FastAPI Backend"]
        RENDER_SVC --> FASTAPI_APP
    end

    subgraph DatabaseSupabase["Database & Auth (Supabase)"]
        SUPA_AUTH_SVC["Supabase Auth (JWT & OAuth)"]
        SUPA_PG["PostgreSQL Database"]
        PG_VECTOR["pgvector Extension"]
        SUPA_PG --- PG_VECTOR
    end

    subgraph MediaStorage["Media & Object Storage"]
        IMG_STORE["Cloudinary / Supabase Storage (Photos)"]
        VID_STORE["Dedicated Media Storage (Vlogs)"]
    end

    REACT_APP -->|HTTPS REST API Requests| RENDER_SVC
    REACT_APP -->|Direct Auth Session Checks| SUPA_AUTH_SVC
    REACT_APP -. Direct Upload .-> IMG_STORE
    REACT_APP -. Direct Upload .-> VID_STORE

    FASTAPI_APP -->|SQLAlchemy / asyncpg| SUPA_PG
    FASTAPI_APP -->|Vector Cosine Queries| PG_VECTOR
    FASTAPI_APP -->|Validate JWTs| SUPA_AUTH_SVC
```

---

## 2. Environment Configuration Matrix

MICHI uses three isolated development environments:

| Environment | Purpose | Frontend URL | Backend URL | Supabase Project |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | Local testing | `http://localhost:3000` | `http://localhost:8000` | Local / Dev Project |
| **Staging** | QA & TestSprite Runs | `https://staging.michi.travel` | `https://api-staging.michi.travel` | Staging Project |
| **Production** | Live Platform | `https://michi.travel` | `https://api.michi.travel` | Production (HA) |

### Required Environment Variables

#### Frontend (Vercel)
```bash
VITE_API_BASE_URL=https://api.michi.travel/api/v1
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
```

#### Backend (Render)
```bash
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
GOOGLE_MAPS_SERVER_KEY=AIzaSy...
LLM_API_KEY=AIzaSy... # Gemini API / External LLM
CLOUDINARY_URL=cloudinary://...
CORS_ORIGINS=["https://michi.travel","https://staging.michi.travel"]
```

---

## 3. Development Safety & Deployment Rules

In accordance with Section 19 of the PRD:

> **STOP AND VERIFY**: Explicit user authorization is strictly required before executing any of the following irreversible operations:
> - Production database migrations.
> - Production data modifications or purges.
> - Creating production authentication users.
> - Modifying production secrets or API keys.
> - Triggering live production deployments.

---

## 4. Rollback & Disaster Recovery Procedures

1. **Frontend Instant Reversion (Vercel)**:
   - Rollback to the previous stable deployment hash in $< 10$ seconds via Vercel dashboard.
2. **Backend Reversion (Render)**:
   - Rollback to previous deployment image tag via Render dashboard.
3. **Database Recovery (Supabase)**:
   - Daily automated backups with Point-In-Time Recovery (PITR) up to 7 days.

---

## 5. Cross-Reference Links

- Product Requirements Document: [PRD.md](PRD.md)
- System Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Testing & CI Verification: [TESTING.md](TESTING.md)
- Security Policies: [SECURITY.md](SECURITY.md)
