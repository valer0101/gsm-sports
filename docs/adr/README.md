# Architecture Decision Records

Short, focused records of architectural decisions and their reasons. One file per decision.

## Why ADRs

In six months nobody will remember why we chose TypeORM over Prisma, Vitest over Jest, or JWT-in-cookie over local-storage. ADRs prevent the "let's relitigate this every quarter" failure mode and give new contributors a quick way to learn _why_ the codebase looks the way it does.

## Format (Michael Nygard, abbreviated)

Each ADR is a single Markdown file with:

```
# {NNNN}-{slug}.md

Status: Accepted | Superseded by NNNN | Deprecated
Date: YYYY-MM-DD

## Context
What problem? What constraints? What alternatives existed?

## Decision
What we chose, in one paragraph.

## Consequences
What changed. What's now harder. What new trade-offs we accept.
```

## When to write one

- Picking a foundational tool (DB, ORM, test framework, deploy target).
- Choosing between two architecturally meaningful options (e.g. JWT-in-cookie vs JWT-in-localStorage).
- Reversing or replacing a previous ADR — keep the old one with `Status: Superseded by NNNN`.
- Documenting a hard constraint that surfaces in code reviews ("we never use raw SQL because…").

Skip for cosmetic preferences, library version bumps, or one-line code style choices.

## Numbering

Sequential, four digits. New ADRs get the next number. Don't gap or recycle numbers — keep them stable so links don't rot.

## Index

| # | Title | Status |
|---|-------|--------|
| 0001 | [TypeORM over Prisma](./0001-typeorm-over-prisma.md) | Accepted |
| 0002 | [Vitest over Jest](./0002-vitest-over-jest.md) | Accepted |
| 0003 | [Turborepo + npm workspaces](./0003-turborepo-and-npm-workspaces.md) | Accepted |
| 0004 | [JWT in httpOnly cookie](./0004-jwt-in-httponly-cookie.md) | Accepted |
