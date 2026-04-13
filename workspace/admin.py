from django.contrib import admin
from .models import WorkspaceUser, Workspace, WorkspacePreference, WorkspaceRole



admin.site.register(WorkspaceUser)
admin.site.register(Workspace)
admin.site.register(WorkspacePreference)
admin.site.register(WorkspaceRole)



