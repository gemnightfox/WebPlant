# Environment Variables
[Back to README.md](../../README.md)

All configuration is injected via a `.env` file in the project root. Variables are loaded by `python-dotenv` at startup.



## All Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | _(random per restart)_ | Django secret key for signing sessions and tokens. Use a long random string. The random default logs users out on every restart. **Required in production.** |
| `URL_SECRET` | _(none)_ | Appended to the admin and debug URLs to obscure them (e.g. `/admin/<URL_SECRET>/`). **Required in production.** |
| `ALLOWED_HOSTS` | _(empty)_ | Comma-separated list of allowed domain names (e.g. `example.com,www.example.com`). `localhost` and `127.0.0.1` are added automatically in debug mode. **Required in production.** |
| `DATABASE_URL` | `sqlite:///db.sqlite3` | Full database connection string (e.g. `postgres://user:pass@host:5432/db`). Defaults to SQLite if absent. |
| `DEFAULT_FROM_EMAIL` | `email@example.com` | The "From" address used for all outbound email. **Required in production.** |
| `RESEND_API_KEY` | _(none)_ | API key for the [Resend](https://resend.com) email service. **Required in production.** |
| `GOOGLE_CLIENT_ID` | _(none)_ | Google OAuth 2.0 client ID (from Google Cloud Console). **Required in production.** |
| `GOOGLE_SECRET` | _(none)_ | Google OAuth 2.0 client secret. **Required in production.** |
| `DJANGO_DEBUG` | `False` | Set to `'True'` in development only. Enables the debug toolbar, relaxed security, and console email. **Never set in production.** |
| `REDIS_URL` | _(none)_ | Redis connection URL. Enables caching, rate limiting, and async Celery workers. Without it, Celery runs in eager (synchronous) mode. |
| `SENTRY_DSN` | _(none)_ | Sentry DSN for error tracking. Omit to disable Sentry. |



## Development `.env` recommended minimum

```env
DJANGO_DEBUG='True'
DJANGO_SECRET_KEY='any-random-value'
```

All other variables are optional in development. Email falls back to the console backend, Celery runs eagerly, and SQLite is used if `DATABASE_URL` is not set.



## How Settings Uses These Variables

- `DEBUG` — read from `DJANGO_DEBUG`; defaults to `False` if absent.
- `SECRET_KEY` — read from `DJANGO_SECRET_KEY`; randomised per process restart if absent (safe in dev, not in prod).
- `DATABASES` — parsed by `dj-database-url`; defaults to `sqlite:///db.sqlite3`.
- `ALLOWED_HOSTS` — split on commas; `localhost` and `127.0.0.1` are added automatically in debug mode.
- Security settings (HTTPS-only cookies, HSTS, SSL redirect) are **enabled automatically when `DEBUG` is `False`**.
