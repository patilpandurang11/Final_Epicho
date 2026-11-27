"""Authentication lifecycle tokens, account roles, and business subtypes.

Revision ID: 0002_auth_lifecycle
Revises: 0001_epicho_v2
"""
from alembic import op

revision = "0002_auth_lifecycle"
down_revision = "0001_epicho_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE public.business_category ADD VALUE IF NOT EXISTS 'Chef'"
        )
        op.execute(
            "ALTER TYPE public.business_category ADD VALUE IF NOT EXISTS 'FoodBrand'"
        )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.auth_action_tokens (
            token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.user_accounts(user_id) ON DELETE CASCADE,
            token_hash text NOT NULL,
            purpose varchar(32) NOT NULL
                CHECK (purpose IN ('verify_email', 'password_reset')),
            expires_at timestamptz NOT NULL,
            used_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_public_auth_action_tokens_token_hash
        ON public.auth_action_tokens (token_hash)
        """
    )
    op.execute(
        """
        INSERT INTO public.roles (role_id, role_name, tier, description, status)
        VALUES
            (gen_random_uuid(), 'registered', 'registered', 'Community account', 'active'),
            (gen_random_uuid(), 'business', 'business', 'Verified business profile capability', 'active'),
            (gen_random_uuid(), 'restaurant', 'business', 'Verified restaurant profile capability', 'active'),
            (gen_random_uuid(), 'nutritionist', 'business', 'Verified nutritionist profile capability', 'active'),
            (gen_random_uuid(), 'chef', 'business', 'Verified culinary chef profile capability', 'active'),
            (gen_random_uuid(), 'food_brand', 'business', 'Verified food brand profile capability', 'active')
        ON CONFLICT (role_name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.auth_action_tokens")
