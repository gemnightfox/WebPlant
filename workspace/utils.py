from django.shortcuts import get_object_or_404
from .models import Workspace, WorkspaceUser, WorkspacePreference
import random



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
    ALLOWED_LETTERS = 'ACDEFHJKMNPQRTUVWXY3479'
    list_of_random_characters = random.choices(ALLOWED_LETTERS, k=16)
    return ''.join(list_of_random_characters)





