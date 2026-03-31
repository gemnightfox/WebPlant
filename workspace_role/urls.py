from django.urls import path
from .views import create, edit, delete, transfer

app_name = 'workspace_role'

urlpatterns = [
    path('create/<uuid:workspace_id>/', create, name='create'),
    path('edit/<uuid:workspace_id>/<uuid:workspace_role_id>/', edit, name='edit'),
    path('delete/<uuid:workspace_id>/<uuid:workspace_role_id>/', delete, name='delete'),
    path('transfer/<uuid:workspace_id>/<uuid:old_workspace_role_id>/<uuid:new_workspace_role_id>/', transfer, name='transfer'),
]



