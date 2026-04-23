# Backend Design Patterns

This guide documents implementation patterns already used in the backend and recommended for new features.

## 1) App-Local Layering

Keep each app self-contained and follow this dependency direction:

- `views.py` orchestrates request flow.
- `forms.py` validates and persists writes.
- `models.py` enforces domain invariants.
- `utils.py` hosts reusable lookups/policies.

Why:

- Reduces cross-app coupling.
- Makes behavior easier to reason about and test.
- Limits side effects to predictable layers.

## 2) Access-First View Composition

Use this order for write endpoints:

1. Resolve object in user scope (`get_*_or_404`).
2. Resolve active workspace membership (`get_workspace_user_or_404`).
3. Verify permission (`verify_workspace_role`).
4. Execute mutation through a form.

Why:

- Prevents leaking object existence outside membership boundaries.
- Keeps permission checks consistent across apps.
- Makes permission behavior easy to audit in code review.

## 3) Form-Centric Mutations

Prefer `ModelForm` classes and `reusable_form_submission(...)` for create/edit actions instead of mutating models directly in views.

Why:

- Validation and coercion stay centralized.
- Views remain orchestration-only.
- Responses are consistent for frontend AJAX callers.

## 4) Domain Logging on Model Lifecycle

For project/group/task entities, pass `workspace_user` to model `save()` and `delete()` when changes are user-initiated.
This preserves actor context in `WorkspaceLog`.

Why:

- Creates a reliable audit trail.
- Avoids fragile "who changed this?" reconstruction from request logs.

## 5) Explicit Transaction Boundaries

Use `transaction.atomic()` around multi-step writes (especially duplication flows) so partial state is never committed.

Good candidates:

- Project duplication that also duplicates groups/tasks.
- Multi-record role transfer or ownership transfer operations.

## 6) Realtime as Event Signal, Not Data Source

WebSocket consumers should broadcast lightweight action events and let clients fetch authoritative state via HTTP endpoints.

Why:

- Avoids oversized socket payloads.
- Keeps serialization logic in one place (HTTP view/data endpoint).
- Simplifies compatibility with reconnect/backfill behavior.

## 7) Utility Modules as Policy Layer

Keep cross-view policy and lookups in app `utils.py` modules:

- membership-scoped getters
- role checks
- reusable duplication logic
- notification policy helpers

Why:

- Lowers copy/paste risk.
- Allows consistency improvements in one place.

## 8) Stable Response Contracts

Use predictable response shapes for API-like endpoints:

- Success writes: `{'status': 'success'}` or `{'status': 'success', 'new_object_id': '<uuid>'}`
- Data reads: top-level object key (`project`, `group`, `task`, etc.) with stable field names
- Failure paths: explicit raised errors (permission/validation) rather than ambiguous partial success

Why:

- Frontend call sites stay simple.
- Refactors are safer because contracts are explicit.

## 9) Query Shape Awareness

Use `select_related` and `prefetch_related` when traversing nested structures for dashboards or duplication flows.

Why:

- Prevents accidental N+1 regressions.
- Keeps response latency predictable under collaboration-heavy workloads.

## 10) Configuration-Safe Integrations

External services should degrade cleanly in local development:

- console email backend in debug
- local filesystem media when Cloudinary is absent
- in-memory channel layer when Redis is absent

Why:

- Keeps onboarding lightweight.
- Reduces "works only in production-like env" friction.

## 11) Keep Permission Rules Centralized

Use role flags and permission helpers as the source of truth:

- keep role booleans in `WorkspaceRole`,
- enforce via `verify_workspace_role(...)` and scoped checks in app utils/forms,
- avoid hardcoding permission decisions directly in templates or ad-hoc view branches.

Why:

- Permission behavior remains auditable.
- Reduces inconsistent edge-case handling between endpoints.

## Feature Checklist

When adding a backend feature:

- Add/extend form validation first.
- Reuse workspace-scoped lookup helpers.
- Enforce permission booleans before writes.
- Wrap multi-step writes in a transaction.
- Add logging context (`workspace_user`) where applicable.
- Keep responses predictable for frontend callers.
- Apply query prefetching/select-related where nested data is returned.
- Add tests for happy path, permission denial, and validation failure.
