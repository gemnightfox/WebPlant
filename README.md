# WebPlant

WebPlant is a Django-based collaboration app for organizing team work inside shared workspaces.  
Each workspace contains projects, projects contain groups, and groups contain tasks with comments, files, reminders, and notifications.

## Key Features

- Workspace membership model with invite flows and activation state
- Workspace-scoped roles with granular permission booleans
- Nested work structure: Workspace -> Project -> Group -> Task
- Task collaboration: comments, attachments, completion status, due reminders
- Notification pipeline for in-app records and outbound email
- Optional Redis-backed caching/channel layer for improved realtime behavior

## Tech Stack

- Python + Django 6
- Custom auth user model (`accounts.CustomUser`)
- `django-allauth` (email/password + Google social login support)
- PostgreSQL or SQLite (through `DATABASE_URL`)
- Django Channels + Daphne for realtime collaboration events
- Cloudinary storage for media files (or local filesystem fallback)
- WhiteNoise for static asset serving
- Sentry SDK for runtime error/performance reporting

## Quick Start

1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Configure environment variables:
   - see `docs/configuration.md`
4. Run database migrations:
   - `python manage.py migrate`
5. Create an admin user:
   - `python manage.py createsuperuser`
6. Start the web server:
   - `python manage.py runserver`

If `REDIS_URL` is set, websocket fan-out uses Redis channel layer.  
Reminder sending is currently scheduler/script-driven (see `docs/development.md`).

## Documentation

- `docs/README.md`: documentation entry point and reading map
- `docs/architecture.md`: runtime architecture and request/permission flow
- `docs/backend-patterns.md`: backend design patterns and feature checklist
- `docs/domain-model.md`: model relationships and domain invariants
- `docs/configuration.md`: required/optional environment variables and behavior
- `docs/development.md`: local setup, commands, and development workflow

Frontend-specific implementation constraints are documented in `FRONTEND_INSTRUCTIONS.md`.
