# App — Group
[Back to README.md](../../README.md)

Groups organise tasks within a project. They are ordered by a float `position` field, which enables drag-and-drop reordering without renumbering every record.



## Model — `Group`

Unique on `(project, position)`. Default ordering: `position`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `project` | FK → Project | CASCADE |
| `name` | CharField | Max 300 characters |
| `position` | FloatField | Sort order within the project |
| `created_at` | DateTimeField | Auto-set on creation |



## URLs

| Method | URL | Description |
|---|---|---|
| POST | `/group/create-new/<project_id>/` | Create a new group |
| POST | `/group/edit/<group_id>/` | Edit group name or position |
| POST | `/group/delete/<group_id>/` | Delete group (cascades to tasks) |
| POST | `/group/duplicate/<group_id>/<position>/` | Duplicate group and all its tasks at a given position |

All views require the `can_edit_groups` role permission.



## Key Behaviours

**Position** — stored as a float so a new item can be inserted between two existing ones (e.g. `position = (a + b) / 2`) without updating other records.

**Duplicate** — creates a new group named `"(copy) <original name>"` at the supplied `position` and deep-copies all tasks within it.



## Utils

`get_group(request, group_id)` — fetches the group and verifies the requesting user is an active workspace member via `get_workspace()`. Raises 404 otherwise.
