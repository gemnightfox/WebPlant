from django.contrib import admin
from .models import WorkspaceUser, Workspace, WorkspaceRole



admin.site.register(WorkspaceUser)
admin.site.register(Workspace)
admin.site.register(WorkspaceRole)



