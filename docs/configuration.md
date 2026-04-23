# Configuration

This document reflects the current behavior in `WebPlant/settings.py`, `WebPlant/urls.py`, and `base_utils.py`.

## Runtime Modes

The project has two behavior switches:

- `DEBUG` in settings uses `os.getenv('DJANGO_DEBUG', 'False') == 'True'`.
- `custom_getenv(...)` checks `os.getenv('DJANGO_DEBUG') == 'True'`.

In practice:

- **Debug (`DJANGO_DEBUG='True'`)**
  - `custom_getenv` returns defaults when provided.
  - Missing vars without defaults return `None`.
  - Email backend is console.
  - `127.0.0.1` and `localhost` are auto-added to `ALLOWED_HOSTS`.
- **Production (`DJANGO_DEBUG` anything else)**
  - Every `custom_getenv(...)` lookup must be present and non-empty.
  - Defaults passed to `custom_getenv` are ignored.
  - Production security settings are enabled.
  - `MAIN_DOMAIN_NAME` is `webplant.org` and must be in `ALLOWED_HOSTS`.

## Environment Variables

`DJANGO_DEBUG` is the only key in this project that is not resolved through `custom_getenv`.
Every key below is read from code and included for completeness.

| Variable | Required in Debug | Required in Production | Purpose |
| --- | --- | --- | --- |
| `DJANGO_DEBUG` | Yes (set to `'True'` for debug mode) | Yes (set to non-`'True'` for production) | Global debug/production mode switch |
| `DJANGO_SECRET_KEY` | No (random fallback is used) | Yes | Django signing and encryption key |
| `ALLOWED_HOSTS` | No (empty allowed, localhost auto-added) | Yes | Comma-separated host list; must include `webplant.org` |
| `DATABASE_URL` | No (`sqlite:///db.sqlite3` fallback) | Yes | Database DSN used by `dj_database_url` |
| `URL_SECRET` | No | Yes | Obscures `/admin/` and `/trigger-error/` route suffix |
| `REDIS_URL` | No | Yes | Enables Redis cache, Redis channel layer, and `django_ratelimit` app loading |
| `CLOUDINARY_URL` | No | Yes | Cloudinary credential source for media integration |
| `B2_JSON` | No | Yes | Backblaze B2 backup storage configuration JSON |
| `RESEND_API_KEY` | No | Yes | Resend key used by Anymail |
| `DEFAULT_FROM_EMAIL` | No (`email@example.com` fallback) | Yes | Outbound sender identity |
| `GOOGLE_CLIENT_ID` | No | Yes | Google OAuth client ID for allauth provider config |
| `GOOGLE_SECRET` | No | Yes | Google OAuth client secret for allauth provider config |
| `SENTRY_DSN` | No | Yes | Sentry DSN used during `sentry_sdk.init` |

## Integration and Fallback Behavior

### Redis, Cache, Channels, and Rate Limiting

When `REDIS_URL` is set:

- `django_ratelimit` is appended to `INSTALLED_APPS`.
- Default Django cache uses `django_redis`.
- Channels uses `channels_redis.core.RedisChannelLayer`.

When `REDIS_URL` is not set (debug only):

- Channels falls back to `channels.layers.InMemoryChannelLayer`.
- Custom cache config is not set, so Django default cache behavior applies.

### Cloudinary and Media

- `STORAGES['default']` is always `cloudinary_storage.storage.MediaCloudinaryStorage`.
- `CLOUDINARY_URL` controls runtime `cloudinary.config(...)`.
- In debug, missing `CLOUDINARY_URL` can still allow local media URL serving via `static(...)` fallback in `WebPlant/urls.py`.
- In production, `CLOUDINARY_URL` must be set because `custom_getenv` is strict.

### Database Backups (`dbbackup`)

- `B2_JSON` present:
  - Uses `storages.backends.s3boto3.S3Boto3Storage`.
  - Backup location prefix is `development/` in debug and `production/` in production.
- `B2_JSON` absent (debug only):
  - Falls back to local filesystem storage at `db_backups/`.

`B2_JSON` expected shape:

```json
{
  "B2_REGION": "us-west-000",
  "B2_ACCESS_KEY": "...",
  "B2_SECRET_KEY": "...",
  "B2_BUCKET_NAME": "..."
}
```

### Email and Notifications

- Debug email backend: `django.core.mail.backends.console.EmailBackend`.
- Production email backend: `anymail.backends.resend.EmailBackend`.
- Notification emails are filtered by:
  - user preference (`UserPreference.can_receive_notifications`),
  - temporary mute windows (`NotificationDisabledDuration`),
  - rate checks in `notification/utils.py`.

### Observability

- Sentry initializes on startup with:
  - `traces_sample_rate=1`,
  - `profiles_sample_rate=1`,
  - `send_default_pii=True`.

## Reminder Dispatch

- Reminders are stored in `task.TaskReminder`.
- Dispatch is script-based, not queue-worker based:
  - `task/cron_scripts/send_task_reminders.py`
- A scheduler (Task Scheduler/cron/CI schedule) must invoke the script.

## Production Security Defaults

When `DEBUG` is false:

- `SECURE_SSL_REDIRECT = True`
- secure session and CSRF cookies
- HSTS enabled with subdomains and preload
- secure proxy SSL header
- `X_FRAME_OPTIONS = 'DENY'`
- `SECURE_CONTENT_TYPE_NOSNIFF = True`

## Minimal Local `.env` Example

```env
DJANGO_DEBUG='True'
DJANGO_SECRET_KEY='dev-secret'
# optional in debug:
# DATABASE_URL='sqlite:///db.sqlite3'
# REDIS_URL='redis://127.0.0.1:6379/0'
# CLOUDINARY_URL='cloudinary://...'
```


