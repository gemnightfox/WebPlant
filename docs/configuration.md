# Configuration

## Runtime Modes

- `DJANGO_DEBUG=True`
  - permissive local-development defaults
  - console email backend
  - missing env vars can fall back to defaults
- `DJANGO_DEBUG=False`
  - strict env loading (`custom_getenv` raises when values are missing)
  - production security headers/settings are enabled
  - online email backend is used

## Environment Variables

### Core

| Variable | Required | Purpose |
| --- | --- | --- |
| `DJANGO_DEBUG` | Only in DEBUG, do NOT use in production | Enables debug or production behavior |
| `DJANGO_SECRET_KEY` | Production: yes | Django signing/encryption key |
| `ALLOWED_HOSTS` | Production: yes | Comma-separated host list |
| `DATABASE_URL` | Recommended | Database DSN (debug fallback: `sqlite:///db.sqlite3`) |
| `URL_SECRET` | Optional | Suffixes admin/error-test URLs for obscurity |
| `SENTRY_DSN` | Recommended | Sentry telemetry destination |

### Infrastructure and Async

| Variable | Required | Purpose |
| --- | --- | --- |
| `REDIS_URL` | Optional | Enables Redis cache + Celery broker/backend + ratelimit app |
| `CLOUDINARY_URL` | Optional (production-recommended) | Enables Cloudinary media storage backend |

### Email and Auth

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEFAULT_FROM_EMAIL` | Recommended | Sender used for outbound email |
| `RESEND_API_KEY` | Production: yes | API key for Anymail Resend backend |
| `GOOGLE_CLIENT_ID` | If Google login enabled | OAuth client ID |
| `GOOGLE_SECRET` | If Google login enabled | OAuth client secret |

## Redis and Celery Behavior

When `REDIS_URL` is configured:

- default cache backend uses `django_redis`
- `django_ratelimit` is added to `INSTALLED_APPS`
- `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` use Redis
- Celery worker and beat should run as separate processes

When `REDIS_URL` is not configured:

- tasks run eagerly in-process (`CELERY_TASK_ALWAYS_EAGER=True`)
- async behavior is still testable locally without external infrastructure

## Email Backend Behavior

- Debug mode: `django.core.mail.backends.console.EmailBackend`
- Production mode: `anymail.backends.resend.EmailBackend`
- Email delivery depends on user/workspace notification preferences and mute windows

## Production Security Defaults

With `DJANGO_DEBUG=False`, settings enable:

- HTTPS redirect (`SECURE_SSL_REDIRECT`)
- secure session and CSRF cookies
- HSTS with preload/subdomain support
- secure proxy SSL header
- clickjacking/content-type hardening
