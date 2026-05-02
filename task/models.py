from django.core.exceptions import ValidationError
from django.db import models, transaction
import uuid
from workspace.models import WorkspaceUser, WorkspaceLog
from group.models import Group
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from cloudinary.models import CloudinaryField
from django.contrib.contenttypes.models import ContentType
from workspace.utils import save_changes_to_workspace_logs



class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=3000)

    is_completed = models.BooleanField(default=False)
    position = models.FloatField() # Task objects (in the same group) are ordered in ascending order
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(fields=['group', 'position'], name='unique_task_position'),
        ]

    def save(self, workspace_user=None, *args, **kwargs): # Don't set workspace_user=None during .save()
        with transaction.atomic():
            is_new_object = self._state.adding
            if is_new_object:
                old_object = None
            else:
                old_object = get_object_or_404(Task, id=self.id)

            super().save(*args, **kwargs)
            save_changes_to_workspace_logs(new_object=self, is_new_object=is_new_object, workspace_user=workspace_user, old_object=old_object, IGNORED_FIELDS=['position'])

    def delete(self, workspace_user=None, *args, **kwargs): # Don't set workspace_user=None during .delete()
        with transaction.atomic():
            if workspace_user:
                WorkspaceLog.objects.create(
                    workspace=workspace_user.workspace,
                    workspace_user=workspace_user,
                    change_type=WorkspaceLog.ChangeTypeChoices.DELETE,
                    changes=model_to_dict(self),
                    content_object=self,
                )

            content_type = ContentType.objects.get_for_model(self)
            WorkspaceLog.objects.filter(content_type=content_type, object_id=self.id).update(object_id=None) # Deletes reference to object, while keeping reference to model (content_type)
            super().delete(*args, **kwargs)



class TaskAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    file = CloudinaryField(folder='tasks', resource_type='auto')
    created_at = models.DateTimeField(auto_now_add=True)



class TaskComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    added_by = models.ForeignKey(WorkspaceUser, null=True, on_delete=models.SET_NULL)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    content = models.CharField(max_length=3000)



class TaskReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='reminders')
    workspace_user = models.ForeignKey('workspace.WorkspaceUser', on_delete=models.CASCADE)
    send_at = models.DateTimeField()



class TaskAssigned(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assigned_to')
    assigned_to = models.ForeignKey('workspace.WorkspaceUser', on_delete=models.CASCADE)

    def save(self, *args, **kwargs):
        if self.task.group.project.workspace != self.assigned_to.workspace:
            raise ValidationError('The task.group.project.workspace must be the same as assigned_to.workspace')
        super().save(*args, **kwargs)




