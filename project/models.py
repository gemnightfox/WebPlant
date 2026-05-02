from django.db import models, transaction
from django.shortcuts import get_object_or_404
from workspace.models import WorkspaceLog
from django.forms.models import model_to_dict
from workspace.utils import save_changes_to_workspace_logs
import uuid
from django.contrib.contenttypes.models import ContentType



class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=300)

    def save(self, workspace_user=None, *args, **kwargs): # Don't set workspace_user=None during .save()
        with transaction.atomic():
            is_new_object = self._state.adding
            if is_new_object:
                old_object = None
            else:
                old_object = get_object_or_404(Project, id=self.id)

            super().save(*args, **kwargs)
            save_changes_to_workspace_logs(new_object=self, is_new_object=is_new_object, workspace_user=workspace_user, old_object=old_object)

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


