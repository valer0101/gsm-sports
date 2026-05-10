<!--
PR title format: <type>(<scope>): <description>
  types:  feat, fix, chore, refactor, docs, test, style
  scopes: api, web, bracket, db, auth, i18n, ci, deps
Example: feat(api): add weight category endpoint
-->

## Summary

<!-- 1-3 sentences: what this PR changes and WHY. Link the issue if any. -->

Closes #

## Changes

<!-- Bullet list of the most relevant changes. -->

-
-

## Screenshots / Recordings

<!-- For UI changes only. Drop images or links. Delete if N/A. -->

## How to test

<!-- Step-by-step instructions for the reviewer. -->

1.
2.

## Reviewer checklist

> Source of truth: `CLAUDE.md` → "Reviewer Checklist".

### Backend (NestJS)
- [ ] No business logic in controllers (service layer only)
- [ ] DTOs have proper `class-validator` decorators
- [ ] Protected endpoints use `JwtAuthGuard` + `@Roles()` where needed
- [ ] No `console.log` in backend production code (use NestJS `Logger`)
- [ ] TypeORM entity changes include a generated migration

### Frontend (Next.js)
- [ ] React Query for data fetching, not direct fetch/axios
- [ ] All UI text uses `next-intl` (`t('key')`), no hardcoded strings
- [ ] Public pages are server-rendered (SSR) for SEO

### Quality
- [ ] New logic has corresponding `*.spec.ts` tests
- [ ] ESLint + Prettier pass (`npx turbo lint`)
- [ ] Typecheck passes (`npx turbo typecheck`)
- [ ] No hardcoded secrets or API keys
- [ ] Changes comply with architecture docs in `docs/`

### Documentation
- [ ] `docs/STATUS.md` updated if a row's status flag changed
- [ ] Relevant numbered doc (`docs/0X-*.md`) updated if architecture / API / schema changed
- [ ] New ADR added to `docs/adr/` for any non-obvious architectural decision
- [ ] New runbook added to `docs/runbooks/` for any new operational procedure

## Notes for reviewer

<!-- Anything the reviewer should know: tradeoffs, follow-ups, known limits. -->
