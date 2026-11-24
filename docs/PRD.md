# MICHI (道)
## Product Requirements Document (PRD)

**Version:** 1.0  
**Product Status:** Planning and UI/UX Design  
**Product Category:** Travel Social Networking Platform  
**Platform:** Responsive Web Application  
**Brand Tagline:** Every Path Has a Story.  
**Design Direction:** Adventure Explorer  
**Themes:** Light and Dark  

---

# 1. Executive Summary

## 1.1 Product Overview

Michi is a travel social networking platform where users can document, preserve, explore and share their complete travel journeys.

Unlike traditional social media platforms, which primarily focus on individual posts and photographs, Michi treats an entire trip as the central content unit.

Users can document:
- Starting and ending destinations.
- Routes and intermediate stops.
- Accommodation and activities.
- Personal experiences.
- Photographs and videos.
- Travel blogs and written stories.
- Complete trip vlogs.

Users can publish journeys publicly or keep them private.

The platform also introduces an AI-powered traveller profile chatbot that allows visitors to ask questions about a particular traveller's published journeys, experiences and travel history.

## 1.2 Product Vision

Build a global community where every traveller can turn their journeys into structured, interactive and shareable stories.

## 1.3 Core Philosophy

**A journey is more than a collection of photographs. It is a collection of places, experiences, people and memories.**

Michi brings all these elements together in one place.

---

# 2. Problem Statement

Current social media platforms primarily organize content around individual posts rather than complete journeys.

This creates several problems:

1. Travel photographs and videos become scattered across different posts.
2. Viewers cannot easily understand the complete route of a journey.
3. Information about accommodation and intermediate destinations is disconnected.
4. Personal travel experiences are difficult to organize chronologically.
5. Travel blogs, photographs and vlogs are separated across platforms.
6. People cannot easily explore someone's complete travel history.
7. Finding specific information about another traveller's experiences requires manually searching through their content.

## Proposed Solution

Michi provides a unified travel storytelling platform where users can create a complete digital record of their journeys.

Every trip becomes an organized collection of destinations, routes, stops, experiences, media and written stories.

An AI assistant makes these travel records searchable through natural conversations.

---

# 3. Target Audience

Michi is designed for everyone who travels.

| Audience | Primary needs |
|---|---|
| Solo travellers | Document individual journeys |
| Couples | Preserve shared travel memories |
| Friends and groups | Share group adventures |
| Families | Organize family trips |
| Backpackers | Share routes and experiences |
| Adventure travellers | Document outdoor activities |
| Travel bloggers | Publish detailed travel stories |
| Travel vloggers | Organize trip videos |
| Travel enthusiasts | Discover new journeys and destinations |

No separate creator account is required initially. Every registered user can use the core platform features.

---

# 4. Product Goals

## 4.1 Primary Goals

1. Enable users to document complete travel journeys.
2. Make trip creation and management simple.
3. Organize travel information geographically and chronologically.
4. Support rich media and long-form storytelling.
5. Build a travel-focused social community.
6. Enable discovery of public journeys.
7. Make individual traveller profiles searchable through AI.

## 4.2 Secondary Goals

- Encourage travel inspiration and knowledge sharing.
- Help travellers discover destinations through real experiences.
- Create an organized personal travel archive.
- Support future AI-powered travel features.

## 4.3 Non-Goals for Initial Release

The first release will not focus on:
- Hotel reservations.
- Flight bookings.
- Tour bookings.
- Real-time navigation.
- Travel agency services.
- Direct payment processing.
- Live location tracking.
- Full-fledged group trip collaboration.

These may be considered in future releases.

---

# 5. Core Product Modules

## Module 1 — Authentication and Account Management

**Objective:** Provide secure user registration and account access.

### Functional requirements

- **FR-AUTH-01:** Users can register using email and password.
- **FR-AUTH-02:** Users can register or log in using Google.
- **FR-AUTH-03:** Users must verify their email address.
- **FR-AUTH-04:** Users can log in securely.
- **FR-AUTH-05:** Users can reset forgotten passwords.
- **FR-AUTH-06:** Users can log out.
- **FR-AUTH-07:** Sessions must be managed securely.
- **FR-AUTH-08:** Users can update account information.
- **FR-AUTH-09:** Users can delete their accounts.

