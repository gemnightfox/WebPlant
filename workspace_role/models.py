from django.db import models
import uuid



# After editing fields, update frontend templates + workspace.forms.CreateNewForm.save()
class WorkspaceRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE, related_name='roles')
    name = models.CharField(max_length=100)

    can_edit_workspace_name = models.BooleanField()
    can_edit_workspace_preference = models.BooleanField()
    can_edit_workspace_invite_codes = models.BooleanField()

    can_add_workspace_users = models.BooleanField()
    can_assign_roles_to_workspace_users = models.BooleanField()
    can_remove_workspace_users = models.BooleanField()
    can_edit_workspace_roles = models.BooleanField()

    can_edit_projects = models.BooleanField()
    can_edit_groups = models.BooleanField()
    can_edit_tasks = models.BooleanField()

    can_add_task_comments = models.BooleanField()
    can_edit_task_deadline = models.BooleanField()

    def __str__(self):
        return f'{self.name} - {self.workspace.name}'
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'name'], name='unique_workspace_role'),
        ]





