from django.http import Http404
from .models import WorkspaceRole
from django.shortcuts import get_object_or_404
from django.db import models



def get_workspace_role(workspace, workspace_role_id):
    return get_object_or_404(WorkspaceRole, workspace=workspace, id=workspace_role_id)



def verify_workspace_role(my_workspace_user, permission_field_name: str): # permission_field_name is something like: 'can_add_workspace_users'
    if my_workspace_user == my_workspace_user.workspace.owner: # If current user is the owner, skip the rest of the checks (owner has unrestricted access to workspace)
        return

    is_allowed = getattr(my_workspace_user.role, permission_field_name)
    if not is_allowed:
        raise Http404('The current workspace role you have does not have permission to access this resource.')



def get_lowest_level_workspace_role(workspace):
    workspace_roles = WorkspaceRole.objects.filter(workspace=workspace)
    lowest_role_ids = []
    lowest_count = -1

    for role in workspace_roles:
        # This is the amount of True that is in each WorkspaceRole permission fields (can_...)
        # Example: Role(can_add_workspace_users=True, can_remove_workspace_users=False), count = 1
        # Example: Role(can_add_workspace_users=False, can_remove_workspace_users=False), count = 0
        count = sum(
            getattr(role, field.name)
            for field in role._meta.concrete_fields
            if isinstance(field, models.BooleanField)
        )

        if count == lowest_count:
            lowest_role_ids.append(role.id)

        elif count == -1 or count < lowest_count:
            lowest_count = count
            lowest_role_ids = [] # Removes everything from the list
            lowest_role_ids.append(role.id)

    lowest_role = WorkspaceRole.objects.filter(workspace=workspace, id__in=lowest_role_ids).first()
    return lowest_role


