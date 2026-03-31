from .models import UserPreference
from django.db import models
from workspace.models import WorkspaceUser
from workspace_role.models import WorkspaceRole



def get_preferences(user):
    user_preferences, _ = UserPreference.objects.get_or_create(user=user)
    return user_preferences



def transfer_workspace_ownership_to_successor(owner, workspace):
    if workspace.owner != owner:
        return

    if workspace.users.count() == 1:
        workspace.delete()
        return

    workspace_roles = WorkspaceRole.objects.filter(workspace=workspace)
    highest_roles = [] # Example: [Role(can_add_users=False, can_remove_users=True), Role(can_add_users=True, can_remove_users=False)]
    highest_count = 0

    for role in workspace_roles:
        # This is the amount of True that is in each WorkspaceRole permission fields (can_...)
        # Example: Role(can_add_users=True, can_remove_users=False), count = 1
        # Example: Role(can_add_users=True, can_remove_users=True), count = 2
        count = sum(
            getattr(role, field.name)
            for field in role._meta.concrete_fields
            if isinstance(field, models.BooleanField)
        )

        if count == highest_count:
            highest_roles.append(role)

        elif count > highest_count:
            highest_count = count
            highest_roles = [] # Removes everything from the list
            highest_roles.append(role)
    
    successor = WorkspaceUser.objects.filter(workspace=workspace, role__in=highest_roles).exclude(user=owner).order_by('joined_at').first()
    workspace.owner = successor
    workspace.save()



