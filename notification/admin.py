from django.contrib import admin
from .models import Notification, NotificationDisabledDuration



admin.site.register(Notification)
admin.site.register(NotificationDisabledDuration)


