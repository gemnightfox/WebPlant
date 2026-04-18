from django.db import models
from django.conf import settings
import uuid
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder



class WorkspaceUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE, related_name='workspace_user')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey('workspace.WorkspaceRole', on_delete=models.RESTRICT) # Can not delete role object if any WorkspaceUser objects are linked to it (transfer user's role before deleting role)

    is_active = models.BooleanField(default=False) # False = invited but not yet accepted/rejected, set to True when user accepts the invite, object is deleted if user rejects invite
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'user'], name='unique_workspace_user'),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.role}'



class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=300)
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, through=WorkspaceUser, through_fields=('workspace', 'user'))
    owner = models.ForeignKey(WorkspaceUser, on_delete=models.RESTRICT, null=True, related_name='+') # Blocks workspace deletion if user leaves workspace (transfer ownership before leaving, null=True is only for workspace creation)
    default_role = models.ForeignKey('workspace.WorkspaceRole', on_delete=models.RESTRICT, null=True, related_name='+') # null=True is only for workspace creation

    def __str__(self):
        return self.name



class WorkspaceInviteCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    invite_code = models.CharField(max_length=30, unique=True)
    password = models.CharField(max_length=128, null=True, blank=True) # Note: This is unhashed, treat as unsecure



class WorkspacePreference(models.Model):
    class PreferenceChoices(models.TextChoices):
        DISABLED = 'disabled', 'Disabled'
        SIMPLE = 'simple', 'Simple'
        COMPLEX = 'complex', 'Complex'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE)
    custom_roles = models.CharField(max_length=20, choices=PreferenceChoices.choices, default=PreferenceChoices.DISABLED)



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

    can_edit_task_attachments = models.BooleanField()
    can_add_task_comments = models.BooleanField()
    can_edit_task_deadline = models.BooleanField()

    def __str__(self):
        return f'{self.name} - {self.workspace.name}'
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'name'], name='unique_workspace_role'),
        ]



# Stores the whole history for all projects/groups/tasks in the specified workspace
class WorkspaceLog(models.Model):
    class ChangeTypeChoices(models.TextChoices):
        CREATE = 'create', 'Create'
        EDIT = 'edit', 'Edit'
        DELETE = 'delete', 'Delete'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE)
    workspace_user = models.ForeignKey('workspace.WorkspaceUser', on_delete=models.SET_NULL, null=True)
    change_type = models.CharField(max_length=10, choices=ChangeTypeChoices.choices)
    changes = models.JSONField(default=dict, encoder=DjangoJSONEncoder)

    # References to either Project/Group/Task app models
    content_type = models.ForeignKey(ContentType, on_delete=models.DO_NOTHING, limit_choices_to={'app_label__in': ['project', 'group', 'task']})
    object_id =  models.UUIDField(null=True) # This is not the PK of WorkspaceLog model (PK of referenced obj)
    content_object = GenericForeignKey('content_type', 'object_id')

    def save(self, *args, **kwargs):
        if self._state.adding and self.workspace_user and self.workspace != self.workspace_user.workspace:
            raise ValidationError('Workspace and workspace_user.workspace must be the same during creation')
        super().save(*args, **kwargs)



