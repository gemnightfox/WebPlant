from django.urls import path
from .views import create_new, edit, delete, duplicate

app_name = 'group'

urlpatterns = [
    path('create-new/<uuid:project_id>/', create_new, name='create_new'),
    path('edit/<uuid:group_id>/', edit, name='edit'),
    path('delete/<uuid:group_id>/', delete, name='delete'),
    path('duplicate/<uuid:group_id>/<position>/', duplicate, name='duplicate'),
]



