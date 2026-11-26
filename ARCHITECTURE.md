# EpiCho Platform Architecture & Engineering Blueprint

**Tagline:** *Discover. Create. Cook. Connect.*

---

## 1. High-Level System Architecture

EpiCho is a full-stack, AI-powered culinary social networking platform built on a decoupled 3-tier architecture:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Client Layer (Next.js 16 + React 19)                │
│  • App Router (44+ Public, Authenticated, Professional & Admin routes)     │
│  • Tailwind CSS + shadcn/ui + Lucide Icons + UI/UX Pro Max Design Tokens   │
│  • 9:16 Vertical Reels Player, Drag/Keyboard Meal Planner, AI Kitchen UI    │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │ HTTPS / REST JSON + Multipart Uploads
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      API & Orchestration Layer (FastAPI)                   │
│  • Pydantic v2 Validation & Structured JSON AI Output Guardrails           │
│  • JWT Auth + TOTP MFA (Admins) + Fine-Grained Permission RBAC             │
│  • Services: AI Kitchen (Gemini + Fallback), Nutrition DB, Allergen Guard, │
│    Bayesian Rankings, Hidden Gems Scheduler, Razorpay Webhooks & Invoices  │
└──────────────┬──────────────────────────────────┬──────────────────────────┘
               │ SQLAlchemy 2.0 + Alembic         │ Redis / In-Memory Fallback
               ▼                                  ▼
┌──────────────────────────────┐    ┌────────────────────────────────────────┐
│   PostgreSQL 16 (Primary)    │    │    Redis (Cache, Quotas, Rate Limit)   │
│  • auth.users + public.*     │    │  • AI daily quota counters             │
│  • 65+ relational tables     │    │  • Leaderboard & Hidden Gems cache     │
│  • Encrypted health fields   │    │  • Anti-bot voting cooldown locks      │
└──────────────────────────────┘    └────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  Media & External Integrations Layer                       │
│  • Local Storage (/uploads) or S3 / Cloudflare R2 / Cloudinary CDN         │
│  • Google Gemini API (Structured Recipe Generation & Video Extraction)     │
│  • Razorpay / Cashfree (Checkout + HMAC Signature & Webhook Verification)  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Relationships & Schema Domains

All persistent entities live in PostgreSQL (`auth` and `public` schemas) managed via SQLAlchemy ORM and Alembic migrations (`backend/alembic/`):

1. **Authentication, Access & Sessions**
   - `auth.users` ↔ `public.user_accounts` (1:1 via `user_id`)
   - `public.user_accounts` ↔ `public.user_profiles` (1:1, includes DPDP `health_data_consent`, `allergies_encrypted`, `health_conditions_encrypted`)
   - `public.roles` ↔ `public.user_roles` ↔ `public.user_accounts` (M:N supporting multiple approved roles per user)
   - `public.roles` ↔ `public.role_permissions` ↔ `public.admin_permissions` (M:N permission matrix)
   - `public.sessions`, `public.admin_invitations`

2. **Subscriptions, Payments & Invoices**
   - `public.subscription_plans` (`Free` ₹0, `EpiCho Premium` ₹149/mo, `Creator Pro` ₹299/mo, `Business Pro` ₹599/mo — admin-configurable)
   - `public.subscriptions` → `public.payments` → `public.invoices`
   - `public.subscription_history` (tracks upgrades, downgrades, cancellations, renewals)

3. **AI Kitchen & Recipe Management**
   - `public.ai_requests` (prompt, options, `allergen_check_passed`, `flagged_unsafe`, `user_rating`, guest IP hash / user_id quota tracking)
   - `public.recipes` → `public.recipe_ingredients` ↔ `public.ingredients`
   - `public.recipes` → `public.recipe_steps`, `public.recipe_nutrition`, `public.recipe_reviews`, `public.recipe_versions`
   - `public.recipes.parent_recipe_id` (self-referencing FK for recipe remixing with attribution)
   - `public.saves` (saved recipes)

