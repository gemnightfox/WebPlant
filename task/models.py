from django.db import models
import uuid
from workspace.models import WorkspaceUser
from group.models import Group
from django.utils import timezone
from django.core.exceptions import ValidationError



class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=3000)

    is_completed = models.BooleanField(default=False)
    position = models.FloatField()
    deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.deadline and self.deadline <= timezone.localdate():
            raise ValidationError('Deadline must be in the future (or today).')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(fields=['group', 'position'], name='unique_task_position'),
        ]



class TaskComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    added_by = models.ForeignKey(WorkspaceUser, null=True, on_delete=models.SET_NULL)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    content = models.CharField(max_length=3000)



class TaskReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    workspace_user = models.ForeignKey('workspace.WorkspaceUser', on_delete=models.CASCADE)
    send_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if self.send_at < timezone.now():
            raise ValidationError('Value of send_at field must be in the future.')
        super().save(*args, **kwargs)






