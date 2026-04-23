# Backend Architecture

## System Overview

WebPlant is a single Django project package (`WebPlant`) with domain apps at repository root.
The backend uses app-local layering:

- **Views** orchestrate request flow, access checks, and response shape.
- **Forms** own validation and object persistence for write operations.
- **Utils** provide app-specific lookups, authorization helpers, and duplication logic.
- **Models** enforce relational constraints and domain invariants.
- **Shared helpers** in `base_utils.py` provide reusable request/form patterns.

Dependency direction (preferred):

- `views` -> `forms`/`utils` -> `models`
- Keep dependency flow one-way; avoid model/view coupling and duplicated validation logic.

Primary runtime components:

- Django request/response stack (routing, templates, auth, sessions)
- Django Channels over ASGI (`daphne`) for realtime update broadcasts
- Redis-backed cache/channel/rate-limit wiring when `REDIS_URL` is configured
- Relational database from `DATABASE_URL` (SQLite fallback in debug mode)
- Cloudinary media storage backend (`MediaCloudinaryStorage`)
- Email backend: console in debug, Anymail/Resend in production
- Sentry SDK for error and performance telemetry

## App Responsibilities

- `home`: landing routes
- `accounts`: custom user model, account settings, and preference updates
- `workspace`: workspace membership, role model, invite codes, ownership transfer, audit log model
- `project`: project CRUD and duplication orchestration
- `group`: group CRUD, ordering, and duplication
- `task`: task CRUD, attachments, comments, assignees, reminders
- `notification`: notification feed, read state, temporary notification mute windows, email dispatch helpers
- `feedback`: authenticated feedback submission

## URL and Protocol Topology

`WebPlant/urls.py` mounts HTTP routes under:

- `/` (home)
- `/account/`
- `/workspace/`
- `/project/`
- `/group/`
- `/task/`
- `/notification/`
- `/feedback/`

Operational endpoints:

- `/admin/` or `/admin/<URL_SECRET>/`
- `/trigger-error/` or `/trigger-error/<URL_SECRET>/`

WebSocket routing (`WebPlant/routing.py`):

- `/websocket/project/update/<project_id>/` via `project/routing.py`
- `/websocket/group/update/<group_id>/` via `group/routing.py`
- `/websocket/task/update/<task_id>/` via `task/routing.py`

## Write Request Lifecycle (Design Pattern)

Most mutable endpoints follow this pattern:

1. Resolve the target resource with scoped lookup helpers (`get_*_or_404`).
2. Resolve active membership via `WorkspaceUser`.
3. Verify role permissions with `verify_workspace_role(...)` (owner has bypass behavior).
4. Delegate validation/save to a form through `reusable_form_submission(...)`.
5. Return JSON payloads for AJAX clients (`status`, optional `new_object_id`).

This keeps authorization and validation concerns explicit while avoiding repeated boilerplate.

## Read Request Lifecycle (Design Pattern)

Most data-read endpoints follow this pattern:

1. Resolve resource through membership-scoped getter (`get_*_or_404`).
2. Assemble nested fields with explicit query shaping (`select_related` / `prefetch_related`) as needed.
3. Serialize with stable response keys and ID normalization helpers.
4. Return JSON payloads that frontend consumers can cache/refresh safely.

This keeps read behavior secure and predictable while controlling query cost.

## Audit and Realtime Collaboration

Project, group, and task model mutations can write `WorkspaceLog` entries.
The model `save()`/`delete()` methods accept `workspace_user` to preserve actor context in logs.

Realtime collaboration uses Channels group fan-out:

- Client sends an action marker (`create`/`edit`/`delete`) over WebSocket.
- Consumer relays to a channel-layer group keyed by object ID.
- Connected clients receive a lightweight refresh signal and pull updated data over HTTP.

This separates event signaling from authoritative data reads.

## Reminder and Notification Flow

- Reminders are stored as `TaskReminder`.
- Email and in-app notification behavior is centralized in `notification/utils.py`.
- Delivery respects user-level preference toggles and temporary mute windows.
- Reminder dispatch is script-driven (`task/cron_scripts/send_task_reminders.py`) and triggered by external scheduling infrastructure.

## Transaction and Consistency Boundaries

Multi-step writes that touch multiple entities (for example duplication flows) should be wrapped in `transaction.atomic()`:

- ensure parent/child entities are created consistently,
- avoid partial duplication when a downstream write fails,
- keep audit logs aligned with committed state.

## High-Level Component Diagram

```mermaid
flowchart LR
    UserClient[Browser Client] --> DjangoHTTP[Django HTTP Views]
    UserClient --> DjangoWS[Channels WebSocket Consumers]
    DjangoHTTP --> DomainApps[Domain Apps]
    DjangoWS --> DomainApps
    DomainApps --> Database[(Database)]
    DomainApps --> NotificationLayer[Notification Utilities]
    NotificationLayer --> EmailProvider[Email Provider]
    Scheduler[External Scheduler] --> ReminderScript[Task Reminder Script]
    ReminderScript --> NotificationLayer
    RedisConfig[REDIS_URL configured] --> Redis[(Redis)]
    Redis --> DjangoHTTP
    Redis --> DjangoWS
```
