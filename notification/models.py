from django.db import models
from django.conf import settings
import uuid



class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL) # Set to NULL if no 
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    content = models.CharField(max_length=9000)
    read_status = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now_add=True)



# How long to temporarily disable notifications (re-enabled after timer ends)
class NotificationDisabledDuration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notification_disabled_duration')
    ends_at = models.DateTimeField()

    def __str__(self):
        return f'{self.user.email} - {self.ends_at}'