### Profile setup

After registration, users can provide:
- Display name.
- Unique username.
- Profile photograph.
- Cover photograph.
- Biography.
- Location (optional).
- Social links (optional).

### Acceptance criteria

- A registered user can log in and access protected features.
- Unauthenticated visitors cannot create trips.
- Invalid credentials produce appropriate errors.
- Account recovery works.
- Users cannot access another user's account data.

---

## Module 2 — Traveller Profiles

**Objective:** Create a personal travel identity for every user.

### Profile information

- Profile picture.
- Cover photograph.
- Display name.
- Username.
- Biography.
- Location.
- Social links.
- Followers.
- Following.
- Published trip count.

### Profile sections

1. Overview.
2. Trips.
3. Blogs.
4. Photos.
5. Videos.

### Functional requirements

- **FR-PRO-01:** Users can view public profiles.
- **FR-PRO-02:** Users can edit their own profiles.
- **FR-PRO-03:** Users can upload profile and cover photographs.
- **FR-PRO-04:** Users can view their published trips.
- **FR-PRO-05:** Users can manage their published content.
- **FR-PRO-06:** Private trips must not appear on public profiles.

---

## Module 3 — Trip Management

**Objective:** Allow users to create and manage complete journeys.

A trip is the primary content entity in Michi.

### Trip information

Each trip should support:

| Field | Description |
|---|---|
| Trip ID | Unique identifier |
| Owner ID | User who created the trip |
| Title | Name of journey |
| Description | Trip introduction |
| Cover image | Main trip photograph |
| Starting location | Journey starting point |
| Ending location | Final destination |
| Start date | Journey start |
| End date | Journey completion |
| Category | Type of travel |
| Visibility | Public or private |
| Status | Draft, published or archived |

### Trip categories

- Solo travel.
- Road trip.
- Backpacking.
- Family trip.
- Adventure.
- Trekking.
- Cultural exploration.
- Beach vacation.
- International travel.
- Other.

### Functional requirements

- **FR-TRIP-01:** Users can create trips.
- **FR-TRIP-02:** Users can edit trip information.
- **FR-TRIP-03:** Users can add cover photographs.
- **FR-TRIP-04:** Users can add starting and ending destinations.
- **FR-TRIP-05:** Users can add multiple stops.
- **FR-TRIP-06:** Users can save trips as drafts.
- **FR-TRIP-07:** Users can publish trips.
- **FR-TRIP-08:** Users can select public or private visibility.
- **FR-TRIP-09:** Users can archive trips.
- **FR-TRIP-10:** Users can delete their trips.

### Trip lifecycle

Draft → Published → Archived or Deleted.

A trip can be edited after publication by its owner.

---

## Module 4 — Journey Stops and Timeline

**Objective:** Organize journeys into individual destinations and chronological events.

Every trip can contain multiple stops.

### Stop information

- Stop name.
- Location.
- Latitude and longitude.
- Arrival date.
- Departure date.
- Accommodation details.
- Activities.
- Experiences.
- Photographs.
- Videos.
- Notes.

### Functional requirements

- **FR-STOP-01:** Users can add multiple stops.
- **FR-STOP-02:** Users can edit stop information.
- **FR-STOP-03:** Users can delete stops.
- **FR-STOP-04:** Users can reorder stops.
- **FR-STOP-05:** Users can associate experiences with stops.
- **FR-STOP-06:** Users can associate photographs and videos with stops.
- **FR-STOP-07:** Users can view stops chronologically.
- **FR-STOP-08:** Users can navigate between stops.

### Important design requirement

The journey timeline must clearly distinguish:

**Starting location → Intermediate stops → Final destination.**

The user should be able to understand the entire journey at a glance.

---

## Module 5 — Maps and Route Visualization

**Objective:** Represent journeys geographically.

### Functional requirements

