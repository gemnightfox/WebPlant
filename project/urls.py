from django.urls import path
from .views import dashboard, get_data, create_new, edit_name, delete, duplicate

app_name = 'project'

urlpatterns = [
    path('dashboard/<uuid:project_id>/', dashboard, name='dashboard'),
    path('get-data/<uuid:project_id>/', get_data, name='get_data'),
    path('create-new/<uuid:workspace_id>/', create_new, name='create_new'),
    path('edit-name/<uuid:project_id>/', edit_name, name='edit_name'),
    path('delete/<uuid:project_id>/', delete, name='delete'),
    path('duplicate/<uuid:project_id>/', duplicate, name='duplicate'),
]


