from django.db import models
from django.conf import settings
from django.db.models.functions import Lower
import uuid
from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser, BaseUserManager



class CustomUserManager(BaseUserManager):
    def create_superuser(self, email, username, password, **extra_fields):
        extra_fields['is_staff'] = True
        extra_fields['is_superuser'] = True
        return self.create_user(email, username, password, **extra_fields)

    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user



class CustomUser(AbstractUser):
    def username_validator(username):
        ALLOWED_CHARACTERS = ''
        ALLOWED_CHARACTERS += 'abcdefghijklmnopqrstuvwxyz'
        ALLOWED_CHARACTERS += '1234567890'
        ALLOWED_CHARACTERS += '_'
        username = username.lower()
        for character in username:
            if character not in ALLOWED_CHARACTERS:
                raise ValidationError('Disallowed character used.')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, unique=True, validators=[username_validator])
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username'] # Extra fields prompted when creating superusers (python manage.py createsuperuser)
    objects = CustomUserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower('email'), name='unique_email_ci'),
            models.UniqueConstraint(Lower('username'), name='unique_username_ci'),
        ]

    def save(self, *args, **kwargs):
        if self.username:
            self.username = self.username.lower()
        super().save(*args, **kwargs)



class UserPreference(models.Model):
    COLOR_THEMES = [
        ('light', 'Light'),
        ('dark', 'dark'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    color_theme = models.CharField(max_length=10, choices=COLOR_THEMES, default='dark') # Used in accounts.context_processors (used in html body class)
    can_receive_notifications = models.BooleanField(default=True) # Server is not allowed to send email notifications to user if disabled
    allows_workspace_invites = models.BooleanField(default=True)
    timezone = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.user.email