- **FR-MAP-01:** Display trip starting location.
- **FR-MAP-02:** Display ending location.
- **FR-MAP-03:** Display intermediate stops.
- **FR-MAP-04:** Connect stops in journey order.
- **FR-MAP-05:** Show location markers.
- **FR-MAP-06:** Display stop information when a marker is selected.
- **FR-MAP-07:** Allow users to open location details.
- **FR-MAP-08:** Support route visualization.

### Map technology

**Google Maps Platform.**

The route displayed should represent the actual journey. When route information is unavailable, the interface should distinguish a simple connecting line from a verified road route.

---

## Module 6 — Travel Experiences

**Objective:** Let travellers document individual moments and activities.

### Experience information

- Experience title.
- Description.
- Date and time.
- Location.
- Associated trip.
- Associated stop.
- Activity category.
- Photographs.
- Videos.

### Functional requirements

- **FR-EXP-01:** Users can add experiences.
- **FR-EXP-02:** Users can edit experiences.
- **FR-EXP-03:** Users can delete experiences.
- **FR-EXP-04:** Users can associate experiences with stops.
- **FR-EXP-05:** Users can attach photographs and videos.

Examples:
- Watching sunrise in the Himalayas.
- Exploring a local market.
- Trying local food.
- Hiking a mountain trail.
- Meeting local people.

---

## Module 7 — Travel Blogs

**Objective:** Enable long-form travel storytelling.

### Blog information

- Blog title.
- Subtitle.
- Cover image.
- Author.
- Content.
- Publication date.
- Associated trip.
- Associated stop.
- Visibility.

### Editor capabilities

- Headings.
- Paragraphs.
- Lists.
- Image insertion.
- Video insertion.
- Location references.
- Formatting.
- Preview.
- Draft saving.
- Publishing.

### Functional requirements

- **FR-BLOG-01:** Users can create blogs.
- **FR-BLOG-02:** Users can edit their blogs.
- **FR-BLOG-03:** Users can save drafts.
- **FR-BLOG-04:** Users can publish blogs.
- **FR-BLOG-05:** Users can associate blogs with trips.
- **FR-BLOG-06:** Users can associate blogs with individual stops.
- **FR-BLOG-07:** Users can embed photographs and videos.
- **FR-BLOG-08:** Users can delete their blogs.

Blogs can be published independently or as part of a journey.

---

## Module 8 — Photography Management

**Objective:** Organize trip photographs.

### Functional requirements

- **FR-PHOTO-01:** Upload multiple photographs.
- **FR-PHOTO-02:** Add captions.
- **FR-PHOTO-03:** Add descriptions.
- **FR-PHOTO-04:** Associate photographs with trips.
- **FR-PHOTO-05:** Associate photographs with stops.
- **FR-PHOTO-06:** Set trip cover images.
- **FR-PHOTO-07:** Reorder photographs.
- **FR-PHOTO-08:** Delete photographs.
- **FR-PHOTO-09:** Display responsive galleries.

Support appropriate image validation, upload progress and error handling.

---

## Module 9 — Travel Vlogs and Videos

**Objective:** Allow users to document trips through video.

### Video information

- Video title.
- Description.
- Video file.
- Thumbnail.
- Associated trip.
- Associated stop.
- Visibility.
- Upload status.

### Functional requirements

- **FR-VIDEO-01:** Users can upload videos.
- **FR-VIDEO-02:** Users can add video titles.
- **FR-VIDEO-03:** Users can add descriptions.
- **FR-VIDEO-04:** Users can associate videos with trips.
- **FR-VIDEO-05:** Users can associate videos with stops.
- **FR-VIDEO-06:** Users can create trip video galleries.
- **FR-VIDEO-07:** Users can delete videos.
- **FR-VIDEO-08:** Users can view and play published videos.

Actual video files must be stored in media storage, not directly in PostgreSQL.

Video processing and streaming must be designed to scale independently of the application backend.

---

## Module 10 — Social Networking

**Objective:** Connect travellers and encourage journey discovery.

### Functional requirements

