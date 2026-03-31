from django.shortcuts import render, get_object_or_404
from workspace_role.models import WorkspaceRole
from .models import Workspace, WorkspaceUser, WorkspaceInviteCode
from .forms import CreateNewForm, EditNameForm, AddUsersForm, AssignRoleToUserForm, SetPreferenceForm, ChangeDefaultRoleForm, TransferOwnershipForm, AddInviteCodeForm, EditInviteCodePasswordForm
from django.views.decorators.http import require_POST
from django.http import JsonResponse, Http404
from notification.utils import send_email
from django.db import transaction
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from .utils import get_workspace, get_workspace_user, get_workspace_preference
from workspace_role.utils import verify_workspace_role
from base_utils import reusable_form_submission



@login_required
@require_POST
def create_new(request):
    return reusable_form_submission(request, CreateNewForm, current_user=request.user)



@login_required
@require_POST
def transfer_ownership(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    if my_workspace_user != workspace.owner:
        raise Http404('Current user is not the owner of the specified workspace.')
    return reusable_form_submission(request, TransferOwnershipForm, instance=workspace, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def set_preference(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    workspace_preference = get_workspace_preference(workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_workspace_preference')
    return reusable_form_submission(request, SetPreferenceForm, instance=workspace_preference)



@login_required
@require_POST
def change_default_role(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_assign_roles_to_users')
    return reusable_form_submission(request, ChangeDefaultRoleForm, instance=workspace)



@login_required
def check_invites(request):
    invited_workspaces = Workspace.objects.filter(users=request.user, workspace_user__is_active=False)[:100]
    payload = []
    for workspace in invited_workspaces:
        payload.append({
            'id': workspace.id,
            'name': workspace.name,
        })
    return JsonResponse({'invited_workspaces': payload})



@login_required
def check_invites_count(request):
    invited_workspaces = Workspace.objects.filter(users=request.user, workspace_user__is_active=False)
    return JsonResponse({'invite_count': invited_workspaces.count()})



@login_required
@require_POST
def accept_invite(request, workspace_id):
    my_workspace_user = get_object_or_404(WorkspaceUser, user=request.user, workspace__id=workspace_id, is_active=False)
    my_workspace_user.is_active = True
    my_workspace_user.save()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def reject_invite(request, workspace_id):
    workspace_user = get_object_or_404(WorkspaceUser, user=request.user, workspace__id=workspace_id, is_active=False)
    workspace_user.delete()
    return JsonResponse({'status': 'success'})



@login_required
def settings(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)

    all_workspace_users = WorkspaceUser.objects.filter(workspace=workspace)
    all_workspace_roles = WorkspaceRole.objects.filter(workspace=workspace)

    workspace_preference = get_workspace_preference(workspace)

    return render(request, 'workspace/settings/index.html', {
        'workspace': workspace,
        'my_workspace_user': my_workspace_user,

        'all_workspace_users': all_workspace_users,
        'all_workspace_roles': all_workspace_roles,

        'workspace_preference': workspace_preference,
        })



@login_required
@require_POST
def edit_name(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_workspace_name')
    return reusable_form_submission(request, EditNameForm, instance=workspace)



@login_required
@require_POST
def add_users(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_add_users')
    can_assign_roles_to_users = my_workspace_user.role.can_assign_roles_to_users
    return reusable_form_submission(request, AddUsersForm, workspace=workspace, my_user=request.user, can_assign_roles_to_users=can_assign_roles_to_users)



@login_required
@require_POST
def assign_role_to_user(request, workspace_id, user_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_assign_roles_to_users')

    user = get_object_or_404(get_user_model(), id=user_id)
    workspace_user = get_workspace_user(user, workspace, allow_false_is_active=True)

    return reusable_form_submission(request, AssignRoleToUserForm, instance=workspace_user)



@login_required
@require_POST
def remove_user(request, workspace_id, user_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)

    user = get_object_or_404(get_user_model(), id=user_id)
    workspace_user = get_workspace_user(user, workspace, allow_false_is_active=True)

    # Can safely delete the workspace if there is only ONE user inside
    if WorkspaceUser.objects.filter(workspace=workspace, is_active=True).count() == 1:
        workspace.delete()
        content = f'You have left workspace: {workspace.name}'
        send_email(receiver=user, sender=request.user, content=content)
        return JsonResponse({'status': 'success'})

    elif workspace_user == workspace.owner:
        raise Exception('Owner has to transfer ownership before leaving.')

    # Users can leave the workspace, no perms required
    if user != request.user:
        verify_workspace_role(my_workspace_user, 'can_remove_users')

    with transaction.atomic():
        workspace_user.delete()
        if user == request.user:
            content = f'You have left workspace: {workspace.name}'
        else:
            content = f'You have been removed from the workspace: {workspace.name}'

        send_email(receiver=user, sender=request.user, content=content)
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def join_using_invite_code(request):
    invite_code = request.POST.get('invite_code')
    password = request.POST.get('password')

    workspace_invite_code = get_object_or_404(WorkspaceInviteCode, invite_code=invite_code)
    if workspace_invite_code.password and workspace_invite_code.password != password:
        raise Exception('Password is incorrect.')
    
    workspace = workspace_invite_code.workspace
    my_workspace_user = WorkspaceUser.objects.filter(workspace=workspace, user=request.user).first()

    if my_workspace_user:
        if my_workspace_user.is_active:
            return JsonResponse({'status': 'error'})
        else:
            my_workspace_user.is_active = True
            my_workspace_user.save()
            return JsonResponse({'status': 'success', 'workspace_name': workspace.name})

    WorkspaceUser.objects.create(
        workspace=workspace,
        user=request.user,
        role=workspace.default_role,
        is_active=True,
    )
    return JsonResponse({'status': 'success', 'workspace_name': workspace.name})



@login_required
@require_POST
def add_invite_code(request, workspace_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_invite_codes')
    return reusable_form_submission(request, AddInviteCodeForm, workspace=workspace)



@login_required
@require_POST
def edit_invite_code_password(request, workspace_id, workspace_invite_code_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_invite_codes')
    workspace_invite_code = WorkspaceInviteCode(id=workspace_invite_code_id, workspace=workspace)
    return reusable_form_submission(request, EditInviteCodePasswordForm, instance=workspace_invite_code)



@login_required
@require_POST
def delete_invite_code(request, workspace_id, workspace_invite_code_id):
    workspace = get_workspace(request, workspace_id)
    my_workspace_user = get_workspace_user(request.user, workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_invite_codes')
    workspace_invite_code = WorkspaceInviteCode(id=workspace_invite_code_id, workspace=workspace)
    workspace_invite_code.delete()
    return JsonResponse({'status': 'success'})







