from project.utils import get_project
from task.models import Task
from .forms import CreateNewForm, EditForm
from django.http import JsonResponse
from .utils import get_group
from workspace.utils import get_workspace_user
from workspace_role.utils import verify_workspace_role
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission
from django.contrib.auth.decorators import login_required



@login_required
@require_POST
def create_new(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    return reusable_form_submission(request, CreateNewForm, project=project)



@login_required
@require_POST
def edit(request, group_id):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    return reusable_form_submission(request, EditForm, instance=group)



@login_required
@require_POST
def delete(request, group_id):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    group.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, group_id, position):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')

    name_max_length = group._meta.get_field('name').max_length
    new_name = f'(copy) {group.name}'
    new_name = new_name[:name_max_length] # Ensures max_length is not exceeded
    new_position = float(position)

    tasks = Task.objects.filter(group=group)
    group.id = None
    group.name = new_name
    group.position = new_position
    group.save()

    for task in tasks:
        task.id = None
        task.group = group
        task.save()
    return JsonResponse({'status': 'success'})


