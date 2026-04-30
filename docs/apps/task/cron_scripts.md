## send_task_reminders
> Read **task.models.TaskReminder.send_at** and **docs/task/models.md** for more information
> Run CRON script every 5 minutes
1. Delete any TaskReminder objects where `send_at` field is older than 24 hours
2. Get all TaskReminder objects where `send_at` field is in the past
3. For each object, send a reminder email to the user (eg. 'Reminder for task: task-name')
4. Delete object after email has been sent