- **FR-SOC-01:** Users can follow other travellers.
- **FR-SOC-02:** Users can unfollow travellers.
- **FR-SOC-03:** Users can like trips.
- **FR-SOC-04:** Users can remove likes.
- **FR-SOC-05:** Users can comment on trips.
- **FR-SOC-06:** Users can save trips.
- **FR-SOC-07:** Users can remove saved trips.
- **FR-SOC-08:** Users can share public trip links.
- **FR-SOC-09:** Users can report inappropriate content.
- **FR-SOC-10:** Users can block other users.

### Future enhancements

- Comment replies.
- Group conversations.
- Collaborative trip creation.
- Direct messaging.

---

## Module 11 — Explore and Discovery

**Objective:** Help users discover new journeys, destinations and travellers.

### Explore sections

1. Featured journeys.
2. Recently published trips.
3. Popular destinations.
4. Recommended travellers.
5. Travel blogs.
6. Adventure categories.

### Search capabilities

Users should be able to search by:
- Destination.
- Country.
- City.
- Traveller username.
- Trip title.
- Travel category.

### Filters

- Travel type.
- Duration.
- Date.
- Destination.
- Popularity.
- Publication date.

### Functional requirements

- **FR-DISC-01:** Visitors can browse public trips.
- **FR-DISC-02:** Users can search public journeys.
- **FR-DISC-03:** Users can filter trips.
- **FR-DISC-04:** Users can discover public traveller profiles.
- **FR-DISC-05:** Users can discover published blogs.
- **FR-DISC-06:** Private trips must never appear in public discovery.

---

## Module 12 — AI Traveller Profile Chatbot

**Objective:** Let visitors interact with a traveller's published travel history using natural language.

This is one of Michi's major differentiating features.

### Concept

Every eligible public traveller profile contains:

**"Ask AI About This Traveller"**

Visitors can ask questions about that particular person's published journeys, blogs, destinations and experiences.

### Example questions

- Which countries has this person visited?
- Has this traveller visited Manali?
- What was their experience in Kasol?
- Where did they stay during their trip?
- Which route did they follow?
- What destinations do they recommend?
- How much did they spend?
- Show their Rajasthan travel blogs.

### Functional requirements

- **FR-AI-01:** Display chatbot access on public profiles.
- **FR-AI-02:** Users can ask natural-language questions.
- **FR-AI-03:** Answers must be based on the selected traveller's content.
- **FR-AI-04:** Retrieve relevant trips, blogs and experiences.
- **FR-AI-05:** Display source references.
- **FR-AI-06:** Link answers to relevant trips and blogs.
- **FR-AI-07:** Support follow-up questions.
- **FR-AI-08:** Provide an unavailable-information response.
- **FR-AI-09:** Allow users to report incorrect responses.
- **FR-AI-10:** Allow profile owners to disable their chatbot.
- **FR-AI-11:** Respect private content permissions.

### AI architecture

Use Retrieval-Augmented Generation (RAG).

Proposed flow:

1. Traveller publishes content.
2. Public content is processed.
3. Text is divided into searchable chunks.
4. Embeddings are generated.
5. Content is indexed with traveller and visibility metadata.
6. Visitor selects a traveller profile.
7. Visitor submits a question.
8. Backend retrieves relevant content for that specific traveller.
9. AI generates a grounded answer.
10. Relevant source links are displayed.

### Suggested technology

- **FastAPI** for orchestration.
- **PostgreSQL with pgvector** for vector search.
- Embedding model for semantic indexing.
- An external LLM provider.
- Strict profile-level filtering.

### Privacy requirements

- Never retrieve private trips.
- Never retrieve private blogs.
- Never reveal another traveller's content.
- Enforce profile-specific retrieval on the server.
- Do not rely on frontend filtering for privacy.
- Avoid generating unsupported claims.
- Do not expose personal information that the user has not made public.

If information is unavailable, the chatbot must clearly say so.

---

## Module 13 — Notifications

**Objective:** Inform users about relevant social interactions.

Notification types:
- New follower.
- Trip like.
- New comment.
- Comment reply.
- Other relevant platform activity.

