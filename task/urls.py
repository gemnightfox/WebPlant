from django.urls import path
from .views import create_new, edit, delete, duplicate
from .views import add_attachment, delete_attachment, attachment_media
from .views import add_comment, edit_comment, delete_comment
from .views import add_reminder, delete_reminder

app_name = 'task'

urlpatterns = [
    path('create-new/<uuid:group_id>/', create_new, name='create_new'),
    path('edit/<uuid:task_id>/', edit, name='edit'),
    path('delete/<uuid:task_id>/', delete, name='delete'),
    path('duplicate/<uuid:task_id>/<position>/', duplicate, name='duplicate'),

    path('attachment/add/<uuid:task_id>/', add_attachment, name='add_attachment'),
    path('attachment/delete/<uuid:task_attachment_id>/', delete_attachment, name='delete_attachment'),
    path('attachment/media/<uuid:task_attachment_id>/', attachment_media, name='attachment_media'),

    path('comment/add/<uuid:task_id>/', add_comment, name='add_comment'),
    path('comment/edit/<uuid:task_comment_id>/', edit_comment, name='edit_comment'),
    path('comment/delete/<uuid:task_comment_id>/', delete_comment, name='delete_comment'),

    path('reminder/add/<uuid:task_id>/', add_reminder, name='add_reminder'),
    path('reminder/delete/<uuid:task_reminder_id>/', delete_reminder, name='delete_reminder'),
]




