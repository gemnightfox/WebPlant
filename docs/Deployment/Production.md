# Deployment — Production
[Back to README.md](../../README.md)



## Prerequisites

- PostgreSQL database (provide connection string via `DATABASE_URL`)
- Redis instance (provide URL via `REDIS_URL`)
- A domain with HTTPS (required — security settings enforce SSL)



## Required Environment Variables

See [Configuration/Environment.md](../Configuration/Environment.md) for the full reference. At minimum, production needs:

```env
DJANGO_SECRET_KEY=<long-random-string>
URL_SECRET=<random-string>
ALLOWED_HOSTS=yourdomain.com
DATABASE_URL=postgres://user:pass@host:5432/db
DEFAULT_FROM_EMAIL=no-reply@yourdomain.com
RESEND_API_KEY=<key>
GOOGLE_CLIENT_ID=<id>
GOOGLE_SECRET=<secret>
REDIS_URL=redis://...
```

Do **not** set `DJANGO_DEBUG` in production.



## Collect Static Files

WhiteNoise serves static files directly from Gunicorn — no separate static-file server needed. Run once after each deploy:

```bash
python manage.py collectstatic --no-input
```

Files are collected into `staticfiles/` and served compressed with long-lived cache headers.



## Run Migrations

```bash
python manage.py migrate
```



## Start the Application

```bash
gunicorn WebPlant.wsgi:application --bind 0.0.0.0:8000
```

Gunicorn is the WSGI server. Put a reverse proxy (nginx, Caddy, or your platform's load balancer) in front of it to terminate TLS.



## Start Background Workers

In a separate process:

```bash
celery -A WebPlant worker -l info
celery -A WebPlant beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

See [Background Tasks/Celery.md](../Background%20Tasks/Celery.md) for details.



## Security Settings (auto-enabled in production)

When `DEBUG` is `False`, Django automatically enables:

| Setting | Value |
|---|---|
| `SECURE_SSL_REDIRECT` | `True` — redirects all HTTP to HTTPS |
| `SESSION_COOKIE_SECURE` | `True` — session cookie over HTTPS only |
| `CSRF_COOKIE_SECURE` | `True` — CSRF cookie over HTTPS only |
| `SECURE_HSTS_SECONDS` | 31,536,000 (1 year) |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` |
| `SECURE_HSTS_PRELOAD` | `True` |
| `X_FRAME_OPTIONS` | `DENY` |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` |

The proxy must forward `X-Forwarded-Proto: https` so Django can detect HTTPS behind a load balancer.



## Admin URL

In production the admin is mounted at `/admin/<URL_SECRET>/` instead of `/admin/`. Set a strong random value for `URL_SECRET` and keep it secret.



## Error Tracking

Set `SENTRY_DSN` to your project's DSN to enable Sentry. Performance tracing runs at 100% sample rate by default — adjust `traces_sample_rate` in `settings.py` if needed.
