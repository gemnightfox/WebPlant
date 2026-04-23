# Backend Design Patterns

This guide documents implementation patterns already used in the backend and recommended for new features.

## 1) Access-First View Composition

Use this order for write endpoints:

1. Resolve object in user scope (`get_*_or_404`).
2. Resolve active workspace membership (`get_workspace_user_or_404`).
3. Verify permission (`verify_workspace_role`).
4. Execute mutation through a form.

Why:

- Prevents leaking object existence outside membership boundaries.
- Keeps permission checks consistent across apps.
- Makes permission behavior easy to audit in code review.

## 2) Form-Centric Mutations

Prefer `ModelForm` classes and `reusable_form_submission(...)` for create/edit actions instead of mutating models directly in views.

Why:

- Validation and coercion stay centralized.
- Views remain orchestration-only.
- Responses are consistent for frontend AJAX callers.

## 3) Domain Logging on Model Lifecycle

For project/group/task entities, pass `workspace_user` to model `save()` and `delete()` when changes are user-initiated.
This preserves actor context in `WorkspaceLog`.

Why:

- Creates a reliable audit trail.
- Avoids fragile "who changed this?" reconstruction from request logs.

## 4) Explicit Transaction Boundaries

Use `transaction.atomic()` around multi-step writes (especially duplication flows) so partial state is never committed.

Good candidates:

- Project duplication that also duplicates groups/tasks.
- Multi-record role transfer or ownership transfer operations.

## 5) Realtime as Event Signal, Not Data Source

WebSocket consumers should broadcast lightweight action events and let clients fetch authoritative state via HTTP endpoints.

Why:

- Avoids oversized socket payloads.
- Keeps serialization logic in one place (HTTP view/data endpoint).
- Simplifies compatibility with reconnect/backfill behavior.

## 6) Utility Modules as Policy Layer

Keep cross-view policy and lookups in app `utils.py` modules:

- membership-scoped getters
- role checks
- reusable duplication logic
- notification policy helpers

Why:

- Lowers copy/paste risk.
- Allows consistency improvements in one place.

## 7) Configuration-Safe Integrations

External services should degrade cleanly in local development:

- console email backend in debug
- local filesystem media when Cloudinary is absent
- in-memory channel layer when Redis is absent

Why:

- Keeps onboarding lightweight.
- Reduces "works only in production-like env" friction.

## Feature Checklist

When adding a backend feature:

- Add/extend form validation first.
- Reuse workspace-scoped lookup helpers.
- Enforce permission booleans before writes.
- Wrap multi-step writes in a transaction.
- Add logging context (`workspace_user`) where applicable.
- Keep responses predictable for frontend callers.
