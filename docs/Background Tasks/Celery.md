# Background Tasks — Celery
[Back to README.md](../../README.md)

Async and scheduled tasks run on [Celery](https://docs.celeryq.dev/) with Redis as the message broker and result backend. Scheduled jobs are stored in the database and managed by [django-celery-beat](https://django-celery-beat.readthedocs.io/).



## Running Locally

You need Redis running and `REDIS_URL` set in your `.env`. Then start the worker in a separate terminal:

```bash
.\.venv\Scripts\Activate
celery -A WebPlant worker -l info
```

To also run scheduled tasks, start the beat scheduler:

```bash
celery -A WebPlant beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```



## Without Redis (Eager Mode)

When `REDIS_URL` is not set, Celery is configured to run in **eager mode**:

```python
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
```

Tasks are executed synchronously in the same process — no worker or broker needed. Useful for local development without Redis.



## Scheduled Tasks

| Task | Module | Schedule |
|---|---|---|
| Send task alerts | `task.tasks.send_task_alert` | Every 5 minutes |

Schedules are seeded and managed via the Django admin at `/admin/django_celery_beat/`.



## Configuration Summary

| Setting | Value |
|---|---|
| App name | `WebPlant` |
| Broker | `REDIS_URL` |
| Result backend | `REDIS_URL` |
| Serializer | JSON |
| Timezone | UTC |
| Task autodiscovery | All installed apps |
