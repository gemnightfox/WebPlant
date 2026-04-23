# Backend Code Map

This guide helps contributors find the right backend layer quickly and extend features without breaking architecture boundaries.

## Directory-Level Map

- `WebPlant/`
  - Project-level wiring: settings, root URLs, ASGI routing, deployment behavior.
- Domain apps
  - `accounts/`, `workspace/`, `project/`, `group/`, `task/`, `notification/`, `feedback/`, `home/`
  - Each app is mostly self-contained with its own `models.py`, `forms.py`, `views.py`, `urls.py`, and `utils.py`.
- Shared cross-app helpers
  - `base_utils.py` for environment access, reusable form response handling, and model serialization helpers.

## Layer Responsibilities (Per App)

- `models.py`
  - Domain entities, relational constraints, and persistence-time invariants.
  - Keep cross-field integrity checks and save/delete side-effects here when they are true domain rules.
- `forms.py`
  - Input validation, type coercion, and object persistence for write operations.
  - Prefer constructor-injected dependencies (`task`, `workspace`, `my_workspace_user`) over global lookups.
- `views.py`
  - Request orchestration only: lookup, access control, form invocation, and response shape.
  - Avoid embedding deep validation/business rules directly in views.
- `utils.py`
  - Reusable policy/lookups: scoped getters, permission helpers, duplication helpers, and workflow utilities.
- `urls.py`
  - App-local HTTP route declarations.
- `consumers.py` + `routing.py` (apps with realtime)
  - WebSocket connection/auth checks and event fan-out contract.

## Dependency Direction

Prefer this one-way dependency flow:

1. View -> utility lookup/permission checks
2. View -> form (validation + write)
3. Form -> model save/delete
4. Model -> app/shared utility only when required for persistence invariants

Avoid reverse coupling patterns:

- Model importing views
- Utility functions depending on `request` unless they are explicitly request-scoped helpers
- Views re-implementing validation that already exists in forms

## Feature Entry Points by Concern

- Authentication and profile behavior
  - `accounts/views.py`, `accounts/forms.py`, `accounts/models.py`, `accounts/utils.py`
- Workspace membership and role system
  - `workspace/views.py`, `workspace/forms.py`, `workspace/models.py`, `workspace/utils.py`
- Project/group/task hierarchy and duplication
  - `project/`, `group/`, `task/` (`views.py`, `forms.py`, `utils.py`)
- Notifications and reminder policy
  - `notification/utils.py`, `notification/models.py`, `task/cron_scripts/send_task_reminders.py`
- Realtime update signaling
  - `project|group|task/consumers.py`, app `routing.py`, and `WebPlant/routing.py`

## Endpoint Design Contract

Mutation endpoints are expected to follow this sequence:

1. Resolve object with membership-scoped getters (`get_*_or_404`).
2. Resolve active membership (`get_workspace_user_or_404`).
3. Enforce role checks (`verify_workspace_role`).
4. Delegate validation and persistence to a form (`reusable_form_submission` + `ModelForm`).
5. Return a predictable JSON contract (`status`, optional `new_object_id`).

Read endpoints should:

- scope access through the same membership-aware lookup helpers,
- assemble response data in a stable shape for frontend callers,
- avoid leaking cross-workspace object existence.

## Extension Recipe (Adding a New Backend Capability)

1. Model: add/adjust fields and constraints.
2. Form: implement validation and save behavior.
3. Utility: add reusable scoped lookup/policy helper if shared.
4. View: orchestrate lookup + authorization + form call.
5. URL: expose endpoint in app `urls.py`.
6. Realtime (optional): publish lightweight update events through Channels consumer.
7. Tests: cover success path, permission denial path, and validation errors.

## Practical Guardrails

- Use `transaction.atomic()` for multi-record writes (duplication, transfer flows, bulk reassignment).
- Keep audit context by passing `workspace_user` to model save/delete paths where logs are expected.
- Treat WebSocket payloads as event signals; fetch canonical state over HTTP after receiving updates.
- In debug mode, external integrations can run with partial fallbacks; in production, `custom_getenv` requires non-empty env values.