4. **Social Network, Reels & Blogs**
   - `public.posts` (supports `is_cooked_this`, `recipe_id`, `hashtags`, `dish_name`, `technique`) → `public.post_media`
   - `public.comments` (`post_id`, `recipe_id`, `parent_comment_id` for nested replies), `public.likes`, `public.follows`
   - `public.reels` (`video_url`, `thumbnail_url`, `recipe_id`, `category`) → `public.reel_likes`, `public.reel_comments`, `public.reel_views`, `public.reel_saves`
   - `public.blog_posts` (draft/published status, categories, tags, `embedded_recipe_ids`)

5. **Meal Planning, Smart Grocery & Heritage**
   - `public.meal_plans` → `public.meal_plan_items` → `public.recipes`
   - `public.grocery_lists` → `public.grocery_list_items` ↔ `public.ingredients`
   - `public.pantry_items` ↔ `public.ingredients`
   - `public.heritage_recipes` (1:1 with `recipes`, preserving `original_language`, `story_original`, `translations`, `colloquial_measurements`, `story_media_url`, `is_family_verified`)

6. **Businesses, Professionals, Rankings & Hidden Gems**
   - `public.business_profiles` → `public.menu_items`, `public.promotions`
   - `public.nutritionist_profiles` → `public.consultations`
   - `public.creator_verifications`, `public.critic_verifications`
   - `public.ranking_periods` → `public.ranking_votes` (Bayesian weighted score `(v/(v+m))*R + (m/(v+m))*C`)
   - `public.hidden_gems` (configurable 2-day or monthly cycle, 1 restaurant + 1 recipe per cycle, cooldown & moderator override)

7. **Administration & Support**
   - `public.moderation_reports`, `public.moderation_actions`, `public.audit_logs`
   - `public.notifications`, `public.support_tickets`, `public.system_config`

---

## 3. Complete RBAC Permission Matrix

Backend enforcement via `require_permission(...)` and `require_role(...)` in `backend/app/core/rbac.py` resolves all roles assigned to a user (`user_account.role` + `user_roles`) and checks resource ownership (`author_id`, `owner_user_id`, `user_id`).

### User Account Roles
| Permission Identifier | Guest | Registered | Verified Creator | Business User | Nutritionist | Food Critic |
|---|---|---|---|---|---|---|
| `recipe.view` / `reel.view` | Yes | Yes | Yes | Yes | Yes | Yes |
| `ai.generate` | 3/day | 10/day (Unlimited w/ Premium) | 10/day (Unlimited w/ Pro) | 10/day (Unlimited w/ Pro) | 10/day | 10/day |
| `ai.customize` | Limited | Yes | Yes | Yes | Yes | Yes |
| `recipe.create` / `edit_own` / `delete_own` | No | Yes | Yes | Yes | Yes | Yes |
| `post.create` / `post.comment` | No | Yes | Yes | Yes | Yes | Yes |
| `reel.upload` / `reel.delete_own` | No | Yes | Yes | Yes | Yes | Yes |
| `mealplan.manage_own` / `grocery.manage_own` | No | Yes | Yes | Yes | Yes | Yes |
| `ranking.vote` | No | Yes (1.0x) | Yes (1.5x) | Eligible | Yes (1.2x) | Yes (2.0x) |
| `creator.analytics` | No | No | Yes | No | No | Yes |
| `business.manage_own` | No | No | No | Yes (Verified) | No | No |
| `consultation.provide` | No | No | No | No | Yes (Verified) | No |
| `critic.review_official` | No | No | No | No | No | Yes (Verified) |

