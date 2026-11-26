# EpiCho — Discover. Create. Cook. Connect.

EpiCho is a full-stack, AI-powered culinary social networking platform built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS + shadcn/ui**, **FastAPI**, **PostgreSQL 16**, **Redis**, and **Google Gemini AI**.

---

## Core Capabilities

- **AI Kitchen Studio**: Pantry-to-recipe generation, cuisine & dish fusion, allergen sanitization & cross-contamination warnings, USDA/ICMR-backed nutrition lab estimates, recipe customization, translation, history, and unsafe-output reporting.
- **Food Social Network**: Home feed, photo/video uploads, "Cooked This" recipe verification, nested comment replies, likes, follows, hashtags, and content reporting.
- **EpiCho Reels**: Full-screen vertical 9:16 short cooking videos with multipart upload, thumbnail generation, view/like/save/comment tracking, and AI-assisted recipe extraction (with user confirmation).
- **Recipe Management & Blogs**: Structured recipe CRUD, version history (`recipe_versions`), remixing with attribution, downloadable JSON, and SEO-friendly culinary blogs with drafts.
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
# Edit .env with your PostgreSQL credentials, JWT_SECRET, and optional GEMINI_API_KEY / RAZORPAY_* keys
```

### 3. Backend Setup
```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/alembic upgrade head
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API docs available at `http://localhost:8000/docs`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000`.

---

## Automated Testing

```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest -v
```

```bash
cd frontend
npx tsc --noEmit && npm run build
```

---

## External Services Required for Production

| Service | Purpose | Required Env Vars |
|---|---|---|
| Google Gemini API | Live AI Kitchen & Reel recipe extraction | `GEMINI_API_KEY` |
| Razorpay (or Cashfree) | Live INR subscription checkout & webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| S3 / Cloudflare R2 / Cloudinary | Production media & CDN storage | `STORAGE_TYPE`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CDN_BASE_URL` |
| Managed PostgreSQL 16 & Redis 7 | Persistent database & distributed rate-limiting | `DATABASE_URL`, `REDIS_URL` |
=======
