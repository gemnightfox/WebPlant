from django.urls import path
from .views import dashboard, check_password_present, send_disable_password_email, disable_password, disable_password_success, send_account_deletion_email, delete_account, set_preferences

app_name = 'accounts'

urlpatterns = [
    path('', dashboard, name='dashboard'),
    path('check-password-present/', check_password_present, name='check_password_present'), # Accounts which used Google login may not have usable local password set up yet
    path('send-disable-password-email/', send_disable_password_email, name='send_disable_password_email'),
    path('disable-password/<user_id>/<token>/', disable_password, name='disable_password'),
    path('disable-password-success/', disable_password_success, name='disable_password_success'),
    path('send-account-deletion-email/', send_account_deletion_email, name='send_account_deletion_email'),
    path('delete-account/<user_id>/<token>/', delete_account, name='delete_account'),
    path('set-preferences/', set_preferences, name='set_preferences'),
]




