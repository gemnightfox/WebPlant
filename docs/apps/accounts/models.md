## CustomUserManager
- Used by CustomUser model
- Create superuser (`python manage.py createsuperuser`) required fields: email, username, password
- Normal create user fields: email (required), username (required), password (optional)



## CustomUser
- Extends from Django default AbstractUser (overrides User model)
- Username only allows certain characters (a-z, 0-9, _)



## UserPreference
- Stores user settings (eg. color theme, timezone)




