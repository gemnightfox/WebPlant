from django.urls import path
from .views import dashboard, check_password_present, send_account_deletion_email, delete_account, set_preferences

app_name = 'accounts'

urlpatterns = [
    path('', dashboard, name='dashboard'),
    path('check-password-present/', check_password_present, name='check_password_present'), # Accounts which used Google login may not have usable local password set up yet
    path('send-account-deletion-email/', send_account_deletion_email, name='send_account_deletion_email'),
    path('delete-account/<user_pk>/<token>/', delete_account, name='delete_account'),
    path('set-preferences/', set_preferences, name='set_preferences'),
]


