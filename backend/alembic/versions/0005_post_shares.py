"""Persist post-share events.

Revision ID: 0005_post_shares
Revises: 0004_phase3_integrity
"""
from alembic import op


revision = "0005_post_shares"
down_revision = "0004_phase3_integrity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE public.post_shares (
            share_id uuid PRIMARY KEY,
            user_id uuid REFERENCES public.user_accounts(user_id) ON DELETE SET NULL,
            post_id uuid NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_post_shares_post_created "
        "ON public.post_shares (post_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_post_shares_post_created")
    op.execute("DROP TABLE IF EXISTS public.post_shares")
