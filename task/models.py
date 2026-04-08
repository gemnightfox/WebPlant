from django.db import models
import uuid
from workspace.models import WorkspaceUser
from group.models import Group



class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=3000)

    is_completed = models.BooleanField(default=False)
    position = models.FloatField()
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

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








