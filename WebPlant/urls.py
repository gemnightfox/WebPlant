from django.contrib import admin
from django.urls import path, include
from .settings import get_env

def trigger_error(request):
    return 1/0

URL_SECRET = get_env('URL_SECRET') # Prevents users in production from going to a private/admin-only URL (eg. /admin/)

if URL_SECRET:
    urlpatterns = [
        path(f'admin/{URL_SECRET}/', admin.site.urls),
        path(f'trigger-error/{URL_SECRET}/', trigger_error),
    ]
else:
    urlpatterns = [
        path('admin/', admin.site.urls),
        path('trigger-error/', trigger_error),
    ]

urlpatterns += [
    path('', include('home.urls')),
    path('feedback/', include('feedback.urls')),
    path('account/', include('accounts.urls')), # Adds onto Django Allauth URLs (eg. account dashboard)
    path('account/', include('allauth.urls')),
    path('notification/', include('notification.urls')),
    path('workspace/', include('workspace.urls')),
    path('workspace-role/', include('workspace_role.urls')),
    path('project/', include('project.urls')),
    path('group/', include('group.urls')),
    path('task/', include('task.urls')),
]







