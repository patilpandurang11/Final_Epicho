"""Extend Phase 3 profiles, publishing, saves, and social constraints.

Revision ID: 0004_phase3_integrity
Revises: 0003_phase3_social_privacy
"""
from alembic import op


revision = "0004_phase3_integrity"
down_revision = "0003_phase3_social_privacy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "
        "cover_image_url text"
    )
    op.execute(
        "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "
        "cuisine_interests text[] NOT NULL DEFAULT '{}'::text[]"
    )
    op.execute(
        "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "
        "website_url text"
    )
    op.execute(
        "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "
        "social_links jsonb NOT NULL DEFAULT '{}'::jsonb"
    )
    op.execute(
        "ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS "
        "category text NOT NULL DEFAULT 'Main Course'"
    )
    op.execute(
        "ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS "
        "allergen_tags text[] NOT NULL DEFAULT '{}'::text[]"
    )
    op.execute(
        "ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS "
        "is_published boolean NOT NULL DEFAULT true"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.post_saves (
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            post_id uuid NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, post_id)
        )
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT like_id, row_number() OVER (
                PARTITION BY user_id, post_id ORDER BY created_at, like_id
            ) AS position
            FROM public.likes
            WHERE post_id IS NOT NULL
        )
        DELETE FROM public.likes AS duplicate
        USING ranked
        WHERE duplicate.like_id = ranked.like_id AND ranked.position > 1
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT like_id, row_number() OVER (
                PARTITION BY user_id, recipe_id ORDER BY created_at, like_id
            ) AS position
            FROM public.likes
            WHERE recipe_id IS NOT NULL
        )
        DELETE FROM public.likes AS duplicate
        USING ranked
        WHERE duplicate.like_id = ranked.like_id AND ranked.position > 1
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_user_post
        ON public.likes (user_id, post_id) WHERE post_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_user_recipe
        ON public.likes (user_id, recipe_id) WHERE recipe_id IS NOT NULL
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_likes_single_target'
                  AND conrelid = 'public.likes'::regclass
            ) THEN
                ALTER TABLE public.likes
                ADD CONSTRAINT ck_likes_single_target
                CHECK ((post_id IS NOT NULL AND recipe_id IS NULL)
                    OR (post_id IS NULL AND recipe_id IS NOT NULL)) NOT VALID;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_comments_single_target'
                  AND conrelid = 'public.comments'::regclass
            ) THEN
                ALTER TABLE public.comments
                ADD CONSTRAINT ck_comments_single_target
                CHECK ((post_id IS NOT NULL AND recipe_id IS NULL)
                    OR (post_id IS NULL AND recipe_id IS NOT NULL)) NOT VALID;
            END IF;
        END;
        $$
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT review_id, row_number() OVER (
                PARTITION BY user_id, recipe_id
                ORDER BY updated_at DESC, created_at DESC, review_id
            ) AS position
            FROM public.recipe_reviews
        )
        DELETE FROM public.recipe_reviews AS duplicate
        USING ranked
        WHERE duplicate.review_id = ranked.review_id AND ranked.position > 1
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_reviews_user_recipe
        ON public.recipe_reviews (user_id, recipe_id)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recipes_category_published "
        "ON public.recipes (category, is_published, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_recipes_category_published")
    op.execute("DROP INDEX IF EXISTS public.uq_recipe_reviews_user_recipe")
    op.execute("ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS ck_comments_single_target")
    op.execute("ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS ck_likes_single_target")
    op.execute("DROP INDEX IF EXISTS public.uq_likes_user_recipe")
    op.execute("DROP INDEX IF EXISTS public.uq_likes_user_post")
    op.execute("DROP TABLE IF EXISTS public.post_saves")
    op.execute("ALTER TABLE public.recipes DROP COLUMN IF EXISTS is_published")
    op.execute("ALTER TABLE public.recipes DROP COLUMN IF EXISTS allergen_tags")
    op.execute("ALTER TABLE public.recipes DROP COLUMN IF EXISTS category")
    op.execute("ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS social_links")
    op.execute("ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS website_url")
    op.execute("ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS cuisine_interests")
    op.execute("ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS cover_image_url")
