from django.shortcuts import get_object_or_404
from .models import Workspace, WorkspaceUser, WorkspaceRole, WorkspaceLog
from django.http import Http404
from django.forms.models import model_to_dict
from base_utils import model_to_dict



def get_workspace_or_404(my_user, workspace_id):
    return get_object_or_404(Workspace, users=my_user, id=workspace_id, workspace_user__is_active=True)



def get_workspace_user_or_404(user, workspace, allow_false_is_active=False):
    if allow_false_is_active:
        return get_object_or_404(WorkspaceUser, workspace=workspace, user=user)
    else:
        return get_object_or_404(WorkspaceUser, workspace=workspace, user=user, is_active=True)



def get_workspace_role_or_404(workspace, workspace_role_id):
    return get_object_or_404(WorkspaceRole, workspace=workspace, id=workspace_role_id)



def verify_workspace_role(my_workspace_user, permission_field_name: str): # permission_field_name is something like: 'can_add_workspace_users'
    if my_workspace_user == my_workspace_user.workspace.owner: # If current user is the owner, skip the rest of the checks (owner has unrestricted access to workspace)
        return

    is_allowed = getattr(my_workspace_user.role, permission_field_name)
    if not is_allowed:
        raise Http404('The current workspace role you have does not have permission to access this resource.')



def save_changes_to_workspace_logs(new_object, is_new_object: bool, workspace_user, old_object=None, IGNORED_FIELDS=None):
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

    if not workspace_user: # Occurs in default Django admin page edits (default save method does not include workspace_user argument)
        print('\n\nALERT: WorkspaceLog object has been created without a workspace_user argument. If this is from project/group/task models, please add a workspace_user argument during .save() or .delete().\n\n')
        return

    if is_new_object:
        WorkspaceLog.objects.create(
            workspace=workspace_user.workspace,
            workspace_user=workspace_user,
            change_type=WorkspaceLog.ChangeTypeChoices.CREATE,
            changes=model_to_dict(new_object),
            content_object=new_object,
            )
        return

    if not old_object:
        raise ValueError('old_object argument must be passed when editing (is_new_object=False) existing objects.')

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




