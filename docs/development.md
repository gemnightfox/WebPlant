# Development Guide

## Backend Layout

- `WebPlant/`: project package (`settings.py`, `urls.py`, `celery.py`, ASGI/WSGI)
- Domain apps: `accounts/`, `workspace/`, `project/`, `group/`, `task/`, `notification/`, `feedback/`, `home/`
- Shared utilities: `base_utils.py`
- Templates/static: `templates/`, `static/`
- Entry point: `manage.py`

## Local Setup

1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Add environment variables (see `configuration.md`).
4. Run migrations:
   - `python manage.py migrate`
5. Create an admin user:
   - `python manage.py createsuperuser`
6. Start development server:
   - `python manage.py runserver`

## Day-to-Day Commands

- Create migrations: `python manage.py makemigrations`
- Apply migrations: `python manage.py migrate`
- Run full test suite: `python manage.py test`
- Start Django shell: `python manage.py shell`
- Collect static files (deployment prep): `python manage.py collectstatic`

## Optional Celery Processes

If `REDIS_URL` is configured, run in separate terminals:

- Worker: `celery -A WebPlant worker -l info`
- Beat: `celery -A WebPlant beat -l info`

Scheduled task:

- `task.tasks.send_task_alert` (runs every 5 minutes, sends due reminder notifications)

Without `REDIS_URL`, Celery tasks run eagerly in-process, which keeps local setup lightweight.

## Development Conventions

- Workspace permissions are enforced through `WorkspaceUser` membership + `WorkspaceRole` booleans.
- Mutating endpoints commonly use forms and `reusable_form_submission(...)` for validation/save patterns.
- Ownership and membership checks happen before domain-level edits.
- Notification delivery should respect user preference toggles and temporary disable durations.

## Troubleshooting Tips

- If production mode fails at startup, verify all required environment variables are set.
- If reminders are not firing, confirm `REDIS_URL`, Celery worker, and Celery beat are all running.
- If uploads fail, verify `CLOUDINARY_URL` or local media write permissions.

Frontend-specific constraints are documented in `../FRONTEND_INSTRUCTIONS.md`.
