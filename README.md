# MICHI (道) — Travel Social Networking Platform

> **"Every Path Has a Story."**  
> *A travel social networking platform where users document, preserve, explore and share their complete travel journeys.*

---

## 1. Product Overview & Philosophy

**MICHI** (道 — Japanese for *"Way"*, *"Road"*, or *"Path"*) is a travel social networking platform designed for everyone who travels—from solo explorers and backpackers to families and content creators.

Unlike traditional social media platforms that scatter moments across disconnected snapshots, Michi treats an **entire trip as the central content unit**:
- **Complete Journey Records**: Document starting and ending locations, intermediate stops, routes, accommodations, activities, personal experiences, photographs, written blogs, and video vlogs.
- **Geographic & Chronological Hierarchy**: Understand an entire journey at a glance: **Starting location → Intermediate stops → Final destination**.
- **Maps & Route Visualization**: Interactive maps powered by **Google Maps Platform** showing verified road routes and stop details.
- **AI Traveller Profile Chatbot ("Ask AI About This Traveller")**: A conversational RAG assistant that lets visitors query a traveller's public journey history, itineraries, and recommendations using natural language.
- **Public & Private Privacy**: Full ownership control with strict database-level protection ensuring private trips, media, and experiences are never exposed to other users or AI queries.

---

## 2. Technology Stack (PRD Section 9)

| Layer | Technology |
|---|---|
| **Design** | Google Stitch |
| **Frontend** | React + TypeScript |
| **Styling** | Tailwind CSS |
| **Typography** | Manrope (Headings), Inter (Body) |
| **Backend** | Python FastAPI |
| **Authentication** | Supabase Auth |
| **Database** | PostgreSQL |
| **Vector Search** | pgvector |
| **Maps Platform** | Google Maps Platform |
| **Image Storage** | Cloudinary or Supabase Storage |
| **Video Storage** | Dedicated media / object storage |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |
| **UI Testing** | TestSprite |
| **Backend Testing** | Pytest |
| **Version Control** | Git and GitHub |
| **AI Development** | Google Antigravity |

---

## 3. Approved Brand Identity & Color System

- **Brand Tagline**: **Every Path Has a Story.**
- **Design Direction**: **Adventure Explorer** (Nature, freedom, discovery, craftsmanship, community).
- **Themes**: Light theme & Dark theme across Desktop, Tablet, and Mobile.

| Color Token | Hex Code | Primary Usage |
| :--- | :---: | :--- |
| **Adventure Orange** | `#FF7138` | Primary brand CTA, active route polylines, milestone markers |
| **Forest Green** | `#246B4A` | Outdoor activity badges, verified trail paths, nature stops |
| **Sky Blue** | `#45B8E8` | Transit connections, coastal categories, links |
| **Sunshine Yellow** | `#FFD166` | Sights, highlights, ratings, cultural discoveries |
| **Light Background** | `#F7F8F3` | Page canvas for Light theme |
| **Dark Background** | `#141A18` | Page canvas for Dark theme |
| **Light Surface** | `#FFFFFF` | Cards, popovers, and elevated panels on Light theme |
| **Dark Surface** | `#202925` | Cards, popovers, and elevated panels on Dark theme |

---

## 4. Repository & Documentation Structure

```text
michi/
├── docs/
│   ├── PRD.md                     # Complete Approved Product Requirements Document v1.0
│   ├── ARCHITECTURE.md            # React + FastAPI Decoupled System Architecture & RAG Flows
│   ├── DATABASE.md                # 14 Relational PostgreSQL Tables, pgvector & RLS Policies
│   ├── API.md                     # FastAPI REST Endpoints & AI Chat Contracts
│   ├── AI_SYSTEM.md               # AI Traveller Profile Chatbot (RAG & pgvector)
│   ├── MEDIA_PIPELINE.md          # Photo & Video Ingestion, Processing & CDN Architecture
│   ├── UI_UX_GUIDELINES.md        # Stitch Adventure UX & 35 Application Screen Specifications
│   ├── DESIGN_SYSTEM.md           # Color Palette, Manrope/Inter Typography & Component Tokens
│   ├── USER_FLOWS.md              # 5 Primary User Journeys (A through E) in Mermaid Flowcharts
│   ├── SECURITY.md                # Public/Private Isolation, Database RLS & Privacy Safeguards
│   ├── TESTING.md                 # TestSprite UI Testing & Pytest Backend Test Suites
│   ├── DEPLOYMENT.md              # Vercel, Render & Supabase Hosting Blueprint
│   ├── DEVELOPMENT_ROADMAP.md     # 8-Phase Execution Plan from Google Stitch to Launch
│   ├── CHANGELOG.md               # Version History & Specification Tracking
│   ├── STITCH_DESIGN_AUDIT.md     # Google Stitch Export Audit & Screen Inventory
│   └── CONTRIBUTING.md            # Contributor Guidelines & AI Collaboration Rules
│
├── README.md                      # Project Introduction & Documentation Hub
└── .gitignore                     # Production Git Ignore Configuration
```