### Administrative Roles (MFA + Audit Logging Enforced)
| Admin Role | Permissions |
|---|---|
| `super_admin` | `*` (Unrestricted platform, role, finance, infra, moderation, system control) |
| `infra_admin` | `system.configure`, `infra.manage`, `analytics.view` |
| `tech_admin` | `system.configure`, `ai.configure`, `logs.view` |
| `content_moderator` | `content.moderate`, `report.resolve`, `user.warn` |
| `verification_admin` | `verification.review`, `verification.approve` |
| `ranking_admin` | `ranking.manage`, `hidden_gems.override`, `fraud.audit` |
| `finance_admin` | `finance.manage`, `subscription.configure`, `refund.issue` |
| `customer_support` | `support.manage`, `user.view_limited` |
| `analytics_admin` | `analytics.view`, `reports.export` |

---

## 4. Repository Structure

```
FINAL_EPICHO/
├── .env.example                 # Sanitized environment template (no secrets)
├── docker-compose.yml           # Postgres 16 + Redis 7 + FastAPI + Next.js
├── ARCHITECTURE.md              # Architecture, ERD, RBAC matrix, roadmap
├── DEPLOYMENT.md                # Ubuntu Linux setup & production guide
├── README.md                    # Quickstart, features & testing guide
├── design-system/epicho/        # UI/UX Pro Max design tokens & MASTER.md
├── backend/
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS + static uploads + OpenAPI
│   │   ├── core/                # config, database, security (JWT/bcrypt/TOTP), rbac, cache
│   │   ├── models/              # SQLAlchemy ORM models aligned to PostgreSQL
│   │   ├── schemas/             # Pydantic v2 validation & response schemas
│   │   ├── services/            # AI Kitchen, Nutrition DB, Payment/Invoices, Hidden Gems, Media
│   │   └── api/v1/              # 15+ REST routers (auth, recipes, ai_kitchen, reels, posts, blogs,
│   │                            # meal_planner, grocery, heritage, restaurants, rankings,
│   │                            # consultations, notifications, subscriptions, admin)
│   └── tests/                   # Pytest API, RBAC, AI safety & payment suites
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── components/
        │   ├── ui/              # shadcn/ui primitives (Button, Card, Badge, Input, Dialog, Tabs, Table...)
        │   └── layout/          # Navbar, Footer, ThemeProvider, DashboardShell
        ├── lib/                 # API client, AuthContext, design helpers
        └── app/                 # All 44 public, user, professional, and admin Next.js App Router pages
```

---

## 5. Phased Implementation Roadmap

1. **Phase 1 — Foundation & Auth**: PostgreSQL schema alignment, Alembic migrations, multi-role RBAC + permission identifiers, admin TOTP MFA & invitations, Redis/in-memory cache.
2. **Phase 2 — AI Kitchen**: Gemini structured JSON + culinary fallback, USDA/ICMR-backed Nutrition Lab calculator, post-generation Allergen Guard, daily quotas, history, translation, unsafe output reporting.
3. **Phase 3 — Social, Reels, Recipes & Blogs**: Full recipe CRUD + versioning + remixing, Cooked-This social posts + nested replies + media uploads, 9:16 Reels upload/view/save/extract-recipe, SEO Blogs with drafts & rich markdown.
4. **Phase 4 — Planning, Grocery, Heritage, Restaurants, Rankings, Hidden Gems, Consultations & Notifications**: Daily/weekly/monthly meal planner + AI plan generation, category-grouped grocery list + pantry subtraction + shopping links, Heritage translations & colloquial measurements, Bayesian rankings + anti-fraud, Hidden Gems 2-day/monthly cycle + archive, Nutritionist availability + consent-based booking, full notifications center.
5. **Phase 5 — Subscriptions & Administration**: Razorpay checkout + strict backend HMAC & webhook verification, invoice generation, upgrade/downgrade/cancel, all 9 admin dashboards + audit logs + verification workflows.
6. **Phase 6 — UI/UX Pro Max & All 44 Frontend Pages**: `shadcn/ui` primitives, `MASTER.md` culinary palette & typography (`Playfair Display SC` + `Karla`), dark/light theme, full WCAG AA accessibility, all 44 routes wired to live FastAPI endpoints.
7. **Phase 7 — Testing & Production Readiness**: Automated backend & frontend verification, Ubuntu & Docker deployment docs, external production checklist.
