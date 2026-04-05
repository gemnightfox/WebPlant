# App — Workspace Role
[Back to README.md](../../README.md)

Manages per-workspace roles and their granular permissions. Each workspace has its own set of roles; the workspace owner always bypasses all permission checks.



## Model — `WorkspaceRole`

Unique on `(workspace, name)`.

| Field | Type | Default |
|---|---|---|
| `id` | UUIDField | Auto |
| `workspace` | FK → Workspace | CASCADE |
| `name` | CharField (max 100) | — |
| `can_edit_workspace_name` | BooleanField | `False` |
| `can_edit_workspace_preference` | BooleanField | `False` |
| `can_add_workspace_users` | BooleanField | `False` |
| `can_assign_roles_to_workspace_users` | BooleanField | `False` |
| `can_remove_workspace_users` | BooleanField | `False` |
| `can_edit_workspace_roles` | BooleanField | `False` |
| `can_edit_workspace_invite_codes` | BooleanField | `False` |
| `can_edit_projects` | BooleanField | `False` |
| `can_edit_groups` | BooleanField | `False` |
| `can_edit_tasks` | BooleanField | `False` |

> **Note:** When adding new permission fields to `WorkspaceRole`, also update `workspace.forms.CreateNewForm.save()` (which seeds the default Admin/Editor roles) and any frontend templates that display role permissions.



## URLs

| Method | URL | Description |
|---|---|---|
| POST | `/workspace-role/create/<workspace_id>/` | Create a new role |
| POST | `/workspace-role/edit/<workspace_id>/<role_id>/` | Edit role name/permissions |
| POST | `/workspace-role/delete/<workspace_id>/<role_id>/` | Delete a role |
| POST | `/workspace-role/transfer/<workspace_id>/<old_role_id>/<new_role_id>/` | Move all users from one role to another |

All four views require `can_edit_workspace_roles` except `transfer`, which requires `can_assign_roles_to_workspace_users`.



## Key Behaviours

**Deleting a role** — raises an exception if any `WorkspaceUser` still holds it (enforced by the `RESTRICT` FK on `WorkspaceUser.role`). On success, the workspace's `default_role` is automatically updated to the role with the fewest permissions.

**Transferring users** — bulk-updates all `WorkspaceUser` records from `old_role` to `new_role` in a single query.



## Utils

- `get_workspace_role(workspace, workspace_role_id)` — fetches role, raises 404 if it doesn't belong to the workspace.
- `verify_workspace_role(my_workspace_user, permission_field_name)` — raises 404 if the user's role lacks the permission. Skipped entirely if the user is the workspace owner.
- `get_lowest_level_workspace_role(workspace)` — returns the role with the fewest `True` permission fields (used when resetting `default_role` after a deletion).
