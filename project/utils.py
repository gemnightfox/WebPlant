from workspace.utils import get_workspace
from .models import Project
from django.shortcuts import get_object_or_404



def get_project(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    get_workspace(request, workspace_id=project.workspace.id) # Verification purposes only (gives error if checks fail, eg. user not in workspace)
    return project




