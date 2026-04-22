from workspace.models import Workspace



def workspaces(request):
    if not request.user.is_authenticated:
        return {}

    workspaces = Workspace.objects.filter(users=request.user, workspace_user__is_active=True)
    workspaces = workspaces.prefetch_related('projects') # Prevents N+1 problem
    return {'workspaces': workspaces}



