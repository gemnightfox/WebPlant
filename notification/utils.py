from django_ratelimit.core import is_ratelimited
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from django.urls import reverse
from .models import Notification, NotificationDisabledDuration
from django.core.exceptions import ValidationError
from accounts.utils import get_user_preferences
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from base_utils import CustomTokenGenerator



# Don't save to DB for things that requires email verification (eg. account deletion) -> If not, users can access the link given (token used) in sidebar notifications popup, and skip email verification
# Note: request might be given as None (request=None) for non-views (eg. CRON jobs), however it is more reliable to pass request argument where applicable
def send_email(request, receiver, sender, content, save_to_db=True):
    def can_receive_notifications(user): # Checks if notification.models.NotificationDisabledDuration is active, OR if accounts.models.UserPreference.can_receive_notifications=False. If either/both is True, return True, else if both are False, return False.
        user_preferences = get_user_preferences(user)
        if not user_preferences.can_receive_notifications:
            return False

        try:
            disabled_duration = user.notification_disabled_duration # OneToOneField (returns object, not queryset)
        except ObjectDoesNotExist:
            return True # No disabled duration present

        if disabled_duration.ends_at < timezone.now():
            disabled_duration.delete() # Deletes object if ends_at is expired (in the past)
            return True
        else:
            return False # Means that the disabled duration is still active

    if save_to_db:
        Notification.objects.create(
            receiver=receiver,
            sender=sender,
            content=content,
            )

    is_short_limited = is_ratelimited(
        request=None, # request not needed here + might not be present
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

    if can_receive_notifications(receiver) and not is_short_limited and not is_long_limited:
        if receiver == sender:
            message = content + generate_temporary_disable_notifications_link(request, receiver)
        else:
            message = f'From: {sender.username}\n' + content + generate_temporary_disable_notifications_link(request, receiver)
        send_mail(
            subject='WebPlant',
            message=message,
            from_email=None, # Uses default email set in settings.py
            recipient_list=[receiver.email],
            fail_silently=False,
        )



def generate_temporary_disable_notifications_link(request, receiver):
    token_generator = CustomTokenGenerator(purpose='disable-notifications')
    token = token_generator.make_token(receiver)
    link = reverse('notification:temp_disable', kwargs={
        'user_id': receiver.id,
        'token': token,
    })

    if request:
        link = request.build_absolute_uri(link)
    else:
        scheme = 'http' if settings.DEBUG else 'https'
        link = f'{scheme}://{settings.MAIN_DOMAIN_NAME}{link}'

    return f'\n\n\nClick the link below if you would like to temporarily disable notifications:\n{link}'



def save_temp_disabled_duration(user, duration: int | str):
    try:
        duration = int(duration)
    except:
        raise ValueError('Duration given is not an integer')

    if not 1 <= duration <= 100:
        raise ValidationError('Duration given is not in the allowed range')

    ends_at = timezone.now() + timedelta(hours=duration)
    old_disabled_duration = NotificationDisabledDuration.objects.filter(user=user).first()

    if not old_disabled_duration:
        NotificationDisabledDuration.objects.create(
            user=user,
            ends_at=ends_at,
        )

    elif ends_at > old_disabled_duration.ends_at: # Only update model object if the new_object.ends_at is later than old_object.ends_at
        with transaction.atomic():
            old_disabled_duration.delete()
            NotificationDisabledDuration.objects.create( # Creates a new ID instead of using the old one
                user=user,
                ends_at=ends_at,
            )




