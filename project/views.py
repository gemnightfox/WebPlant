from .utils import get_project, duplicate_project_only
from group.utils import duplicate_group_only
from task.utils import duplicate_task_only
from .forms import CreateNewForm, EditNameForm
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission
from workspace.utils import get_workspace, get_workspace_user, verify_workspace_role
from .models import Project
from django.db import transaction
from group.models import Group
from task.models import Task
from django.http import JsonResponse
from django.shortcuts import render
from django.contrib.auth.decorators import login_required



@login_required
def dashboard(request, project_id):
    project = Project.objects.prefetch_related('groups', 'groups__tasks').get(id=project_id) # Cant use get object (queryset needed)
    get_workspace(request, project.workspace.id) # Verification purposes (eg. user not in workspace)
    return render(request, 'project/dashboard/index.html', {'project': project})



@login_required
@require_POST
def create_new(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    return reusable_form_submission(request, CreateNewForm, workspace=workspace, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit_name(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    return reusable_form_submission(request, EditNameForm, instance=project, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    project.delete(workspace_user=my_workspace_user)
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')

    groups = Group.objects.prefetch_related('tasks__attachments').filter(project=project)
    with transaction.atomic():
        new_project = duplicate_project_only(project, my_workspace_user=my_workspace_user, is_name_changed=True)

        for group in groups:
            new_group = duplicate_group_only(group, my_workspace_user=my_workspace_user, project_changed_to=new_project)

            for task in group.tasks.all():
                duplicate_task_only(task, my_workspace_user=my_workspace_user, group_changed_to=new_group)

    return JsonResponse({'status': 'success'})



