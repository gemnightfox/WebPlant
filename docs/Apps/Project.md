# App — Project
[Back to README.md](../../README.md)

Projects live inside a workspace and act as containers for groups and tasks.



## Model — `Project`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `workspace` | FK → Workspace | CASCADE |
| `name` | CharField | Max 300 characters |
| `created_at` | DateTimeField | Auto-set on creation |



## URLs

| Method | URL | Description |
|---|---|---|
| GET | `/project/dashboard/<project_id>/` | Project dashboard (shows all groups and tasks) |
| POST | `/project/create-new/<workspace_id>/` | Create a new project |
| POST | `/project/edit-name/<project_id>/` | Rename project |
| POST | `/project/delete/<project_id>/` | Delete project (cascades to groups and tasks) |
| POST | `/project/duplicate/<project_id>/` | Duplicate project with all groups and tasks |

`create_new`, `edit_name`, `delete`, and `duplicate` require the `can_edit_projects` role permission.



## Key Behaviours

**Dashboard** — loads the project with `prefetch_related` on its groups and their tasks to avoid N+1 queries.

**Duplicate** — creates a new project named `"(copy) <original name>"` and deep-copies all groups and their tasks.



## Utils

`get_project(request, project_id)` — fetches the project and verifies the requesting user is an active workspace member via `get_workspace()`. Raises 404 otherwise.
