from django.db import models
from django.conf import settings
import uuid



class Feedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL) # Prevents object deletion during account removal
    content = models.CharField(max_length=9000)
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content[:300]





