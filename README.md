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
- Gunicorn
- Custom User model (`accounts.CustomUser`)
- Django allauth (email/password + Google social login support)
- PostgreSQL (SQLite for local db)
- Django Channels + Daphne for real-time collaboration events
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



## Environment Variables
> In production (DEBUG=False), ALL environment variables (except DJANGO_DEBUG) are required (default value is not used/allowed)

| Variable | Required (DEBUG) | Default (DEBUG only) | Notes |
| --- | --- | --- | --- |
| DJANGO_DEBUG | Yes (set as 'True') | 'False' | Do NOT use in production (only DEBUG) |
| DJANGO_SECRET_KEY | Recommended | Randomly generated | If not present, the server will logout all users every time files are edited during development runserver |
| ALLOWED_HOSTS | No | '127.0.0.1' + 'localhost' included | Format: 'example1.com,example2.net,loremipsum.org' |
| DATABASE_URL | No | 'sqlite:///db.sqlite3' (local files) | - |
| URL_SECRET | No | - | Added onto `/admin/` and `/trigger-error/` URL (prevent public from accessing private URLs) |
| REDIS_URL | No | - | If not given, django-ratelimit will not be used (dynamically added into INSTALLED_APPS) |
| CLOUDINARY_URL | No | Local file system (media storage) | CloudinaryField models will not work |
| B2_JSON | No | - | Format (example): {"B2_REGION": "us-east-123", "B2_ACCESS_KEY": "shhh-secret-name", "B2_SECRET_KEY": "shhh-secret-password", "B2_BUCKET_NAME": "WebPlantBucket"} |
| RESEND_API_KEY | No | - | Used to send emails |
| DEFAULT_FROM_EMAIL | No | 'email@example.com' | Email used to send emails |
| GOOGLE_CLIENT_ID | No | - | Google Oauth (Google login) |
| GOOGLE_SECRET | No | - | Google Oauth (Google login) |
| SENTRY_DSN | No | - | Error logging |



## Notes

- Only use environment variable `DJANGO_DEBUG='True'` for development/DEBUG mode (never in production)
- It is recommended to add `DJANGO_SECRET_KEY='shh-rand0m-value'` (If not present, server auto logs out all users if server restarts during file changes)
- Instructions folder (instructions/...): Files inside holds prompts to be used to guide AI agents (if necessary)





