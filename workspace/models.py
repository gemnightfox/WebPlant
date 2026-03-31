from django.db import models
from django.conf import settings
import uuid



class WorkspaceUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE, related_name='workspace_user')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey('workspace_role.WorkspaceRole', on_delete=models.RESTRICT) # Can not delete role object if any WorkspaceUser objects are linked to it (transfer user's role before deleting role)

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
    default_role = models.ForeignKey('workspace_role.WorkspaceRole', on_delete=models.RESTRICT, null=True, related_name='+') # null=True is only for workspace creation

    def __str__(self):
        return self.name



class WorkspaceInviteCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    invite_code = models.CharField(max_length=30, unique=True)
    password = models.CharField(max_length=128, null=True, blank=True) # Note: This is unhashed, treat as unsecure



class WorkspacePreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE)
    custom_roles = models.BooleanField(default=False)




