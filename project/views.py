from .utils import get_project
from .forms import CreateNewForm, EditNameForm
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission
from workspace.utils import get_workspace, get_workspace_user, verify_workspace_role
from .models import Project
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
    return reusable_form_submission(request, CreateNewForm, workspace=workspace)



@login_required
@require_POST
def edit_name(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    return reusable_form_submission(request, EditNameForm, instance=project)



@login_required
@require_POST
def delete(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    project.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, project_id):
    project = get_project(request, project_id)
    my_workspace_user = get_workspace_user(request.user, workspace=project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_projects')
    verify_workspace_role(my_workspace_user, 'can_edit_groups')
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')

    groups = Group.objects.filter(project=project)
    name_max_length = project._meta.get_field('name').max_length
    new_name = f'(copy) {project.name}'
    new_name = new_name[:name_max_length] # Ensures max_length is not exceeded

    project.id = None
    project.name = new_name
    project.save()

    for group in groups:
        tasks = Task.objects.filter(group=group)
        group.id = None
        group.project = project
        group.save()
        
        for task in tasks:
            task.id = None
            task.group = group
            task.save()
    return JsonResponse({'status': 'success'})



