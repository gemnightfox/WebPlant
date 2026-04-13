# WebPlant

WebPlant is a collaborative work management application built with Django. Users organize work in a hierarchy of workspaces, projects, groups, and tasks, with role-based permissions, notifications, and scheduled reminder emails.

## What It Includes

- Multi-user workspaces with invite and membership workflows
- Workspace-scoped role permissions for project/task actions
- Project -> Group -> Task hierarchy with comments, attachments, and reminders
- Notification system with email delivery controls and temporary mute windows
- Optional Redis-backed background processing through Celery

## Backend Stack (High Level)

- Django 6 with a custom user model
- PostgreSQL or SQLite (via `DATABASE_URL`)
- django-allauth for authentication (including Google sign-in)
- Celery + django-celery-beat for scheduled background jobs
- Cloudinary for media storage and WhiteNoise for static files

## Quick Start

1. Create and activate a Python virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Set environment variables (see `docs/configuration.md`).
4. Run migrations:
   - `python manage.py migrate`
5. Create an admin account:
   - `python manage.py createsuperuser`
6. Start the development server:
   - `python manage.py runserver`

If `REDIS_URL` is configured, you can also run Celery worker and beat processes (see `docs/development.md`).

## Documentation

Backend-focused docs:

- `docs/README.md`
- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/configuration.md`
- `docs/development.md`

Frontend contribution constraints are documented in `FRONTEND_INSTRUCTIONS.md`.
