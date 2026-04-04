# App — Accounts
[Back to README.md](../../README.md)

Manages the custom user model, user preferences, and account lifecycle (deletion, password detection).



## Models

### `CustomUser`

Extends `AbstractUser`. Email is the login identifier — there is no username field.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `email` | EmailField | Unique, case-insensitive constraint |

`AUTH_USER_MODEL = 'accounts.CustomUser'`

---

### `UserPreference`

One-to-one with `CustomUser`. Created on first access via `get_preferences(user)`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `user` | OneToOne → CustomUser | CASCADE |
| `color_theme` | CharField | `'light'` or `'dark'` (default: `'dark'`) |
| `send_notifications` | BooleanField | Default: `True` |
| `workspace_invites` | BooleanField | Default: `True` — controls whether other users can invite this user |



## URLs

| Method | URL | View | Description |
|---|---|---|---|
| GET | `/account/` | `dashboard` | Account dashboard |
| GET | `/account/check-password-present/` | `check_password_present` | AJAX — returns `{is_password_present: bool}` |
| POST | `/account/send-account-deletion-email/` | `send_account_deletion_email` | Sends deletion confirmation email |
| GET/POST | `/account/delete-account/<user_id>/<token>/` | `delete_account` | Confirms and executes account deletion |
| POST | `/account/set-preferences/` | `set_preferences` | Updates `UserPreference` |



## Account Deletion Flow

1. User clicks delete → `send_account_deletion_email` generates a scoped token (`CustomTokenGenerator(purpose='delete-account')`) and emails a link.
2. User follows link → `delete_account` validates the token.
3. On POST confirmation, `transfer_workspace_ownership_to_successor` is called for each workspace the user owns before the account is deleted.

`check_password_present` is used in the UI to detect Google-only accounts (no local password), so the frontend can show appropriate messaging.



## Utils

- `get_preferences(user)` — `get_or_create` for `UserPreference`.
- `transfer_workspace_ownership_to_successor(owner, workspace)` — transfers ownership to the active member with the most role permissions (ties broken by earliest `joined_at`). Deletes the workspace if the owner is the only active member.



## Context Processor

`accounts.context_processors.preferences` injects `user_preferences` into every template for authenticated users (used for the dark/light theme body class).



## Signal

`send_user_logged_in_email` listens on AllAuth's `user_logged_in` signal and sends a login-detection notification email via `notification.utils.send_email`.
