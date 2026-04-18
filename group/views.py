from project.utils import get_project
from task.models import Task
from task.utils import duplicate_task_only
from .forms import CreateNewForm, EditForm
from django.http import JsonResponse
from .utils import get_group, duplicate_group_only
from django.db import transaction
from workspace.utils import get_workspace_user, verify_workspace_role
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission
from django.contrib.auth.decorators import login_required



@login_required
@require_POST
def create_new(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    return reusable_form_submission(request, CreateNewForm, project=project, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit(request, group_id):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    return reusable_form_submission(request, EditForm, instance=group, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete(request, group_id):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    group.delete(workspace_user=my_workspace_user)
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, group_id, position):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')

    new_group_position = float(position)
    with transaction.atomic():
        tasks = Task.objects.prefetch_related('tasks__attachments').filter(group=group)
        new_group = duplicate_group_only(group, my_workspace_user=my_workspace_user, position_changed_to=new_group_position, is_name_changed=True)

        for task in tasks:
            duplicate_task_only(task, my_workspace_user=my_workspace_user, group_changed_to=new_group)

    return JsonResponse({'status': 'success'})


