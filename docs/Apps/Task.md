# App — Task
[Back to README.md](../../README.md)

Individual work items within a group. Tasks support comments, deadlines, and email reminders sent via a Celery background job.



## Models

### `Task`

Unique on `(group, position)`. Default ordering: `position`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `group` | FK → Group | CASCADE |
| `name` | CharField | Max 3000 characters |
| `is_completed` | BooleanField | Default: `False` |
| `position` | FloatField | Sort order within the group |
| `deadline` | DateTimeField | Optional |
| `created_at` | DateTimeField | Auto-set on creation |

---

### `TaskComment`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `task` | FK → Task | CASCADE, `related_name='comments'` |
| `added_by` | FK → WorkspaceUser | SET_NULL — comment preserved after member removal |
| `content` | CharField | Max 3000 characters |

---

### `TaskReminder`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `task` | FK → Task | CASCADE |
| `workspace_user` | FK → WorkspaceUser | CASCADE |
| `send_at` | DateTimeField | When the reminder email should be sent |



## URLs

| Method | URL | Description |
|---|---|---|
| POST | `/task/create-new/<group_id>/` | Create a new task |
| POST | `/task/edit/<task_id>/` | Edit task fields |
| POST | `/task/delete/<task_id>/` | Delete task |
| POST | `/task/duplicate/<task_id>/<position>/` | Duplicate task at a given position |
| POST | `/task/comment/add/<task_id>/` | Add a comment |
| POST | `/task/comment/edit/<task_comment_id>/` | Edit a comment |
| POST | `/task/comment/delete/<task_comment_id>/` | Delete a comment |
| POST | `/task/reminder/add/<task_id>/` | Add a reminder |
| POST | `/task/reminder/delete/<task_reminder_id>/` | Delete a reminder |

`create_new`, `edit`, `delete`, `duplicate`, and comment views require `can_edit_tasks`.
Reminders have no role restriction — any workspace member can manage their own reminders.



## Key Behaviours

**Position** — same float-based ordering as `Group`, enabling in-place reordering without bulk updates.

**Comments** — only the comment author or the workspace owner can edit or delete a comment.

**Reminders** — only the user who created a reminder can delete it. The `send_at` time is set by the user; the Celery task polls for due reminders.

**Duplicate** — creates a new task named `"(copy) <original name>"` at the supplied position (comments and reminders are not copied).



## Celery Task — `send_task_alert`

Defined in `task/tasks.py`, decorated with `@shared_task`. Scheduled to run every 5 minutes via `django-celery-beat`.

On each run it:
1. Queries all `TaskReminder` records where `send_at <= now()`.
2. Sends an email to each `workspace_user.user` with the task name.
3. Deletes the reminder after sending.

See [Background Tasks/Celery.md](../Background%20Tasks/Celery.md) for worker setup.



## Utils

`get_task(request, task_id)` — fetches the task and verifies the requesting user is an active workspace member via `get_workspace()`. Raises 404 otherwise.
