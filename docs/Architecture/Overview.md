# Architecture Overview
[Back to README.md](../../README.md)



## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Django 6.0 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Task Queue | Celery + Redis |
| Static Files | WhiteNoise |
| WSGI Server | Gunicorn |
| Auth | django-allauth (email + Google OAuth) |
| Email | django-anymail + Resend |
| Error Tracking | Sentry |
| Rate Limiting | django-ratelimit (Redis-backed) |



## Django Apps

| App | Responsibility |
|---|---|
| `home` | Landing / homepage |
| `accounts` | Custom user model, profile, preferences |
| `feedback` | User feedback collection |
| `notification` | In-app notification system |
| `workspace` | Top-level workspace container |
| `workspace_role` | Per-workspace role & permission management |
| `project` | Projects within a workspace |
| `group` | Teams / groups within a workspace |
| `task` | Tasks, assignments, and reminders |

The custom user model lives at `accounts.CustomUser`. All auth is email-based (no username).



## Request Lifecycle

```
Browser
  └─ Gunicorn (WSGI)
       └─ Django middleware stack
            ├─ WhiteNoise (static files, short-circuits early)
            ├─ AllAuth AccountMiddleware
            ├─ Rate limiting (Redis, if configured)
            └─ URL router → view → template response
```



## Background Jobs

Async work is handled by Celery workers talking to a Redis broker. When `REDIS_URL` is not set (e.g., local dev without Redis), Celery falls back to **eager mode** — tasks execute synchronously in the same process.

Scheduled tasks are managed by `django-celery-beat` and stored in the database. The current scheduled job:

| Task | Schedule |
|---|---|
| `task.tasks.send_task_alert` | Every 5 minutes |

See [Background Tasks/Celery.md](../Background%20Tasks/Celery.md) for setup.



## Key Configuration Points

- All secrets and environment-specific values are loaded from a `.env` file via `python-dotenv`.
- Debug mode, database URL, allowed hosts, and feature flags are all env-driven — no production values live in `settings.py`.
- The admin URL is randomised in production via `URL_SECRET` to reduce attack surface.

See [Configuration/Environment.md](../Configuration/Environment.md) for the full variable reference.
