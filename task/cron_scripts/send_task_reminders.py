import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'my_project.settings')
django.setup()



from task.models import TaskReminder
from notification.utils import send_email
from django.utils import timezone
from datetime import timedelta



one_day_ago = timezone.now() - timedelta(days=1)
TaskReminder.objects.filter(send_at__lt=one_day_ago).delete()

task_reminders = TaskReminder.objects.select_related('workspace_user__user').filter(send_at__lte=timezone.now()).order_by('-send_at')

for reminder in task_reminders:
    received_by = reminder.workspace_user.user
    send_email(request=None, receiver=received_by, sender=received_by, content=f'This is a reminder for task: {reminder.task.name}')

task_reminders.delete()





