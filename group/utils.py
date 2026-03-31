from django.shortcuts import get_object_or_404
from .models import Group
from workspace.utils import get_workspace



def get_group(request, group_id):
    group = get_object_or_404(Group, id=group_id)
    get_workspace(request, workspace_id=group.project.workspace.id) # Verification purposes only (gives error if checks fail, eg. user not in workspace)
    return group




