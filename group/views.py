from project.utils import get_project_or_404
from task.models import Task
from task.utils import duplicate_task_only
from .forms import CreateNewForm, EditForm
from django.http import JsonResponse
from .utils import get_group_or_404, duplicate_group_only
from django.db import transaction
from workspace.utils import get_workspace_user_or_404, verify_workspace_role
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission
from base_utils import custom_model_to_dict
from django.contrib.auth.decorators import login_required



@login_required
def get_data(request, group_id):
    group = get_group_or_404(my_user=request.user, group_id=group_id) # Note: Can't access task objects (look inside their respective get_data views)
    group = custom_model_to_dict(group)
    return JsonResponse({'group': group})



@login_required
@require_POST
def create_new(request, project_id):
    project = get_project_or_404(my_user=request.user, project_id=project_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    return reusable_form_submission(request, CreateNewForm, project=project, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit(request, group_id):
    group = get_group_or_404(my_user=request.user, group_id=group_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    return reusable_form_submission(request, EditForm, instance=group, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete(request, group_id):
    group = get_group_or_404(my_user=request.user, group_id=group_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    group.delete(workspace_user=my_workspace_user)
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, group_id, position):
    group = get_group_or_404(my_user=request.user, group_id=group_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')

    new_group_position = float(position)
    with transaction.atomic():
        tasks = Task.objects.prefetch_related('attachments').filter(group=group)
        new_group = duplicate_group_only(group, my_workspace_user=my_workspace_user, position_changed_to=new_group_position, is_name_changed=True)

        for task in tasks:
            duplicate_task_only(task, my_workspace_user=my_workspace_user, group_changed_to=new_group)

    return JsonResponse({'status': 'success'})


