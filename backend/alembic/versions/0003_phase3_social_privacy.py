"""Phase 3 privacy and social integrity.

Revision ID: 0003_phase3_social_privacy
Revises: 0002_auth_lifecycle
"""
from alembic import op


revision = "0003_phase3_social_privacy"
down_revision = "0002_auth_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "
        "is_private boolean NOT NULL DEFAULT false"
    )
    op.execute(
        "ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS "
        "status text NOT NULL DEFAULT 'accepted'"
    )
    op.execute(
        "ALTER TABLE public.ai_requests ADD COLUMN IF NOT EXISTS "
        "history_deleted_at timestamptz"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_likes_user_post "
        "ON public.likes (user_id, post_id) WHERE post_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_likes_user_recipe "
        "ON public.likes (user_id, recipe_id) WHERE recipe_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recipe_reviews_user_recipe "
        "ON public.recipe_reviews (user_id, recipe_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_requests_user_created "
        "ON public.ai_requests (user_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_follows_following_status "
        "ON public.follows (following_id, status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recipe_reviews_recipe_id "
        "ON public.recipe_reviews (recipe_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_comments_post_created "
        "ON public.comments (post_id, created_at)"
    )
    op.execute(
        """
        UPDATE public.ai_requests
        SET macro_flavor_options = (
            (COALESCE(macro_flavor_options::jsonb, '{}'::jsonb) - 'allergies')
            || jsonb_build_object(
                'allergen_count',
                jsonb_array_length(
                    COALESCE(macro_flavor_options::jsonb -> 'allergies', '[]'::jsonb)
                )
            )
        )::json
        WHERE macro_flavor_options::jsonb ? 'allergies'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_comments_post_created")
    op.execute("DROP INDEX IF EXISTS public.ix_recipe_reviews_recipe_id")
    op.execute("DROP INDEX IF EXISTS public.ix_follows_following_status")
    op.execute("DROP INDEX IF EXISTS public.ix_ai_requests_user_created")
    op.execute("DROP INDEX IF EXISTS public.ix_recipe_reviews_user_recipe")
    op.execute("DROP INDEX IF EXISTS public.ix_likes_user_recipe")
    op.execute("DROP INDEX IF EXISTS public.ix_likes_user_post")
    op.execute("ALTER TABLE public.follows DROP COLUMN IF EXISTS status")
    op.execute("ALTER TABLE public.ai_requests DROP COLUMN IF EXISTS history_deleted_at")
    op.execute("ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_private")
