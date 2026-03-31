from .utils import get_task
from group.utils import get_group
from django.http import JsonResponse
from .forms import CreateNewForm, EditForm, AddCommentForm, EditCommentForm, AddReminderForm
from .models import TaskComment, TaskReminder
from django.shortcuts import get_object_or_404
from workspace.utils import get_workspace_user
from workspace_role.utils import verify_workspace_role
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission
from django.contrib.auth.decorators import login_required



@login_required
@require_POST
def create_new(request, group_id):
    group = get_group(request, group_id)
    my_workspace_user = get_workspace_user(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    return reusable_form_submission(request, CreateNewForm, group=group)



@login_required
@require_POST
def edit(request, task_id):
    task = get_task(request, task_id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    return reusable_form_submission(request, EditForm, instance=task)



@login_required
@require_POST
def delete(request, task_id):
    task = get_task(request, task_id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    task.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, task_id, position):
    task = get_task(request, task_id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')

    name_max_length = task._meta.get_field('name').max_length
    new_name = f'(copy) {task.name}'
    new_name = new_name[:name_max_length] # Ensures max_length is not exceeded
    new_position = float(position)

    task.id = None
    task.name = new_name
    task.position = new_position
    task.save()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def add_comment(request, task_id):
    task = get_task(request, task_id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    return reusable_form_submission(request, AddCommentForm, task=task, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit_comment(request, task_comment_id):
    task_comment = get_object_or_404(TaskComment, id=task_comment_id)
    task = get_task(request, task_comment.task.id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)

    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    workspace = task.group.project.workspace
    if my_workspace_user != workspace.owner and my_workspace_user != task_comment.added_by:
        raise Exception('User can not edit comment.')
    return reusable_form_submission(request, EditCommentForm, instance=task_comment)



@login_required
@require_POST
def delete_comment(request, task_comment_id):
    task_comment = get_object_or_404(TaskComment, id=task_comment_id)
    task = get_task(request, task_comment.task.id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)

    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    workspace = task.group.project.workspace
    if my_workspace_user != workspace.owner and my_workspace_user != task_comment.added_by:
        raise Exception('User can not delete comment.')

    task_comment.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def add_reminder(request, task_id):
    task = get_task(request, task_id)
    my_workspace_user = get_workspace_user(request.user, workspace=task.group.project.workspace)
    return reusable_form_submission(request, AddReminderForm, task=task, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete_reminder(request, task_reminder_id):
    task_reminder = get_object_or_404(TaskReminder, id=task_reminder_id)
    task = get_task(request, task_reminder.task.id)
    workspace = task.group.project.workspace

    my_workspace_user = get_workspace_user(request.user, workspace=workspace)
    if my_workspace_user != task_reminder.workspace_user:
        raise Exception('User can not delete reminder.')

    task_reminder.delete()
    return JsonResponse({'status': 'success'})





