# App — Notification
[Back to README.md](../../README.md)

Handles in-app notifications and outbound email alerts, including a temporary-disable mechanism for users who don't want to receive emails.



## Models

### `Notification`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `sender` | FK → User | Nullable |
| `receiver` | FK → User | CASCADE, `related_name='notifications'` |
| `content` | CharField | Max 9000 characters |
| `read_status` | BooleanField | Default: `False` |
| `sent_at` | DateTimeField | Auto-set on creation |

---

### `NotificationDisabledDuration`

One-to-one with `User`. When present, email notifications are suppressed until `ends_at` passes. Checked and cleaned up lazily on access.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key |
| `user` | OneToOne → User | CASCADE |
| `ends_at` | DateTimeField | Notifications resume after this time |



## URLs

| Method | URL | View | Description |
|---|---|---|---|
| GET | `/notification/get-unread-count/` | `get_unread_count` | AJAX — `{unread_count: int}` |
| GET/POST | `/notification/get-notifications/` | `get_notifications` | Paginated, filtered notification list |
| GET/POST | `/notification/temp-disable/<user_id>/<token>/` | `temp_disable` | Token-based disable via email link (no login needed) |
| GET | `/notification/temp-disable-success/` | `temp_disable_success` | Success page after disabling |
| POST | `/notification/temp-disable/` | `login_temp_disable` | Disable for logged-in user |
| POST | `/notification/remove-temp-disabled/` | `remove_temp_disabled` | Re-enable notifications |
| POST | `/notification/read/<id>/` | `read` | Mark one notification as read |
| POST | `/notification/unread/<id>/` | `unread` | Mark one notification as unread |
| POST | `/notification/delete/<id>/` | `delete` | Delete one notification |
| POST | `/notification/read-all/` | `read_all` | Mark all unread as read |
| POST | `/notification/delete-read/` | `delete_read` | Delete all read notifications |

`get_notifications` accepts GET query params `unread` and/or `read` to filter, plus optional POST body `notification_dates` (JSON list of `YYYY-MM-DD` strings) to filter by date. Results are paginated at 100 per page.



## Utils

- `can_send_notifications(user)` — returns `True` if the user's preferences allow notifications and no active `NotificationDisabledDuration` exists. Deletes expired records lazily.
- `send_email(receiver, sender, content, save_to_db=True)` — sends an email and optionally saves a `Notification` record. Includes a temporary-disable link in the email footer. Rate-limited to 10 per 10 minutes and 30 per 3 hours per recipient.
- `generate_temporary_disable_notifications_link(receiver)` — creates a `CustomTokenGenerator(purpose='disable-notifications')` token link for the email footer.
- `get_filtered_notifications(request)` — builds a filtered queryset from GET/POST params. Raises 404 if neither `read` nor `unread` param is present.
- `get_temp_disabled_duration(request)` — parses and validates the `disable_notifications_duration` POST param (1–100 hours).
- `save_temp_disabled_duration(user, duration)` — creates or extends `NotificationDisabledDuration` atomically (only updates if the new end time is later).
