## Task
> Stores data about each task (eg. name of task, task deadline).
- Custom save method (`workspace_user` parameter required, don't call .save() with `workspace_user=None`)
    - Creates a WorkspaceLog object (create/edit)
- Custom delete method (`workspace_user` parameter required, don't call .delete() with `workspace_user=None`)
    - Creates a WorkspaceLog object (delete)
    - For WorkspaceLog objects, delete any reference to the Task object currently being deleted (self)



## TaskAttachment
> A task object (parent) can contain multiple TaskAttachment objects (children)
- Attaches a file (png, pdf, mp4, ...) given by user to a Task object



## TaskComment
> A task object (parent) can contain multiple TaskComment objects (children)
- Store user given comments for a task object



## TaskReminder
> A task object (parent) can contain multiple TaskReminder objects (children)
- A user can only add a TaskReminder object for themselves
- Stores a scheduled timestamp (`send_at` DateTimeField) to trigger a reminder email at a later date
- Read **docs/task/cron_scripts.md send_task_reminders** for more information



## TaskAssigned
> A task object (parent) can contain multiple TaskAssigned objects (children)
- Assigns a user to a task object (typically means that the user is expected to work on or be responsible for the task in a team setting)



