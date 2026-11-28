# EpiCho Deployment & Ubuntu Operations Guide

## 1. Ubuntu 24.04 / 22.04 Setup

```bash
cp .env.example .env
# Generate separate URL-safe values for POSTGRES_PASSWORD, JWT_SECRET, and FIELD_ENCRYPTION_KEY.
openssl rand -hex 32
sudo apt update && sudo apt install -y python3-venv python3-dev libpq-dev postgresql postgresql-contrib redis-server ffmpeg nginx
```

Replace the placeholder values in `.env` before starting the application. The file is
excluded from Git and must not be shared or committed.

Create the PostgreSQL role and database:
```bash
sudo -u postgres psql -c "CREATE USER epicho WITH PASSWORD 'your-strong-password';"
sudo -u postgres psql -c "CREATE DATABASE epicho OWNER epicho;"
```

## 2. Docker Compose Deployment

```bash
docker compose config
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Compose publishes application and data services on loopback only. Put a reverse proxy
in front of the frontend/backend when deploying; do not expose development services
directly to the public internet. Production startup requires explicit database, JWT,
field-encryption, and CORS configuration.

The bootstrap migration creates missing ORM tables, followed by additive schema
alignment. Revision `0002_auth_lifecycle` only removes its own action-token table
on downgrade; it retains enum values and role rows to avoid invalidating existing
accounts. Back up the database before applying migrations to an existing
installation, then verify the schema and application health.

## 3. Production Security Checklist

1. Set `ENVIRONMENT=production` and `ALLOW_SANDBOX_PAYMENTS=false`.
2. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` so all payment confirmations and `/api/v1/subscriptions/webhook` events are cryptographically verified.
3. Generate strong `JWT_SECRET` and `FIELD_ENCRYPTION_KEY` (32+ chars) for DPDP-compliant encryption of `allergies_encrypted` and `health_conditions_encrypted`.
4. Configure `SMTP_HOST`, `SMTP_FROM`, credentials as required by the provider, and an HTTPS `FRONTEND_BASE_URL` for verification and password-recovery email.
5. Enable TOTP MFA for all 9 administrative staff roles via `/settings` or `/api/v1/auth/mfa/setup`.
6. Configure HTTPS termination via Nginx + Let's Encrypt in front of ports `3000` and `8000`.
7. Schedule automated daily `pg_dump` backups of PostgreSQL.
