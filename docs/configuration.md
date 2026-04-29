# Environment Variables
> In production (DEBUG=False), ALL environment variables (excluding DJANGO_DEBUG) are required (default value is not allowed/used)
| Variable | Required (DEBUG/development mode) | Default (DEBUG/development only) | Notes |
| --- | --- | --- | --- |
| DJANGO_DEBUG | Yes (set as 'True') | 'False' | Do NOT use in production (only use in DEBUG mode) |
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


