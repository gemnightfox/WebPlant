from django.db import models, transaction
import uuid
from workspace.models import WorkspaceUser, WorkspaceLog
from group.models import Group
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from workspace.utils import save_changes_to_model_logs



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

    def save(self, workspace_user=None, *args, **kwargs): # Avoid setting workspace_user=None during .save()
        if self._state.adding:
            old_object = None
        else:
            old_object = get_object_or_404(Task, id=self.id)

        with transaction.atomic():
            save_changes_to_model_logs(new_object=self, workspace_user=workspace_user, old_object=old_object, IGNORED_FIELDS=['position'])
            super().save(*args, **kwargs)

    def delete(self, workspace_user=None, *args, **kwargs): # Avoid setting workspace_user=None during .save()
        with transaction.atomic():
            if workspace_user:
                changes = model_to_dict(self)
                changes['id'] = self.id
                WorkspaceLog.objects.create(
                    workspace=workspace_user.workspace,
                    workspace_user=workspace_user,
                    change_type=WorkspaceLog.ChangeTypeChoices.DELETE,
                    changes=changes,
                    content_object=self,
                )

            workspace_logs = WorkspaceLog.objects.filter(content_object=self)
            workspace_logs.update(object_id=None) # Deletes reference to object, while keeping reference to model (content_type)
            super().delete(*args, **kwargs)



class TaskAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='task/')
    created_at = models.DateTimeField(auto_now_add=True)



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




