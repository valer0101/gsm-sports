---
allowed-tools: Bash(git diff*), Bash(git status*)
description: Find and fix CLAUDE.md violations in changed files (console.log, business logic in controllers, missing guards)
---

Scan changed files for violations and fix them.

## Scope
Only files modified on current branch vs main.

## Backend checks (apps/api/src/):
1. `console.log` → NestJS Logger
2. Business logic in controllers → report (move to service)
3. Missing AuthGuard on endpoints → report
4. Missing DTOs (inline body types) → report
5. Raw SQL queries → report (use TypeORM repository)

## Frontend checks (apps/web/):
6. Direct fetch/axios calls → report (use React Query)
7. Hardcoded UI strings → report (use next-intl `t()`)

## Output
- Count of auto-fixed issues
- List of manual fixes needed
- Suggest `/commit` to save fixes
