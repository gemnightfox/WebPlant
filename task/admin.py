from django.contrib import admin
from .models import Task, TaskAttachment, TaskComment, TaskReminder



admin.site.register(Task)
admin.site.register(TaskAttachment)
admin.site.register(TaskComment)
admin.site.register(TaskReminder)





