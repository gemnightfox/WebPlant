from django.shortcuts import get_object_or_404
from .models import Task
from workspace.utils import get_workspace



def get_task(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    get_workspace(request, workspace_id=task.group.project.workspace.id) # Verification purposes only (gives error if checks fail, eg. user not in workspace)
    return task




