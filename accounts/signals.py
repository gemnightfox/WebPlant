from allauth.account.signals import user_logged_in
from django.dispatch import receiver
from notification.utils import send_email



@receiver(user_logged_in)
def send_user_logged_in_email(request, user, **kwargs):
    content = f'A login has been detected: {user.email}'
    send_email(receiver=user, sender=user, content=content, save_to_db=False)


