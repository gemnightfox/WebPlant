from django.http import JsonResponse
from workspace.models import WorkspaceUser
from .forms import CreateForm, EditForm
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.db import transaction
from workspace.utils import get_workspace, get_workspace_user
from .utils import verify_workspace_role, get_workspace_role, get_lowest_level_workspace_role
from base_utils import reusable_form_submission



@login_required
@require_POST
def create(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_workspace_roles')
    return reusable_form_submission(request, CreateForm, workspace=workspace)



@login_required
@require_POST
def edit(request, workspace_id, workspace_role_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_workspace_roles')
    
    workspace_role = get_workspace_role(workspace, workspace_role_id)
    return reusable_form_submission(request, EditForm, instance=workspace_role)



@login_required
@require_POST
def delete(request, workspace_id, workspace_role_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_workspace_roles')
    
    workspace_role = get_workspace_role(workspace, workspace_role_id)
    if WorkspaceUser.objects.filter(role=workspace_role).count() > 0:
        raise ValueError('This role is currently assigned to a user. Assign them a different role before deleting this role.')
    if workspace_role == workspace.default_role:
        raise ValueError('Default role can not be deleted. Change default role to another role before deleting.')

    with transaction.atomic():
        workspace_role.delete()
        workspace.default_role = get_lowest_level_workspace_role(workspace)
        workspace.save()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def transfer(request, workspace_id, old_workspace_role_id, new_workspace_role_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_assign_roles_to_workspace_users')
    
    old_workspace_role = get_workspace_role(workspace, old_workspace_role_id)
    new_workspace_role = get_workspace_role(workspace, new_workspace_role_id)

    workspace_users = WorkspaceUser.objects.filter(role=old_workspace_role)
    workspace_users.update(role=new_workspace_role)
    return JsonResponse({'status': 'success'})