Users should be able to:
- View notifications.
- Mark notifications as read.
- Open the related content.

Notification preferences should be configurable.

---

## Module 14 — Privacy and Safety

### Visibility options

Michi supports two trip visibility levels initially:

**Public**
- Visible in Explore.
- Visible on public profiles.
- Accessible through public links.
- Eligible for public-content AI indexing.

**Private**
- Accessible only to the trip owner initially.
- Hidden from Explore.
- Hidden from public profiles.
- Excluded from AI indexing.
- Protected by backend authorization and database policies.

### Security requirements

- Secure authentication.
- Ownership validation.
- Database Row Level Security.
- API authorization.
- Upload validation.
- Rate limiting.
- Secure media access.
- Account deletion.
- Content reporting.
- User blocking.

Private media must use protected access rather than unrestricted public URLs.

---

# 6. User Roles and Permissions

| Capability | Guest | Registered user | Content owner |
|---|---|---|---|
| Browse public trips | Yes | Yes | Yes |
| View public profiles | Yes | Yes | Yes |
| Create trips | No | Yes | Yes |
| Edit own trips | No | Yes | Yes |
| View private trips | No | No | Yes |
| Publish blogs | No | Yes | Yes |
| Upload media | No | Yes | Yes |
| Like and comment | No | Yes | Yes |
| Follow users | No | Yes | Yes |
| Save trips | No | Yes | Yes |
| Ask profile AI | Yes, if enabled | Yes, if enabled | Yes |

All registered users receive the same basic capabilities.

There is no separate creator role in the initial release.

---

# 7. Main Application Screens

## Public Screens

1. Landing page.
2. Explore page.
3. Public trip details.
4. Public traveller profile.
5. Public blog reading page.
6. Login.
7. Registration.
8. Forgot password.
9. Email verification.
10. AI traveller chatbot.

## Authenticated Screens

11. Home feed.
12. User dashboard.
13. Create trip.
14. Trip editor.
15. Add journey stops.
16. Stop details editor.
17. Journey timeline.
18. Trip publishing.
19. Complete trip details.
20. Add experience.
21. Photo manager.
22. Blog editor.
23. Vlog uploader.
24. Vlog gallery.
25. Saved trips.
26. Notifications.
27. Edit profile.
28. Account settings.
29. Privacy settings.

## Shared System Screens

30. Loading states.
31. Empty states.
32. Error states.
33. Unauthorized access.
34. Upload progress.
35. Confirmation dialogs.

---

# 8. Primary User Journeys

## User Journey A — Registration
Landing page → Sign Up → Enter Details → Email Verification → Profile Setup → Home Feed.

## User Journey B — Create Trip
Home Feed → Create Trip → Add Trip Details → Select Starting Location → Add Stops → Select Ending Location → Add Experiences → Upload Media → Save Draft → Preview → Publish.

## User Journey C — Explore Trips
Explore → Search Destination → Select Trip → View Route Map → Explore Stops → View Photos → Read Blog → Watch Vlog → Follow Traveller.

## User Journey D — AI Traveller Discovery
Explore → Open Traveller Profile → Ask AI → Ask Question → Receive Answer → View Source Trip → Explore Complete Journey.

## User Journey E — Private Trip
Create Trip → Select Private → Save → Owner Opens Trip → Unauthorized Visitor Attempts Access → Access Denied.

---

# 9. Technology Architecture

## 9.1 Proposed Technology Stack

| Layer | Technology |
|---|---|
| Design | Google Stitch |
| Frontend | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Python FastAPI |
| Authentication | Supabase Auth |
| Database | PostgreSQL |
| Vector search | pgvector |
| Maps | Google Maps Platform |
| Image storage | Cloudinary or Supabase Storage |
| Video storage | Dedicated media/object storage |
| Version control | Git and GitHub |
| AI development | Google Antigravity |
| UI testing | TestSprite |
| Backend testing | Pytest |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## 9.2 High-Level Architecture

