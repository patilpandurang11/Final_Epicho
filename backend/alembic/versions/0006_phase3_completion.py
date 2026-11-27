"""Phase 3 collections, review feedback, and moderation.

Revision ID: 0006_phase3_completion
Revises: 0005_post_shares
"""
from alembic import op


revision = "0006_phase3_completion"
down_revision = "0005_post_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE public.saved_collections (
            collection_id uuid PRIMARY KEY,
            owner_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            name varchar NOT NULL,
            description text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_saved_collections_owner_name UNIQUE (owner_id, name)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_saved_collections_owner ON public.saved_collections (owner_id)"
    )
    op.execute(
        """
        CREATE TABLE public.collection_items (
            item_id uuid PRIMARY KEY,
            collection_id uuid NOT NULL REFERENCES public.saved_collections(collection_id) ON DELETE CASCADE,
            recipe_id uuid REFERENCES public.recipes(recipe_id) ON DELETE CASCADE,
            post_id uuid REFERENCES public.posts(post_id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ck_collection_item_single_target CHECK (
                (recipe_id IS NOT NULL AND post_id IS NULL)
                OR (recipe_id IS NULL AND post_id IS NOT NULL)
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_collection_items_collection ON public.collection_items (collection_id)"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_collection_recipe
        ON public.collection_items (collection_id, recipe_id)
        WHERE recipe_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_collection_post
        ON public.collection_items (collection_id, post_id)
        WHERE post_id IS NOT NULL
        """
    )
    op.execute(
        """
        ALTER TABLE public.recipe_reviews
        ADD COLUMN IF NOT EXISTS moderation_status varchar NOT NULL DEFAULT 'approved'
        """
    )
    op.execute(
        """
        CREATE TABLE public.review_feedback (
            feedback_id uuid PRIMARY KEY,
            review_id uuid NOT NULL REFERENCES public.recipe_reviews(review_id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            helpful boolean NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_review_feedback_user_review UNIQUE (review_id, user_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_review_feedback_review ON public.review_feedback (review_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.review_feedback")
    op.execute("ALTER TABLE public.recipe_reviews DROP COLUMN IF EXISTS moderation_status")
    op.execute("DROP TABLE IF EXISTS public.collection_items")
    op.execute("DROP TABLE IF EXISTS public.saved_collections")
