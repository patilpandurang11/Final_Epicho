"""EpiCho v2 schema alignment, new feature tables, enums, and role seeds.

Revision ID: 0001_epicho_v2
Revises:
Create Date: 2026-11-27 02:55:00
"""
from alembic import op

revision = "0001_epicho_v2"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Extend PostgreSQL ENUMs safely outside transaction
    with op.get_context().autocommit_block():
        for enum_sql in [
            "ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'reel'",
            "ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'blog'",
            "ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'restaurant'",
            "ALTER TYPE public.ranking_target_type ADD VALUE IF NOT EXISTS 'recipe'",
            "ALTER TYPE public.ranking_target_type ADD VALUE IF NOT EXISTS 'critic'",
            "ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'consultation'",
            "ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'subscription'",
        ]:
            op.execute(enum_sql)

    # 2. Alter existing tables safely
    op.execute("""
        ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS mfa_secret text;
        ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"likes": true, "comments": true, "follows": true, "meal_reminders": true, "hidden_gems": true}'::jsonb;

        ALTER TABLE public.ai_requests ADD COLUMN IF NOT EXISTS response_payload jsonb;
        ALTER TABLE public.ai_requests ADD COLUMN IF NOT EXISTS guest_identifier text;
        ALTER TABLE public.ai_requests ADD COLUMN IF NOT EXISTS unsafe_reason text;

        ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS restaurant_tag text;
        ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS ingredient_tags text[] NOT NULL DEFAULT '{}'::text[];

        ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}'::text[];
        ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS location text;
        ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS saves_count integer DEFAULT 0;

        ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt text;
        ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Culinary Stories';
        ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS cover_image_url text;
        ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

        ALTER TABLE public.heritage_recipes ADD COLUMN IF NOT EXISTS festival_collection text;

        ALTER TABLE public.nutritionist_profiles ADD COLUMN IF NOT EXISTS consultation_fee numeric(10,2) DEFAULT 999.00;
        ALTER TABLE public.nutritionist_profiles ADD COLUMN IF NOT EXISTS bio text;
        ALTER TABLE public.nutritionist_profiles ADD COLUMN IF NOT EXISTS availability_slots jsonb NOT NULL DEFAULT '["Mon 10:00 AM", "Wed 04:00 PM", "Fri 11:00 AM"]'::jsonb;

        ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS share_health_data boolean NOT NULL DEFAULT false;

        ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS yearly_price numeric(10,2);
        ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

        ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';

        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_order_id text;
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_payment_id text;
    """)

    # 3. Create new tables for complete EpiCho spec
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.sessions (
            session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            refresh_token_hash text NOT NULL,
            user_agent text,
            ip_address text,
            is_revoked boolean NOT NULL DEFAULT false,
            expires_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.recipe_versions (
            version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            recipe_id uuid NOT NULL REFERENCES public.recipes(recipe_id) ON DELETE CASCADE,
            version_number integer NOT NULL DEFAULT 1,
            edited_by uuid REFERENCES public.user_accounts(user_id) ON DELETE SET NULL,
            change_summary text,
            snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.reel_likes (
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            reel_id uuid NOT NULL REFERENCES public.reels(reel_id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, reel_id)
        );

        CREATE TABLE IF NOT EXISTS public.reel_saves (
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            reel_id uuid NOT NULL REFERENCES public.reels(reel_id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, reel_id)
        );

        CREATE TABLE IF NOT EXISTS public.reel_comments (
            comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            reel_id uuid NOT NULL REFERENCES public.reels(reel_id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            body text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.reel_views (
            view_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            reel_id uuid NOT NULL REFERENCES public.reels(reel_id) ON DELETE CASCADE,
            user_id uuid REFERENCES public.user_accounts(user_id) ON DELETE SET NULL,
            watch_seconds integer DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.business_reviews (
            review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id uuid NOT NULL REFERENCES public.business_profiles(business_id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            rating integer NOT NULL DEFAULT 5,
            review_text text NOT NULL,
            owner_reply text,
            is_critic_review boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.verification_requests (
            request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            target_role text NOT NULL,
            document_reference text NOT NULL,
            portfolio_url text,
            notes text,
            status text NOT NULL DEFAULT 'pending',
            reviewed_by uuid REFERENCES public.user_accounts(user_id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.invoices (
            invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_number text NOT NULL UNIQUE,
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            subscription_id uuid REFERENCES public.subscriptions(subscription_id) ON DELETE SET NULL,
            payment_id uuid REFERENCES public.payments(payment_id) ON DELETE SET NULL,
            amount_inr numeric(10,2) NOT NULL,
            gst_inr numeric(10,2) NOT NULL DEFAULT 0.00,
            total_inr numeric(10,2) NOT NULL,
            status text NOT NULL DEFAULT 'paid',
            issued_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.subscription_history (
            history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            subscription_id uuid NOT NULL REFERENCES public.subscriptions(subscription_id) ON DELETE CASCADE,
            event_type text NOT NULL,
            notes text,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.support_tickets (
            ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            subject text NOT NULL,
            category text NOT NULL DEFAULT 'general',
            description text NOT NULL,
            status text NOT NULL DEFAULT 'open',
            assigned_to uuid REFERENCES public.user_accounts(user_id) ON DELETE SET NULL,
            resolution_notes text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    """)

    # 4. Seed all 9 Admin roles + Critic role + Hidden Gems config
    op.execute("""
        INSERT INTO public.roles (role_name, tier, description)
        VALUES
            ('critic', 'creator', 'Verified Food Critic / Reviewer'),
            ('super_admin', 'admin', 'Super Admin / Owner with full platform access'),
            ('infra_admin', 'admin', 'Infrastructure Admin for servers, backups and security'),
            ('tech_admin', 'admin', 'Technical Admin for deployments, AI config and error logs'),
            ('content_moderator', 'admin', 'Content Moderator for posts, recipes, blogs and reels'),
            ('verification_admin', 'admin', 'Verification Admin for creators, businesses, critics and nutritionists'),
            ('ranking_admin', 'admin', 'Ranking Admin for Bayesian audits, fraud and Hidden Gems'),
            ('finance_admin', 'admin', 'Finance Admin for subscriptions, invoices, refunds and payouts'),
            ('customer_support', 'admin', 'Customer Support for user tickets'),
            ('analytics_admin', 'admin', 'Analytics Admin for platform usage and business intelligence')
        ON CONFLICT (role_name) DO NOTHING;

        INSERT INTO public.system_config (config_key, config_value)
        VALUES
            ('hidden_gems_cycle_days', '2'),
            ('hidden_gems_mode', 'two_days'),
            ('ai_guest_daily_limit', '3'),
            ('ai_registered_daily_limit', '10')
        ON CONFLICT (config_key) DO NOTHING;
    """)


def downgrade() -> None:
    pass