```text
                USERS
                  |
                  v
        REACT + TYPESCRIPT
              VERCEL
                  |
                  v
          FASTAPI BACKEND
              RENDER
                  |
       +----------+----------+
       |          |          |
       v          v          v
  SUPABASE     MAPS API    AI SERVICE
  AUTH/DB                   |
       |                    |
       v                    v
  POSTGRESQL             RAG SYSTEM
  + PGVECTOR             |
       |                 v
       |             PROFILE FILTER
       |                 |
       +--------+--------+
                |
                v
          MEDIA STORAGE
```

This is a logical architecture. The exact service boundaries and infrastructure configuration will be finalized during Phase 2.

---

# 10. Database Requirements

## Proposed Database Tables

| Table | Purpose |
|---|---|
| profiles | User profile information |
| trips | Main trip records |
| trip_stops | Individual destinations |
| experiences | Travel experiences |
| blog_posts | Travel blogs |
| media_assets | Photo and video metadata |
| follows | User relationships |
| likes | Trip likes |
| comments | Social comments |
| saved_trips | Bookmarked journeys |
| notifications | User notifications |
| reports | Content and user reports |
| ai_content_chunks | Searchable public content |
| ai_conversations | Chat conversation metadata |

## Core Relationships

```text
USER
 |
 +---- TRIPS
 |      |
 |      +---- TRIP_STOPS
 |      |       |
 |      |       +---- EXPERIENCES
 |      |       |
 |      |       +---- MEDIA_ASSETS
 |      |
 |      +---- BLOG_POSTS
 |      |
 |      +---- MEDIA_ASSETS
 |
 +---- FOLLOWS
 |
 +---- LIKES
 |
 +---- COMMENTS
 |
 +---- SAVED_TRIPS
 |
 +---- NOTIFICATIONS
```

### Database design rules

- Use UUID primary keys.
- Include created_at and updated_at.
- Maintain owner relationships.
- Add foreign key constraints.
- Use indexes for frequent searches.
- Use appropriate uniqueness constraints.
- Enforce privacy policies.
- Avoid storing actual image and video files in PostgreSQL.
- Track media processing status.
- Maintain profile and visibility metadata for AI indexing.

The detailed schema, relationships and migrations will be created in Phase 2 and reviewed before production deployment.

---

# 11. Non-Functional Requirements

## Performance

- Responsive page loading.
- Optimized image delivery.
- Lazy loading for large galleries.
- Pagination for feeds.
- Efficient database queries.
- Background media processing where required.

## Security

- Secure password handling through authentication provider.
- Session validation.
- Backend authorization.
- Row Level Security.
- Input validation.
- File upload validation.
- Rate limiting.
- Secure API configuration.

## Scalability

- Separate media storage from application database.
- Paginate content.
- Support background processing.
- Design AI retrieval for profile-specific queries.
- Keep video processing independent of the main application server.

## Accessibility

- Keyboard navigation.
- Accessible labels.
- Proper contrast.
- Alternative text for images.
- Readable typography.
- Responsive touch controls.

## Reliability

- Error handling.
- Upload retry mechanisms.
- Logging.
- Database backups.
- Monitoring.
- Recovery procedures.

---

# 12. UI/UX Design Requirements

## Brand Identity

**Name:** MICHI (道)  
**Meaning:** Way, road or path.  
**Tagline:** Every Path Has a Story.  

### Design direction

**Adventure Explorer.**

The interface should communicate:
- Adventure.
- Freedom.
- Exploration.
- Nature.
- Discovery.
- Community.
- Storytelling.

### Color system

| Color | Hex |
|---|---|
| Adventure Orange | `#FF7138` |
| Forest Green | `#246B4A` |
| Sky Blue | `#45B8E8` |
| Sunshine Yellow | `#FFD166` |
| Light Background | `#F7F8F3` |
| Dark Background | `#141A18` |
| Light Surface | `#FFFFFF` |
| Dark Surface | `#202925` |

### Typography

- Headings: **Manrope**.
- Body: **Inter**.

### Themes

- Light theme.
- Dark theme.

### Responsive layouts

- Desktop.
- Tablet.
- Mobile.

