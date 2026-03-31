# Rate Limiting — django-ratelimit
[Back to README.md](../../README.md)

Rate limiting is provided by [django-ratelimit](https://django-ratelimit.readthedocs.io/) and is only active when `REDIS_URL` is set. Without Redis, `django_ratelimit` is not added to `INSTALLED_APPS` and rate-limit decorators have no effect.



## How It Works

`django-ratelimit` works via view decorators (or mixins for class-based views). Limits are checked against a Redis-backed counter keyed by IP address, user, or any request field.

```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='10/m', block=True)
def my_view(request):
    ...
```

Common parameters:

| Parameter | Description |
|---|---|
| `key` | What to rate-limit by — `'ip'`, `'user'`, or a custom field |
| `rate` | Limit in `count/period` format — e.g. `'10/m'`, `'100/h'` |
| `block` | If `True`, returns HTTP 429 when the limit is exceeded; if `False`, sets `request.limited` instead |



## Project Setup

`django_ratelimit` is conditionally added to `INSTALLED_APPS` only when `REDIS_URL` is present. No further project-level configuration is required — limits are applied per-view in individual apps.

To enable in development, add `REDIS_URL` to your `.env` and ensure Redis is running locally.
