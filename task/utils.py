from django.shortcuts import get_object_or_404
from .models import Task
from workspace.utils import get_workspace
from django.db import transaction



def get_task(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    get_workspace(request, workspace_id=task.group.project.workspace.id) # Verification purposes only (gives error if checks fail, eg. user not in workspace)
    return task



def duplicate_task_only(task, my_workspace_user, group_changed_to=None, position_changed_to=None, is_name_changed=False): # Doesn't duplicate task comments or reminders
    with transaction.atomic():
        task.id = None

        if group_changed_to:
            task.group = group_changed_to
        
        if position_changed_to:
            task.position = position_changed_to

        if is_name_changed:
            name_max_length = task._meta.get_field('name').max_length
            new_name = f'(copy) {task.name}'
            new_name = new_name[:name_max_length] # Ensures max_length is not exceeded
            task.name = new_name

        task.save(workspace_user=my_workspace_user)

        for task_attachment in task.attachments.all():
            task_attachment.id = None
            task_attachment.task = task
            task_attachment.save()

    return task

