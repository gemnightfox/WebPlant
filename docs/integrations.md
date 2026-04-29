## Django allauth + Google Oauth (django allauth socialaccount)
- Email and email verification is mandatory during account signup
- Changing of email is allowed
- Local and Google account will link together if email is the same
- User can login via an email code
- Note: Custom User model used at accounts.models.CustomUser



## Django anymail (Resend)
- Uses Resend to send emails online



## Sentry SDK
- Logs any errors into Sentry



## Cloudinary + django-cloudinary-storage
- Cloud storage for media files (not only images)
- Cloudinary media objects deleted during local object deletion (task.signals.delete_cloudinary_file)
- Note: CloudinaryField used in task.models.TaskAttachment.file (does not work without Cloudinary)



## Redis + django-redis
- Used for multiple settings: cache + ratelimit + channels



## Channels + channels-redis + daphne (websocket)
- Allows real-time collaboration syncing in frontend (project dashboard) during teammate edits



## Boto3 (Backblaze B2) + django-storages + django-dbbackup
- Used to backup storages (`python manage.py dbbackup --compress` and `python manage.py mediabackup --compress`)
- In production, a CRON job should be setup to automatically run this regularly
- Note: Saves to local file system (db_backups/ folder) if no B2 (Backblaze) environment variable



## Whitenoise
- Serves static files




