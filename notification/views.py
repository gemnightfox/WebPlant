from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404, render, redirect
from django.core.paginator import Paginator
from django.contrib.auth import get_user_model
from base_utils import CustomTokenGenerator, CustomJsonResponse
from .models import Notification, NotificationDisabledDuration
from .utils import save_temp_disabled_duration
from django.http import Http404



@login_required
def get_unread_count(request):
    unread_count = request.user.notifications.filter(read_status=False).count()
    return CustomJsonResponse({'unread_count': unread_count})



@login_required
@require_POST # Note: GET queries are still present (eg. URL: .../?unread&read), just that POST is used for dates filtering (long GET queries for dates could cause URL issues)
def get_notifications(request):
    notifications = request.user.notifications.order_by('-sent_at')[:9999]
    
    paginator = Paginator(notifications, 100)
    page_number = request.GET.get('notifications_page', 1)
    paginated_notifications = paginator.get_page(page_number).object_list

    payload = list(paginated_notifications.values('id', 'sender__email', 'content', 'read_status', 'sent_at')) # Makes it compatible for JSON, turns a Django queryset into a Python list
    return CustomJsonResponse({'notifications': payload, 'last_page': paginator.num_pages})



# No login required (token used)
def temp_disable(request, user_id, token):
    user = get_object_or_404(get_user_model(), id=user_id)
    token_generator = CustomTokenGenerator(purpose='disable-notifications')
    is_token_valid = token_generator.check_token(user, token)

    if not is_token_valid:
        raise Http404('Token is not valid')

    if request.method == 'POST':
        duration = request.POST.get('disable_notifications_duration') # In hours (int)
        save_temp_disabled_duration(user=user, duration=duration)
        return redirect('notification:temp_disable_success')
    return render(request, 'notification/temp_disable_notifications.html', {'email': user.email, 'username': user.username})



@login_required
@require_POST
def login_temp_disable(request):
    duration = request.POST.get('disable_notifications_duration') # In hours (int)
    save_temp_disabled_duration(user=request.user, duration=duration)
    return CustomJsonResponse({'status': 'success'})



# No logged in user required
def temp_disable_success(request):
    return render(request, 'notification/temp_disable_success.html')



@login_required
@require_POST
def remove_temp_disabled(request):
    NotificationDisabledDuration.objects.filter(user=request.user).delete()
    return CustomJsonResponse({'status': 'success'})



@login_required
@require_POST
def read(request, notification_id):
    notification = get_object_or_404(Notification, receiver=request.user, id=notification_id)
    notification.read_status = True
    notification.save()
    return CustomJsonResponse({'status': 'success'})



@login_required
@require_POST
def unread(request, notification_id):
    notification = get_object_or_404(Notification, receiver=request.user, id=notification_id)
    notification.read_status = False
    notification.save()
    return CustomJsonResponse({'status': 'success'})



@login_required
@require_POST
def delete(request, notification_id):
    notification = get_object_or_404(Notification, receiver=request.user, id=notification_id)
    notification.delete()
    return CustomJsonResponse({'status': 'success'})



@login_required
@require_POST
def read_all(request):
    notifications = Notification.objects.filter(receiver=request.user, read_status=False)
    notifications.update(read_status=True)
    return CustomJsonResponse({'status': 'success'})



@login_required
@require_POST
def delete_read(request):
    notifications = Notification.objects.filter(receiver=request.user, read_status=True)
    notifications.delete()
    return CustomJsonResponse({'status': 'success'})



