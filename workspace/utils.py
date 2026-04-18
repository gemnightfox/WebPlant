from django.shortcuts import get_object_or_404
from .models import Workspace, WorkspaceUser, WorkspacePreference, WorkspaceRole, WorkspaceLog
import random
from django.http import Http404
from django.db import models
from django.forms.models import model_to_dict



def get_workspace(request, workspace_id):
    return get_object_or_404(Workspace, users=request.user, id=workspace_id, workspace_user__is_active=True)



def get_workspace_user(user, workspace, allow_false_is_active=False):
    if allow_false_is_active:
        return get_object_or_404(WorkspaceUser, workspace=workspace, user=user)
    else:
        return get_object_or_404(WorkspaceUser, workspace=workspace, user=user, is_active=True)



def get_workspace_preference(workspace):
    workspace_preference, _ = WorkspacePreference.objects.get_or_create(workspace=workspace)
    return workspace_preference



def generate_workspace_invite_code():
    ALLOWED_CHARACTERS = 'ACDEFHJKMNPQRTUVWXY3479'
    list_of_random_characters = random.choices(ALLOWED_CHARACTERS, k=16)
    return ''.join(list_of_random_characters)



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



def get_fields_being_edited(new_object, old_object) -> dict:
    old_object_dict = model_to_dict(old_object)
    new_object_dict = model_to_dict(new_object)

    edited_fields = {}
    for field_name in new_object_dict:
        old_value = old_object_dict[field_name]
        new_value = new_object_dict[field_name]

        if old_value != new_value:
            edited_fields[field_name] = new_value
    return edited_fields



def save_changes_to_model_logs(new_object, workspace_user, old_object=None, IGNORED_FIELDS=None):
    if not workspace_user: # Occurs in default Django admin page edits (default save method does not include workspace_user argument)
        print('ALERT: WorkspaceLog object has been created without a workspace_user argument. If this is from project/group/task models, please add a workspace_user argument during .save() or .delete()')
        return

    if new_object._state.adding:
        changes = model_to_dict(new_object)
        changes['id'] = str(new_object.id)
        WorkspaceLog.objects.create(
            workspace=workspace_user.workspace,
            workspace_user=workspace_user,
            change_type=WorkspaceLog.ChangeTypeChoices.CREATE,
            changes=changes,
            content_object=new_object,
            )

    else:
        changes = get_fields_being_edited(new_object=new_object, old_object=old_object) # Returns a dictionary
        changes['id'] = str(new_object.id)
        if IGNORED_FIELDS:
            for field in IGNORED_FIELDS:
                changes.pop(field, None)

        WorkspaceLog.objects.create(
            workspace=workspace_user.workspace,
            workspace_user=workspace_user,
            change_type=WorkspaceLog.ChangeTypeChoices.EDIT,
            changes=changes,
            content_object=new_object,
        )






