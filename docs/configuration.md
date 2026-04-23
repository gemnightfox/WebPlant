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

All variables below are required in production.  
The table column indicates whether each variable is required during DEBUG/development.

### Core

| Variable | Required for DEBUG/Development | Purpose |
| --- | --- | --- |
| `DJANGO_DEBUG` | Yes | Enables debug or production behavior |
| `DJANGO_SECRET_KEY` | No (auto-generated fallback) | Django signing/encryption key |
| `ALLOWED_HOSTS` | No (localhost defaults are added) | Comma-separated host list |
| `DATABASE_URL` | No (SQLite fallback: `sqlite:///db.sqlite3`) | Database DSN |
| `URL_SECRET` | No | Suffixes admin/error-test URLs for obscurity |
| `SENTRY_DSN` | No | Sentry telemetry destination |

### Infrastructure and Async

| Variable | Required for DEBUG/Development | Purpose |
| --- | --- | --- |
| `REDIS_URL` | No | Enables Redis cache + Redis channel layer + ratelimit app |
| `CLOUDINARY_URL` | No | Enables Cloudinary media storage backend |

### Email and Auth

| Variable | Required for DEBUG/Development | Purpose |
| --- | --- | --- |
| `DEFAULT_FROM_EMAIL` | No (`email@example.com` default) | Sender used for outbound email |
| `RESEND_API_KEY` | No (console email backend in debug) | API key for Anymail Resend backend |
| `GOOGLE_CLIENT_ID` | Only if Google login is enabled | OAuth client ID |
| `GOOGLE_SECRET` | Only if Google login is enabled | OAuth client secret |

## Redis and Channels Behavior

When `REDIS_URL` is configured:

- default cache backend uses `django_redis`
- `django_ratelimit` is added to `INSTALLED_APPS`
- Channels uses Redis channel layer backend (`channels_redis`)

When `REDIS_URL` is not configured:

- Channels uses in-memory channel layer backend
- Redis-backed ratelimiting is unavailable

## Email Backend Behavior

- Debug mode: `django.core.mail.backends.console.EmailBackend`
- Production mode: `anymail.backends.resend.EmailBackend`
- Email delivery depends on user/workspace notification preferences and mute windows

## Reminder Dispatch Behavior

- Task reminders are persisted in `task.TaskReminder`.
- Reminder dispatch currently depends on external scheduling invoking `task/cron_scripts/send_task_reminders.py`.
- If you deploy reminders, ensure the scheduler environment provides valid Django settings and project env vars.

## Production Security Defaults

With `DJANGO_DEBUG=False`, settings enable:

- HTTPS redirect (`SECURE_SSL_REDIRECT`)
- secure session and CSRF cookies
- HSTS with preload/subdomain support
- secure proxy SSL header
- clickjacking/content-type hardening