---

## 5. Development Roadmap Overview (8 Phases)

- **Phase 1 — UI/UX Design**: Google Stitch brand identity, design system, and all 35 screens.
- **Phase 2 — Project Foundation and Authentication**: Antigravity, GitHub, Supabase, Vercel, and Render setup.
- **Phase 3 — Trip Management**: Create, edit, publish trips, draft states, add/reorder stops.
- **Phase 4 — Maps and Journey Experience**: Google Maps, Directions, stop details, and timeline.
- **Phase 5 — Content Management**: Photograph manager, travel experiences, blog editor, and vlog uploader.
- **Phase 6 — Social Networking**: Explore feed, likes, comments, following, and saved trips.
- **Phase 7 — AI Traveller Chatbot**: Content chunking, embeddings, pgvector retrieval, and grounded Q&A.
- **Phase 8 — Testing and Deployment**: TestSprite, Pytest, security tests, and production deployment.

---

## 6. Complete Documentation Index

1. **[Product Requirements Document (PRD v1.0)](docs/PRD.md)**: Full 20-section PRD covering modules 1–14, 35 screens, journeys A–E, and success metrics.
2. **[System Architecture](docs/ARCHITECTURE.md)**: Decoupled React/FastAPI topology, Google Maps integration, and RAG data flow.
3. **[Database Design & Schema](docs/DATABASE.md)**: Schemas for all 14 tables, pgvector HNSW indexing, and RLS policies.
4. **[API Specifications](docs/API.md)**: FastAPI REST endpoints, JSON envelopes, and AI streaming Q&A.
5. **[UI/UX Guidelines](docs/UI_UX_GUIDELINES.md)**: Stitch adventure design, 35 application screens, and 5 core UX experiences.
6. **[Design System](docs/DESIGN_SYSTEM.md)**: Approved Adventure Explorer color tokens, typography scales, and button/timeline specs.
7. **[Primary User Journeys](docs/USER_FLOWS.md)**: Mermaid flowcharts for Journeys A (Registration), B (Create Trip), C (Explore), D (AI Discovery), and E (Private Trip).
8. **[Security & Privacy Architecture](docs/SECURITY.md)**: Public vs Private rules, RLS enforcement, private media protection, and AI privacy bounds.
9. **[Quality Assurance & Testing](docs/TESTING.md)**: TestSprite UI testing, Pytest backend tests, and critical security tests.
10. **[Deployment & Infrastructure](docs/DEPLOYMENT.md)**: Vercel, Render, and Supabase deployment blueprint with safety checks.
11. **[Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)**: 8-phase milestone breakdown and product acceptance criteria.
12. **[Changelog](docs/CHANGELOG.md)**: Version history tracking documentation changes.
13. **[Google Stitch Design Audit](docs/STITCH_DESIGN_AUDIT.md)**: Full audit of the exported Stitch design system, 35-screen inventory, gaps, and recommendations.
14. **[AI System Architecture](docs/AI_SYSTEM.md)**: AI Traveller Profile Chatbot, pgvector RAG workflow, grounded citations, and privacy boundaries.
15. **[Media Pipeline](docs/MEDIA_PIPELINE.md)**: Photo & video upload architecture, object storage, responsive WebP optimization, and access control.
16. **[Contributor Guidelines](docs/CONTRIBUTING.md)**: Coding standards, Git workflow, testing standards, and Antigravity AI-agent collaboration rules.
