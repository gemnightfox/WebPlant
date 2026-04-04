from django.db import models
from django.conf import settings
from django.db.models.functions import Lower
import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager



class CustomUserManager(BaseUserManager):
    def create_superuser(self, email, password, **extra_fields):
        extra_fields['is_staff'] = True
        extra_fields['is_superuser'] = True
        return self.create_user(email, password, **extra_fields)

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user



class CustomUser(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = [] # Extra fields prompted when creating superusers (python manage.py createsuperuser)
    objects = CustomUserManager()
    
    class Meta:
        constraints = [
            models.UniqueConstraint(Lower('email'), name='unique_email_ci')
        ]



class UserPreference(models.Model):
    COLOR_THEMES = [
        ('light', 'Light'),
        ('dark', 'dark'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    color_theme = models.CharField(max_length=10, choices=COLOR_THEMES, default='dark') # Used in accounts.context_processors (used in html body class)
    send_notifications = models.BooleanField(default=True) # Server is not allowed to send email notifications to user if disabled
    workspace_invites = models.BooleanField(default=True)

    def __str__(self):
        return self.user.email







