from django.db import models, transaction
import uuid
from project.models import Project
from workspace.models import WorkspaceLog
from base_utils import custom_model_to_dict
from django.shortcuts import get_object_or_404
from workspace.utils import save_changes_to_workspace_logs
from django.contrib.contenttypes.models import ContentType



class Group(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='groups')
    name = models.CharField(max_length=300)

    position = models.FloatField() # Group objects (in the same project) are ordered in ascending order
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(fields=['project', 'position'], name='unique_group_position'),
        ]

    def save(self, workspace_user=None, *args, **kwargs): # Don't set workspace_user=None during .save()
        with transaction.atomic():
            is_new_object = self._state.adding
            if is_new_object:
                old_object = None
            else:
                old_object = get_object_or_404(Group, id=self.id)

            super().save(*args, **kwargs)
            save_changes_to_workspace_logs(new_object=self, is_new_object=is_new_object, workspace_user=workspace_user, old_object=old_object, IGNORED_FIELDS=['position'])

    def delete(self, workspace_user=None, *args, **kwargs): # Don't set workspace_user=None during .delete()
        with transaction.atomic():
            if workspace_user:
                WorkspaceLog.objects.create(
                    workspace=workspace_user.workspace,
                    workspace_user=workspace_user,
                    change_type=WorkspaceLog.ChangeTypeChoices.DELETE,
                    changes=custom_model_to_dict(self),
                    content_object=self,
                )

            content_type = ContentType.objects.get_for_model(self)
            WorkspaceLog.objects.filter(content_type=content_type, object_id=self.id).update(object_id=None) # Deletes reference to object, while keeping reference to model (content_type)
            super().delete(*args, **kwargs)