### Most important UX experiences

1. Complete trip details page.
2. Trip creation flow.
3. Interactive journey map.
4. Traveller profile.
5. AI traveller chatbot.

---

# 13. MVP Scope and Prioritization

The product should be developed incrementally.

## P0 — Essential MVP

These features are required for the first usable release.

- Authentication.
- User profiles.
- Trip creation and editing.
- Multiple journey stops.
- Public/private visibility.
- Journey timeline.
- Route map visualization.
- Stop-wise experiences.
- Photograph uploads.
- Travel blogs.
- Video uploads and playback.
- Public trip exploration.
- Traveller profiles.
- Basic social interactions.
- Profile-specific AI chatbot.
- Core privacy and authorization.
- Responsive design.

## P1 — Post-MVP

- Comment replies.
- Advanced destination search.
- Personalized recommendations.
- Advanced notifications.
- Improved AI conversational memory.
- Trip analytics.
- Group trip collaboration.
- Enhanced creator tools.

## P2 — Future Possibilities

- AI travel itinerary generation.
- AI-assisted travel blog creation.
- Automatic trip story generation.
- Expense analytics.
- Travel planning.
- Mobile applications.
- Advanced route insights.
- Travel community events.

---

# 14. Development Roadmap

## Phase 1 — UI/UX Design
**Tools:** Google Stitch.  
**Deliverables:**
- Brand identity.
- Design system.
- Landing page.
- Authentication screens.
- Explore page.
- Home feed.
- Traveller profile.
- Trip creation.
- Journey map.
- Trip details.
- Blogs.
- Photo galleries.
- Vlogs.
- AI chatbot.
- Responsive and theme designs.

## Phase 2 — Project Foundation and Authentication
**Tools:** Antigravity, GitHub, Supabase, Vercel and Render.  
**Deliverables:**
- Repository setup.
- Frontend architecture.
- Backend architecture.
- Database foundation.
- Authentication.
- User profiles.
- Deployment foundations.

## Phase 3 — Trip Management
**Deliverables:**
- Create trips.
- Edit trips.
- Draft and publishing.
- Add stops.
- Reorder stops.
- Public/private access.

## Phase 4 — Maps and Journey Experience
**Deliverables:**
- Location search.
- Map integration.
- Route visualization.
- Stop details.
- Timeline.
- Accommodation and activities.

## Phase 5 — Content Management
**Deliverables:**
- Photograph uploads.
- Experience management.
- Blog editor.
- Blog publishing.
- Video uploads.
- Vlog galleries.

## Phase 6 — Social Networking
**Deliverables:**
- Explore feed.
- Likes.
- Comments.
- Following.
- Saved trips.
- Notifications.

## Phase 7 — AI Traveller Chatbot
**Deliverables:**
- Public content indexing.
- Embedding generation.
- Profile-specific retrieval.
- AI responses.
- Source references.
- Privacy enforcement.
- Usage controls.

## Phase 8 — Testing and Deployment
**Deliverables:**
- TestSprite testing.
- Pytest testing.
- Integration tests.
- Security tests.
- Privacy tests.
- Performance optimization.
- Production deployment.

---

# 15. Testing Requirements

## Authentication Tests

- Valid registration.
- Invalid registration.
- Login success.
- Login failure.
- Email verification.
- Password reset.
- Unauthorized access.

## Trip Tests

- Create trip.
- Edit trip.
- Delete trip.
- Add stops.
- Reorder stops.
- Publish trip.
- Save draft.
- Private trip access.

## Media Tests

- Valid image upload.
- Invalid file upload.
- Multiple image uploads.
- Video upload.
- Upload failure.
- Media deletion.

## Social Tests

- Follow user.
- Unfollow user.
- Like trip.
- Unlike trip.
- Comment.
- Save trip.

## AI Tests

- Correct profile-specific answers.
- Relevant source references.
- Missing information.
- Private information protection.
- Cross-profile data isolation.
- Prompt injection resistance.
- AI provider unavailable.
- Rate limiting.

## Critical Security Acceptance Test

