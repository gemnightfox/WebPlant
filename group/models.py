from django.db import models, transaction
import uuid
from project.models import Project
from workspace.models import WorkspaceLog
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from workspace.utils import save_changes_to_model_logs



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

    def save(self, workspace_user=None, *args, **kwargs): # Avoid setting workspace_user=None during .save()
        if self._state.adding:
            old_object = None
        else:
            old_object = get_object_or_404(Group, id=self.id)

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





