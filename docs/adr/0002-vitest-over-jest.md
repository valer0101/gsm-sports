# 0002 — Vitest over Jest

**Status:** Accepted
**Date:** 2025-09 (retroactive)

## Context

Both api and web are pure ESM TypeScript projects. We need a test runner that:
- Handles modern TypeScript (5.7+) and ESM cleanly without ts-jest/babel-jest gymnastics.
- Runs fast in CI (the bracket-engine alone has 185 tests; we expect 1000+ across the monorepo at maturity).
- Plays well with Turborepo caching.
- Has built-in coverage support (V8) without an extra dependency.

Jest works but its TypeScript / ESM story is awkward — ts-jest config drift, Babel transforms, slow startup, separate `@vitest/coverage-v8` analog (`@jest/coverage-istanbul`). Vitest is a near-drop-in API-compatible replacement that runs significantly faster and ships V8 coverage out of the box.

## Decision

Use **Vitest** for unit and integration tests across all workspaces. `vi.fn` / `vi.mock` instead of `jest.fn` / `jest.mock`.

E2E tests (when added in the testing roadmap step 5) use **Playwright** — that's a separate decision documented when E2E lands.

## Consequences

Positive:
- ~3-5x faster test runs vs Jest in similar projects.
- Native ESM + TypeScript support; no ts-jest, no Babel.
- Built-in `--coverage` (V8) without extra config.
- `vi` API is API-compatible enough that imports from Jest examples generally just work.
- Watch mode reuses Vite's dependency graph for fast incremental runs.

Negative:
- Smaller community than Jest; some Stack Overflow answers reference Jest-specific gotchas.
- Some Jest plugins (e.g. `jest-axe` for a11y) need Vitest equivalents.
- `vi.mock` hoisting rules differ slightly from Jest — occasional surprise when porting tests.

Hard rules captured in `CLAUDE.md`:
- Test files live next to source as `*.spec.ts`.
- Mock external dependencies only — never the service under test.
- Use `vi.fn()`, `vi.mock()`, `mockResolvedValue` — never `jest.*`.

## References

- `packages/bracket-engine/vitest.config.ts` — package-level config.
- `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`.
- `CLAUDE.md` → "Testing".
- `docs/09-TESTING-STRATEGY.md`.
