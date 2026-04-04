from django.urls import path
from .views import get_unread_count, get_notifications, temp_disable, temp_disable_success, login_temp_disable, remove_temp_disabled, read, unread, delete, read_all, delete_read

app_name = 'notification'

urlpatterns = [
    path('get-unread-count/', get_unread_count, name='get_unread_count'), # Frontend JS periodically sends GET requests to get/update the unread notifications number
    path('get-notifications/', get_notifications, name='get_notifications'),

    path('temp-disable/<user_id>/<token>/', temp_disable, name='temp_disable'), # Used when user clicks the link found below every email sent (temporarily disables notifications)
    path('temp-disable-success/', temp_disable_success, name='temp_disable_success'), # Only used for TOKEN verification (AJAX used for LOGIN temp disable, no page redirect needed)
    path('temp-disable/', login_temp_disable, name='login_temp_disable'), # This one is for LOGGED IN users only (no token needed)
    path('remove-temp-disabled/', remove_temp_disabled, name='remove_temp_disabled'),

    path('read/<uuid:notification_id>/', read, name='read'),
    path('unread/<uuid:notification_id>/', unread, name='unread'),
    path('delete/<uuid:notification_id>/', delete, name='delete'),

    path('read-all/', read_all, name='read_all'),
    path('delete-read/', delete_read, name='delete_read'),
]



