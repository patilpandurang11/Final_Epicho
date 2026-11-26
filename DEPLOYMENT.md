# EpiCho Deployment & Ubuntu Operations Guide

## 1. Ubuntu 24.04 / 22.04 Setup

```bash
sudo apt update && sudo apt install -y python3-venv python3-dev libpq-dev postgresql postgresql-contrib redis-server ffmpeg nginx
```

Create the PostgreSQL role and database:
```bash
sudo -u postgres psql -c "CREATE USER epicho WITH PASSWORD 'your-strong-password';"
sudo -u postgres psql -c "CREATE DATABASE epicho OWNER epicho;"
```

## 2. Docker Compose Deployment

```bash
cp .env.example .env
# Set ENVIRONMENT=production, strong JWT_SECRET, FIELD_ENCRYPTION_KEY, POSTGRES_PASSWORD, GEMINI_API_KEY, RAZORPAY_*
docker compose up -d --build
```

## 3. Production Security Checklist

1. Set `ENVIRONMENT=production` and `ALLOW_SANDBOX_PAYMENTS=false`.
2. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` so all payment confirmations and `/api/v1/subscriptions/webhook` events are cryptographically verified.
3. Generate strong `JWT_SECRET` and `FIELD_ENCRYPTION_KEY` (32+ chars) for DPDP-compliant encryption of `allergies_encrypted` and `health_conditions_encrypted`.
4. Enable TOTP MFA for all 9 administrative staff roles via `/settings` or `/api/v1/auth/mfa/setup`.
5. Configure HTTPS termination via Nginx + Let's Encrypt in front of ports `3000` and `8000`.
6. Schedule automated daily `pg_dump` backups of PostgreSQL.
