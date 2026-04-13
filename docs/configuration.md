# Configuration

## Runtime Modes

- `DJANGO_DEBUG=True`: development behavior (console email backend, permissive env defaults)
- `DJANGO_DEBUG=False`: production behavior (strict env requirements, security settings enabled)

The settings helper `get_env(...)` enforces required variables when debug is off.

## Core Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DJANGO_DEBUG` | Yes | Toggle debug/production behavior |
| `DJANGO_SECRET_KEY` | Production: yes | Django secret key |
| `ALLOWED_HOSTS` | Production: yes | Comma-separated allowed hosts |
| `DATABASE_URL` | Recommended | Database DSN (SQLite fallback in debug) |
| `URL_SECRET` | Optional | Adds secret suffix to admin/test error routes |
| `REDIS_URL` | Optional | Enables Redis cache + Celery broker/backend + ratelimit app |
| `DEFAULT_FROM_EMAIL` | Recommended | Sender address for outbound email |
| `RESEND_API_KEY` | Production: yes | Email provider key via Anymail |
| `GOOGLE_CLIENT_ID` | If Google auth used | OAuth client ID |
| `GOOGLE_SECRET` | If Google auth used | OAuth client secret |
| `CLOUDINARY_URL` | Production: yes | Cloudinary API URL |
| `SENTRY_DSN` | Recommended | Sentry error reporting DSN |

## Redis and Celery Behavior

When `REDIS_URL` is set:

- Redis cache backend is configured.
- `django_ratelimit` is added to installed apps.
- Celery broker and result backend use Redis.

When `REDIS_URL` is not set:

- Celery runs in eager mode (`CELERY_TASK_ALWAYS_EAGER=True`), useful for local development.

## Email and Auth Notes

- Debug uses console email backend.
- Production uses `anymail.backends.resend.EmailBackend`.
- `django-allauth` is enabled for account flows and Google social auth.

## Security Defaults in Production

With `DJANGO_DEBUG=False`, settings enable SSL redirect, secure cookies, HSTS, and related hardening options.
