from django.shortcuts import get_object_or_404
from .models import Group
from workspace.utils import get_workspace



def get_group(request, group_id):
    group = get_object_or_404(Group, id=group_id)
    get_workspace(request, workspace_id=group.project.workspace.id) # Verification purposes only (gives error if checks fail, eg. user not in workspace)
    return group



def duplicate_group_only(group, my_workspace_user, project_changed_to=None, position_changed_to=None, is_name_changed=False): # Doesn't bring over tasks inside (done by other functions)
    group.id = None

    if project_changed_to:
        group.project = project_changed_to
    
    if position_changed_to:
        group.position = position_changed_to

    if is_name_changed:
        name_max_length = group._meta.get_field('name').max_length
        new_name = f'(copy) {group.name}'
        new_name = new_name[:name_max_length] # Ensures max_length is not exceeded
        group.name = new_name

    group.save(workspace_user=my_workspace_user)
    return group





