from django.db import models, transaction
from django.shortcuts import get_object_or_404
from workspace.models import WorkspaceLog
from django.forms.models import model_to_dict
from workspace.utils import save_changes_to_model_logs
import uuid



class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=300)

    def save(self, workspace_user=None, *args, **kwargs): # Avoid setting workspace_user=None during .save()
        if self._state.adding:
            old_object = None
        else:
            old_object = get_object_or_404(Project, id=self.id)

        with transaction.atomic():
            save_changes_to_model_logs(new_object=self, workspace_user=workspace_user, old_object=old_object)
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




