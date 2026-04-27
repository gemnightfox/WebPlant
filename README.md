# WebPlant

WebPlant is a Django task management collaboration app for organizing tasks inside shared workspaces (can be used for solo projects as well).
Each workspace contains projects, groups, and tasks with comments, attachments, reminders, and notifications.



## Key Features

- Workspaces with roles and user invitations (invite users to join)
- Nested work structure: Workspace -> Project -> Group -> Task
- Task collaboration: Comments, Attachments, Completion status, Due dates, Reminders
- Real-time collaboration syncing (Channels + Daphne)



## Tech Stack

- Python + Django
- Custom User model (`accounts.CustomUser`)
- Django allauth (email/password + Google social login support)
- PostgreSQL or SQLite (through `DATABASE_URL`)
- Django Channels + Daphne for realtime collaboration events
- Cloudinary (user uploaded media files)
- WhiteNoise (static files)
- Sentry SDK (errors)



## Activating .venv
> This requires `python -m venv .venv` to be run first (view **Quick Start** for more information). Using the wrong cmd will result in an error (nothing breaks, no worries, just run the other command mentioned).

- Windows: `.venv\Scripts\Activate`
- MacOS/Linux: `source .venv/bin/activate`



## Quick Start
> Create an .env file and add: DJANGO_DEBUG='True'
> Note: Different Operating Systems have different ways to activate .venv (view **Activating .venv** for more information)

```bash
python -m venv .venv
.venv\Scripts\Activate
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```



## Notes

- Only use environment variable `DJANGO_DEBUG='True'` for development/DEBUG mode (never in production).
- It is recommended to add `DJANGO_SECRET_KEY='shh-rand0m-value'` (If not present, server auto logs out all users if server restarts during file changes)
- Instructions folder (instructions/...): Files inside holds prompts to be used to guide AI agents (if necessary).





