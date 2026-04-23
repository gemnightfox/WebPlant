from .utils import get_task_or_404, duplicate_task_only
from group.utils import get_group_or_404
from django.http import JsonResponse
from .forms import CreateNewForm, EditForm, AddAttachmentForm, AddCommentForm, EditCommentForm, AddReminderForm, AddAssignedForm
from .models import Task, TaskAttachment, TaskComment, TaskReminder, TaskAssigned
from django.shortcuts import get_object_or_404, redirect
from workspace.utils import get_workspace_user_or_404, verify_workspace_role
from django.views.decorators.http import require_POST
from base_utils import reusable_form_submission, custom_model_to_dict
import cloudinary
import time
from django.contrib.auth.decorators import login_required



@login_required
def get_data(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    attachments = [custom_model_to_dict(attachment) for attachment in task.attachments.all()]
    comments = [custom_model_to_dict(comments) for comments in task.comments.all()]
    assigned = [custom_model_to_dict(assigned) for assigned in task.assigned_to.all()]

    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    reminders = [custom_model_to_dict(reminder) for reminder in task.reminders.all() if reminder.workspace_user == my_workspace_user]

    task = custom_model_to_dict(task)
    task['attachments'] = attachments
    task['comments'] = comments
    task['assigned'] = assigned
    task['reminders'] = reminders
    return JsonResponse({'task': task})



@login_required
@require_POST
def create_new(request, group_id):
    group = get_group_or_404(my_user=request.user, group_id=group_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    return reusable_form_submission(request, CreateNewForm, group=group, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    return reusable_form_submission(request, EditForm, instance=task, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    task.delete(workspace_user=my_workspace_user)
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def duplicate(request, task_id, position):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_tasks')

    task = Task.objects.prefetch_related('attachments', 'assigned_to').get(id=task.id) # Sole purpose is to avoid N+1 queries (found inside task.utils.duplicate_task_only task attachments for loop)
    new_position = float(position)
    duplicate_task_only(task, my_workspace_user=my_workspace_user, position_changed_to=new_position, is_name_changed=True)
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def add_attachment(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_task_attachments')
    return reusable_form_submission(request, AddAttachmentForm, task=task)



@login_required
@require_POST
def delete_attachment(request, task_attachment_id):
    task_attachment = get_object_or_404(TaskAttachment, id=task_attachment_id)
    task = get_task_or_404(my_user=request.user, task_id=task_attachment.task.id) # Used for verification as well
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_edit_task_attachments')
    task_attachment.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def attachment_media(request, task_attachment_id):
    task_attachment = get_object_or_404(TaskAttachment, id=task_attachment_id)
    get_task_or_404(my_user=request.user, task_id=task_attachment.task.id) # Used for verification purposes (user is inside workspace)

    file_name = task_attachment.file.name
    url = cloudinary.utils.private_download_url(
        file_name,
        format=file_name.split('.')[-1], # This returns 'png', 'exe', etc...
        expires_at=int(time.time()) + 3600, # 1 hour
    )
    return redirect(url)



@login_required
@require_POST
def add_comment(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_add_task_comments')
    return reusable_form_submission(request, AddCommentForm, task=task, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def edit_comment(request, task_comment_id):
    task_comment = get_object_or_404(TaskComment, id=task_comment_id)
    task = get_task_or_404(my_user=request.user, task_id=task_comment.task.id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)

    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    workspace = task.group.project.workspace
    if my_workspace_user != workspace.owner and my_workspace_user != task_comment.added_by:
        raise Exception('User can not edit comment.')
    return reusable_form_submission(request, EditCommentForm, instance=task_comment)



@login_required
@require_POST
def delete_comment(request, task_comment_id):
    task_comment = get_object_or_404(TaskComment, id=task_comment_id)
    task = get_task_or_404(my_user=request.user, task_id=task_comment.task.id) # Verification purposes as well
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)

    verify_workspace_role(my_workspace_user, 'can_edit_tasks')
    workspace = task.group.project.workspace
    if my_workspace_user != workspace.owner and my_workspace_user != task_comment.added_by:
        raise Exception('User can not delete comment.')

    task_comment.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def add_reminder(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    return reusable_form_submission(request, AddReminderForm, task=task, my_workspace_user=my_workspace_user)



@login_required
@require_POST
def delete_reminder(request, task_reminder_id):
    task_reminder = get_object_or_404(TaskReminder, id=task_reminder_id)
    task = get_task_or_404(my_user=request.user, task_id=task_reminder.task.id) # Verification purposes as well

    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    if my_workspace_user != task_reminder.workspace_user:
        raise Exception('User can not delete reminder.')

    task_reminder.delete()
    return JsonResponse({'status': 'success'})



@login_required
@require_POST
def add_assigned(request, task_id):
    task = get_task_or_404(my_user=request.user, task_id=task_id)
    return reusable_form_submission(request, AddAssignedForm, form_request=request, task=task)



@login_required
@require_POST
def delete_assigned(request, task_assigned_id):
    task_assigned = get_object_or_404(TaskAssigned, id=task_assigned_id)
    task = get_task_or_404(my_user=request.user, task_id=task_assigned.task.id) # Verification purposes
    my_workspace_user = get_workspace_user_or_404(request.user, workspace=task.group.project.workspace)
    verify_workspace_role(my_workspace_user, 'can_assign_tasks_to_users')
    task_assigned.delete()
    return JsonResponse({'status': 'success'})








