from celery import shared_task
from .models import TaskReminder
from notification.utils import send_email
from django.utils import timezone



@shared_task(ignore_result=True)
def send_task_alert():
    task_reminders = TaskReminder.objects.filter(send_at__lte=timezone.now())

    for reminder in task_reminders:
        received_by = reminder.workspace_user.user
        send_email(receiver=received_by, sender=received_by, content=f'This is a reminder for task: {reminder.task.name}')
        reminder.delete()




