# App — Workspace
[Back to README.md](../../README.md)

Top-level container for collaboration. Users belong to workspaces through `WorkspaceUser`, which also carries their role. Workspaces support invite emails and shareable invite codes.



## Models

### `Workspace`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `name` | CharField | Max 300 characters |
| `users` | M2M → User | Through `WorkspaceUser` |
| `owner` | FK → WorkspaceUser | RESTRICT, `related_name='+'` — blocks deletion until ownership is transferred |
| `default_role` | FK → WorkspaceRole | RESTRICT — role assigned to users joining via invite code |

---

### `WorkspaceUser`

Junction table between `Workspace` and `User`. Unique on `(workspace, user)`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `workspace` | FK → Workspace | CASCADE |
| `user` | FK → User | CASCADE |
| `role` | FK → WorkspaceRole | RESTRICT — can't delete a role while users hold it |
| `is_active` | BooleanField | `False` = invited but not yet accepted |
| `joined_at` | DateTimeField | Auto-set on creation |

---

### `WorkspaceInviteCode`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `workspace` | FK → Workspace | CASCADE |
| `invite_code` | CharField | Max 30, unique — 16-character random code |
| `password` | CharField | Optional, stored unhashed |

---

### `WorkspacePreference`

One-to-one with `Workspace`. Created via `get_workspace_preference(workspace)`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `workspace` | OneToOne → Workspace | CASCADE |
| `custom_roles` | BooleanField | Default: `False` |



## URLs

| Method | URL | Description |
|---|---|---|
| POST | `/workspace/create-new/` | Create a new workspace |
| POST | `/workspace/transfer-ownership/<workspace_id>/` | Transfer ownership to another active member |
| POST | `/workspace/set-preference/<workspace_id>/` | Update `WorkspacePreference` |
| POST | `/workspace/change-default-role/<workspace_id>/` | Change the default invite-code role |
| GET | `/workspace/check-invites/` | AJAX — list of pending invitations (`{invited_workspaces: [...]}`) |
| GET | `/workspace/check-invites-count/` | AJAX — `{invite_count: int}` |
| POST | `/workspace/accept-invite/<workspace_id>/` | Accept a workspace invitation |
| POST | `/workspace/reject-invite/<workspace_id>/` | Reject a workspace invitation |
| GET | `/workspace/settings/<workspace_id>/` | Workspace settings page |
| POST | `/workspace/edit-name/<workspace_id>/` | Rename workspace |
| POST | `/workspace/add-users/<workspace_id>/` | Invite a user by email |
| POST | `/workspace/assign-role-to-user/<workspace_id>/<user_id>/` | Change a member's role |
| POST | `/workspace/remove-user/<workspace_id>/<user_id>/` | Remove a member (or leave) |
| POST | `/workspace/join-using-invite-code/` | Join via invite code (JSON response) |
| POST | `/workspace/add-invite-code/<workspace_id>/` | Generate a new invite code |
| POST | `/workspace/edit-invite-code-password/<workspace_id>/<code_id>/` | Change invite code password |
| POST | `/workspace/delete-invite-code/<workspace_id>/<code_id>/` | Delete invite code |



## Key Behaviours

**Creating a workspace** — automatically creates default `Admin` and `Editor` roles, creates a `WorkspaceUser` for the creator with the Admin role, and sets the creator as owner.

**Inviting users by email** — the invite hides whether the email is registered (security feature). If the invited user's `workspace_invites` preference is `False`, the invite is silently skipped. Role assignment requires `can_assign_roles_to_workspace_users`; otherwise `default_role` is used.

**Joining via invite code** — validates the optional password, then creates or reactivates a `WorkspaceUser` with `default_role`.

**Removing a user / leaving** — if the owner tries to leave, they must transfer ownership first. If the last active member leaves, the workspace is deleted.

**Workspace owner** — always bypasses role permission checks (see `workspace_role.utils.verify_workspace_role`).



## Utils

- `get_workspace(request, workspace_id)` — fetches workspace and verifies the requesting user is an active member. Raises 404 otherwise. Used as the standard guard across all workspace-scoped views.
- `get_workspace_user(user, workspace, allow_false_is_active=False)` — fetches `WorkspaceUser`; by default only returns active records.
- `get_workspace_preference(workspace)` — `get_or_create` for `WorkspacePreference`.
- `generate_workspace_invite_code()` — produces a random 16-character code from an unambiguous alphabet (`ACDEFHJKMNPQRTUVWXY3479`).



## Context Processor

`workspace.context_processors.workspaces` injects `workspaces` (active workspaces for the current user) into every template, with `prefetch_related` to avoid N+1 queries.
