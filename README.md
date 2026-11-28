# EpiCho — Discover. Create. Cook. Connect.

EpiCho is a full-stack, AI-powered culinary social networking platform built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS + shadcn/ui**, **FastAPI**, **PostgreSQL 16**, **Redis**, and **Google Gemini AI**.

---

## Core Capabilities

- **AI Kitchen Studio**: Provider-independent pantry-to-recipe generation with Gemini or deterministic mock providers, structured schema validation, explicit ingredient exclusions, independent allergen checks, profile allergy enforcement, per-tier daily quotas, owner-managed generation history, translation, and unsafe-output reporting. Mock provider output is for tests/local development and is never used as a silent fallback for configured Gemini failures.
- **Food Social Network**: Personalized/pagination-ready home feed, photo/video uploads, post detail pages, editable posts and comments, idempotent likes, saved posts and collections, share links, nested replies, follower/following lists, hashtags, reports, and public/private profiles with approved-follower access and follow-request management.
- **EpiCho Reels**: Full-screen vertical 9:16 short cooking videos with multipart upload, thumbnail generation, view/like/save/comment tracking, and AI-assisted recipe extraction (with user confirmation).
- **Recipe Management & Blogs**: Structured recipe CRUD with draft/publication controls, category and allergen tags, serving-size quantity adjustment, version history (`recipe_versions`), remixing with attribution, searchable cuisine/ingredient discovery, popularity/rating sorting, one review per user with cooked-post verification, helpful/unhelpful review feedback, review reporting/moderation, downloadable JSON, and SEO-friendly culinary blogs with drafts.
- **Meal Planner & Smart Grocery**: Daily/weekly/monthly meal planning, AI-generated meal plans, category-grouped grocery list generation, pantry subtraction, INR cost estimates, and external shopping links.
- **Grandmother's Recipes (Heritage)**: Preserves original language, regional dialect, family stories, translations, colloquial-to-standardized measurements, and Family Verified badges.
- **Restaurants, Rankings & Hidden Gems**: Verified business profiles, menus, promotions, owner replies, Bayesian weighted leaderboards with anti-fraud protections, and rotating Hidden Gems (2-day default or monthly).
- **Nutritionist Consultations**: Credential-verified dietitians, availability slots, and DPDP consent-based health data sharing.
- **Subscriptions & RBAC Governance**: Razorpay checkout + HMAC & webhook verification, GST invoice generation, multi-role RBAC across 7 user roles and 9 administrative staff roles with TOTP MFA and immutable audit logs.

---

## Quick Start on Ubuntu Linux

### 1. Prerequisites
- Python 3.12+
- Node.js 20+ & npm
- PostgreSQL 16+
- Redis 7+ (optional in development — falls back cleanly to in-memory cache)
- `ffmpeg` (optional, for automatic Reel video thumbnail extraction)

### 2. Environment Setup
```bash
cp .env.example .env
# Set POSTGRES_PASSWORD to a URL-safe random value, then replace the placeholder JWT_SECRET.
# Keep .env private; it is excluded from Git.
```

In development, verification and password-recovery emails are written to the
private `.dev-email-outbox/` directory. Configure SMTP and an HTTPS `FRONTEND_BASE_URL`
for staging or production.

### 3. Backend Setup
```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/alembic upgrade head
./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API docs available at `http://localhost:8000/docs`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000`.

### Docker Development

The Compose stack binds its published ports to localhost only. Configure `.env` before
starting it; PostgreSQL has no built-in password fallback.

```bash
cp .env.example .env
# Replace POSTGRES_PASSWORD and JWT_SECRET in .env.
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

The bootstrap migration creates missing ORM tables; the following schema-alignment
migration applies additive changes. No migration drops existing tables. Back up any
existing database before applying schema changes.

---

## Automated Testing

```bash
cd backend
# Point DATABASE_URL at a disposable test database and migrate it first.
./venv/bin/alembic upgrade head
PYTHONPATH=. ./venv/bin/pytest -v
```

```bash
cd frontend
npm test
npm run lint
npm run build
```

---

## External Services Required for Production

| Service | Purpose | Required Env Vars |
|---|---|---|
| Google Gemini API | Live AI Kitchen & Reel recipe extraction | `GEMINI_API_KEY` |
| Razorpay (or Cashfree) | Live INR subscription checkout & webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| S3 / Cloudflare R2 / Cloudinary | Production media & CDN storage | `STORAGE_TYPE`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CDN_BASE_URL` |
| Managed PostgreSQL 16 & Redis 7 | Persistent database & distributed rate-limiting | `DATABASE_URL`, `REDIS_URL` |
