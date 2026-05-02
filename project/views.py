from .utils import get_project_or_404, duplicate_project_only
from group.utils import duplicate_group_only
from task.utils import duplicate_task_only
from .forms import CreateNewForm, EditNameForm
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission, CustomJsonResponse
from django.forms.models import model_to_dict
from workspace.utils import get_workspace_or_404, get_workspace_user_or_404, verify_workspace_role
from .models import Project
from django.db import transaction
from group.models import Group
from django.shortcuts import render
from django.contrib.auth.decorators import login_required



@login_required
def dashboard(request, project_id):
    project = Project.objects.prefetch_related('groups__tasks__attachments', 'groups__tasks__comments', 'groups__tasks__assigned_to').get(id=project_id)
    get_project_or_404(my_user=request.user, project_id=project.id) # Verification purposes
    return render(request, 'project/dashboard/index.html', {'project': project})



@login_required
def get_data(request, project_id):
    project = get_project_or_404(my_user=request.user, project_id=project_id) # Note: Can't access group/task objects (look inside their respective get_data views)
    project = model_to_dict(project)
    return CustomJsonResponse({'project': project})



@login_required
@require_POST
def create_new(request, workspace_id):
    workspace = get_workspace_or_404(my_user=request.user, workspace_id=workspace_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    return reusable_form_submission(request, CreateNewForm, workspace=workspace, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit_name(request, project_id):
    project = get_project_or_404(my_user=request.user, project_id=project_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    return reusable_form_submission(request, EditNameForm, instance=project, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete(request, project_id):
    project = get_project_or_404(my_user=request.user, project_id=project_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    project.delete(workspace_user=my_workspace_user)
    return CustomJsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, project_id):
    project = get_project_or_404(my_user=request.user, project_id=project_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=project.workspace)
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

    return CustomJsonResponse({'status': 'success'})



