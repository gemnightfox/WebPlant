# App — Feedback
[Back to README.md](../../README.md)

Allows authenticated users to submit feedback.



## Model — `Feedback`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDField | Primary key, auto-generated |
| `user` | FK → User | Nullable (preserved after account deletion) |
| `content` | CharField | Max 9000 characters |
| `sent_at` | DateTimeField | Auto-set on creation |



## URLs

| Method | URL | View | Description |
|---|---|---|---|
| GET/POST | `/feedback/` | `dashboard` | View and submit feedback |



## Notes

- The `user` FK uses `SET_NULL` so feedback is preserved when an account is deleted.
- Submission is handled via `FeedbackForm`, which accepts a `current_user` and sets it on save.
