from django.db import models
import uuid
from project.models import Project



class Group(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='groups')
    name = models.CharField(max_length=300)

    position = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(fields=['project', 'position'], name='unique_group_position'),
        ]





