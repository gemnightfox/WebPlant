from django.urls import path
from .views import create_new, transfer_ownership, change_default_role
from .views import check_invites, check_invites_count, accept_invite, reject_invite
from .views import settings, edit_name, add_users, assign_role_to_user, remove_user
from .views import add_invite_code, edit_invite_code_password, delete_invite_code, join_using_invite_code
from .views import create_role, edit_role, delete_role, transfer_role

app_name = 'workspace'

urlpatterns = [
    path('create-new/', create_new, name='create_new'),
    path('transfer-ownership/<uuid:workspace_id>/', transfer_ownership, name='transfer_ownership'),
    path('change-default-role/<uuid:workspace_id>/', change_default_role, name='change_default_role'),

    path('check-invites/', check_invites, name='check_invites'),
    path('check-invites-count/', check_invites_count, name='check_invites_count'),
    path('accept-invite/<uuid:workspace_id>/', accept_invite, name='accept_invite'),
    path('reject-invite/<uuid:workspace_id>/', reject_invite, name='reject_invite'),

    path('settings/<uuid:workspace_id>/', settings, name='settings'),
    path('edit-name/<uuid:workspace_id>/', edit_name, name='edit_name'),
    path('add-users/<uuid:workspace_id>/', add_users, name='add_users'),
    path('assign-role-to-user/<uuid:workspace_id>/<uuid:user_id>/', assign_role_to_user, name='assign_role_to_user'),
    path('remove-user/<uuid:workspace_id>/<uuid:user_id>/', remove_user, name='remove_user'),

    path('join-using-invite-code/', join_using_invite_code, name='join_using_invite_code'),
    path('add-invite-code/<uuid:workspace_id>/', add_invite_code, name='add_invite_code'),
    path('edit-invite-code-password/<uuid:workspace_id>/<uuid:workspace_invite_code_id>/', edit_invite_code_password, name='edit_invite_code_password'),
    path('delete-invite-code/<uuid:workspace_id>/<uuid:workspace_invite_code_id>/', delete_invite_code, name='delete_invite_code'),

    path('role/create/<uuid:workspace_id>/', create_role, name='create_role'),
    path('role/edit/<uuid:workspace_id>/<uuid:workspace_role_id>/', edit_role, name='edit_role'),
    path('role/delete/<uuid:workspace_id>/<uuid:workspace_role_id>/', delete_role, name='delete_role'),
    path('role/transfer/<uuid:workspace_id>/<uuid:old_workspace_role_id>/<uuid:new_workspace_role_id>/', transfer_role, name='transfer_role'),
]