**A user must never be able to retrieve another user's private trip, media, blog or experience through the frontend, API, database or AI chatbot.**

---

# 16. MVP Success Metrics

The following are proposed measurement targets, not existing performance claims.

| Metric | Measurement |
|---|---|
| Activation | Percentage of registered users creating their first trip |
| Trip completion | Percentage of started trips successfully published |
| Content engagement | Likes, comments and saves per public trip |
| Discovery | Public trip views and profile visits |
| Storytelling adoption | Percentage of trips with photos, experiences or blogs |
| AI adoption | Percentage of profile visitors using the chatbot |
| AI quality | Percentage of grounded and relevant answers |
| Reliability | Successful upload and request rates |

Initial targets should be established after beta testing.

---

# 17. Risks and Technical Considerations

| Risk | Mitigation |
|---|---|
| High video storage costs | Storage limits, compression and dedicated media services |
| Expensive AI requests | Rate limits, caching and usage monitoring |
| Incorrect AI answers | RAG, source citations and abstention |
| Private data exposure | RLS, backend checks and isolated retrieval |
| Large trip galleries | Pagination and lazy loading |
| Map API costs | Usage monitoring and caching where permitted |
| Complex trip creation | Progressive forms and draft saving |
| Poor mobile experience | Mobile-first testing |
| User-generated abuse | Reporting, moderation and blocking |

---

# 18. Product Acceptance Criteria

The first public MVP can be considered ready when:

1. Users can register and log in.
2. Users can create and manage profiles.
3. Users can create trips.
4. Users can add multiple destinations and stops.
5. Users can visualize their journeys on a map.
6. Users can add stop-wise experiences.
7. Users can upload photographs.
8. Users can publish travel blogs.
9. Users can upload and view videos.
10. Users can publish public or private trips.
11. Visitors can explore public journeys.
12. Users can follow, like and comment.
13. Visitors can ask questions about a particular traveller's public content.
14. AI answers contain relevant sources.
15. Private information is protected.
16. The application works on desktop, tablet and mobile.
17. Critical functional and security tests pass.
18. The application is deployed and usable.

---

# 19. Development and Collaboration Rules

## Google Stitch

- Responsible for UI/UX design.
- Follow the approved Michi design system.
- Produce reusable design components.
- Maintain light and dark themes.
- Design desktop and mobile layouts.

## Google Antigravity

- Responsible for implementation.
- Inspect existing code before changing it.
- Implement approved designs.
- Follow project architecture.
- Write tests.
- Fix errors.
- Perform code reviews.
- Maintain technical documentation.

## GitHub

- Maintain source code.
- Track changes.
- Use feature branches.
- Review changes before merging.
- Maintain documentation.
- Track issues and milestones.

## TestSprite and Pytest

- Test frontend flows.
- Test backend endpoints.
- Test integrations.
- Verify privacy and authorization.
- Run regression tests.

## Deployment

- **Vercel:** Frontend.
- **Render:** Backend.
- **Supabase:** Authentication and database.
- **Media provider:** Image and video storage.

## Development safety

Agents can autonomously inspect, implement, test, fix and review local code.

Explicit authorization is required before:
- Production database migrations.
- Production data changes.
- Authentication user creation in production.
- Secret modifications.
- Deployment.
- Other irreversible external operations.

---

# 20. Final Product Definition

Michi is not simply another travel photo-sharing application.

It is a journey-centric social platform combining:

**DOCUMENT**
- Trips.
- Routes.
- Stops.
- Experiences.
- Photographs.
- Blogs.
- Vlogs.

**CONNECT**
- Traveller profiles.
- Following.
- Likes.
- Comments.
- Sharing.

**DISCOVER**
- Destinations.
- Public journeys.
- Travel stories.
- Other travellers.

**UNDERSTAND**
- AI traveller profile chatbot.
- Searchable travel experiences.
- Contextual answers with references.

### Final Product Vision

Michi gives every traveller a place to preserve their journeys, share their experiences and inspire others to discover new paths.

**MICHI (道) — Every Path Has a Story.**
