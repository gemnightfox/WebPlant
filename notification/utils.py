from django_ratelimit.core import is_ratelimited
from django.core.mail import send_mail
from django.utils import timezone
import json
from datetime import datetime, timedelta
from django.urls import reverse
from .models import Notification, NotificationDisabledDuration
from django.http import Http404
from accounts.utils import get_preferences
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from base_utils import CustomTokenGenerator



def can_send_notifications(user):
    user_preferences = get_preferences(user)
    if not user_preferences.send_notifications:
        return False # Immediately stop checks (already confirmed that user does not allow emails)

    try:
        disabled_duration = user.notification_disabled_duration # Using related_name so I don't have to initialise Django inside this file
    except ObjectDoesNotExist:
        return True # No disabled duration present

    if disabled_duration.ends_at < timezone.now():
        disabled_duration.delete() # Deletes object if ends_at is expired (in the past)
        return False
    else:
        return True # Means that the disabled duration is still active



def send_email(receiver, sender, content, save_to_db=True): # Don't save to DB for things that requires email verification (eg. account deletion) -> If not, users can access the link given (token used) in sidebar notifications popup, and skip email verification
    if save_to_db:
        Notification.objects.create(
            receiver=receiver,
            sender=sender,
            content=content,
            )

    is_short_limited = is_ratelimited(
        request=None,
        group='send_email',
        key=lambda _, __: receiver.email,
        rate='10/10m',
        increment=True,
    )

    is_long_limited = is_ratelimited(
        request=None,
        group='send_email',
        key=lambda _, __: receiver.email,
        rate='30/3h',
        increment=True,
    )

    if can_send_notifications(receiver) and not is_short_limited and not is_long_limited:
        if receiver == sender:
            title = f'To: {receiver.email}\n'
        else:
            title = f'From: {sender.email}, To: {receiver.email}\n'
        
        message = title + content + generate_temporary_disable_notifications_link(receiver)
        send_mail(
            subject='WebPlant',
            message=message,
            from_email=None, # Uses default email set in settings.py
            recipient_list=[receiver.email],
            fail_silently=False,
        )



def generate_temporary_disable_notifications_link(receiver):
    token_generator = CustomTokenGenerator(purpose='disable-notifications')
    token = token_generator.make_token(receiver)
    path = reverse('notification:temp_disable', kwargs={
        'user_pk': receiver.pk,
        'token': token,
    })
    DOMAIN_NAME = 'webplant.org'
    link = f'{DOMAIN_NAME}{path}' # Can't use request.build_absolute_uri cause "request" is not always available (eg. celery task)
    return f'\n\n\nClick the link below if you would like to temporarily disable notifications:\n{link}'



def get_filtered_notifications(request):
    if 'unread' in request.GET and 'read' in request.GET:
        notifications = request.user.notifications
    elif 'unread' in request.GET:
        notifications = request.user.notifications.filter(read_status=False)
    elif 'read' in request.GET:
        notifications = request.user.notifications.filter(read_status=True)
    else:
        raise Http404('No read/unread GET query given.')

    dates = request.POST.get('notification_dates', None) # Should return (YYYY-MM-DD): ['2025-01-01', '2026-01-01', ...]
    if not dates:
        return notifications # If no dates given (user didnt select), default to showing everything (no filter on dates)

    dates = json.loads(dates)
    refined_dates = set()
    for date in dates:
        date_object = datetime.strptime(date, '%Y-%m-%d')
        refined_dates.add(date_object)

    return notifications.filter(sent_at__date__in=refined_dates) # Note: its using the notifications object (filtered read/unread) defined in the code above



def get_temp_disabled_duration(request):
    duration = request.POST.get('disable_notifications_duration') # In hours (int)

    try:
        duration = int(duration)
    except ValueError:
        raise Http404('Duration given is not an integer')

    if not 1 <= duration <= 100:
        raise Http404('Duration given is not in the allowed range')

    return duration



def save_temp_disabled_duration(user, duration: int):
    ends_at = timezone.now() + timedelta(hours=duration)
    temp_disabled_duration = NotificationDisabledDuration.objects.filter(user=user).first()

    if not temp_disabled_duration:
        NotificationDisabledDuration.objects.create(
            user=user,
            ends_at=ends_at,
        )

    elif ends_at > temp_disabled_duration.ends_at: # Only update model object if the new object.ends_at is later than old object.ends_at
        with transaction.atomic():
            temp_disabled_duration.delete()
            NotificationDisabledDuration.objects.create( # Creates a new ID instead of using the old one
                user=user,
                ends_at=ends_at,
            )






