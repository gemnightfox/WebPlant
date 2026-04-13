# Development Guide

## Project Layout (Backend)

- `WebPlant/`: Django project package (settings, root URLs, ASGI/WSGI, Celery app)
- App directories: `accounts/`, `workspace/`, `workspace_role/`, `project/`, `group/`, `task/`, `notification/`, `feedback/`, `home/`
- Shared utilities: `base_utils.py`
- Entry point: `manage.py`

## Local Setup

1. Create and activate virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Configure environment variables (see `configuration.md`).
4. Apply migrations:
   - `python manage.py migrate`
5. Create superuser:
   - `python manage.py createsuperuser`
6. Run server:
   - `python manage.py runserver`

## Common Commands

- Make migrations: `python manage.py makemigrations`
- Apply migrations: `python manage.py migrate`
- Django shell: `python manage.py shell`
- Run tests: `python manage.py test`

## Celery (Optional)

If `REDIS_URL` is configured, run background processes in separate terminals:

- Worker: `celery -A WebPlant worker -l info`
- Beat scheduler: `celery -A WebPlant beat -l info`

Scheduled task configured in settings:

- `task.tasks.send_task_alert` (checks due task reminders and sends emails)

## Backend Development Notes

- Authorization is workspace-centric (`WorkspaceUser` + `WorkspaceRole`).
- Permission checks are centralized in utility functions rather than class-based policy objects.
- Many mutating handlers are form-based and use `reusable_form_submission(...)`.
- Frontend behavior rules are documented separately in `../FRONTEND_INSTRUCTIONS.md`.
