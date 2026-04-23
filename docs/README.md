# Documentation Index

This folder contains backend-focused documentation for WebPlant.
Use it as the detailed reference for architecture, configuration, and development workflows.

## Read First

1. `architecture.md` - project structure, runtime responsibilities, and request lifecycle
2. `domain-model.md` - key models, relationships, and behavioral invariants
3. `backend-patterns.md` - reusable backend implementation patterns and feature checklist
4. `backend-code-map.md` - where logic lives, dependency direction, and feature entry points
5. `configuration.md` - environment variables and debug/production differences
6. `development.md` - local setup, common commands, and day-to-day workflow

## Quick Navigation

- **Onboarding to the codebase**
  - Start with `architecture.md`, then read `domain-model.md`
- **Adding backend features**
  - Keep `architecture.md`, `backend-patterns.md`, `backend-code-map.md`, and `domain-model.md` open together
- **Finding where to implement a change**
  - Start with `backend-code-map.md` and follow app-local extension points
- **Environment setup and deployment checks**
  - Use `configuration.md`
- **Daily implementation and testing**
  - Use `development.md`

## Scope

- These docs focus on backend Django behavior and operational concerns.
- Frontend contribution constraints live in `../instructions/frontend.md`.
