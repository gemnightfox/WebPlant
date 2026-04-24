from workspace.utils import get_workspace_or_404
from .models import Project
from django.shortcuts import get_object_or_404



def get_project_or_404(my_user, project_id):
    project = get_object_or_404(Project, id=project_id)
    get_workspace_or_404(my_user=my_user, workspace_id=project.workspace.id) # Verification purposes only (gives error if checks fail, eg. user not in workspace)
    return project



def duplicate_project_only(project, my_workspace_user, is_name_changed=False): # Doesn't bring over groups/tasks inside (done by other functions)
    project.id = None
    project._state.adding = True

    if is_name_changed:
        name_max_length = project._meta.get_field('name').max_length
        new_name = f'(copy) {project.name}'
        new_name = new_name[:name_max_length] # Ensures max_length is not exceeded
        project.name = new_name

    project.save(workspace_user=my_workspace_user)
    return project




