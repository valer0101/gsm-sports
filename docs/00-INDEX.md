# GSM Sports Platform — Documentation Index

> Last updated: 8 May 2026 · Update this header whenever a major doc changes.

## Quick navigation

| Doc | Purpose | When to read |
|-----|---------|--------------|
| [STATUS.md](./STATUS.md) | One-page system-by-system "what's done / what's not" | First read; before planning any change |
| [ROADMAP.md](./ROADMAP.md) | Phased delivery plan + current position | Quarterly planning; before scoping new work |
| [01-VISION.md](./01-VISION.md) | Project vision, modules, roles, MVP scope | New team member onboarding |
| [02-TECH-STACK.md](./02-TECH-STACK.md) | Stack choices and monorepo structure | Picking up a new area of the codebase |
| [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md) | 16 tables, indices, JSONB shapes | Before writing a migration or new entity |
| [04-API-DESIGN.md](./04-API-DESIGN.md) | REST endpoints + WebSocket events | Adding or consuming an endpoint |
| [05-PAGES-AND-UI.md](./05-PAGES-AND-UI.md) | Sitemap + design system handoff | Building or changing a page |
| [06-MIGRATION-PLAN.md](./06-MIGRATION-PLAN.md) | Phase 0 → 4 implementation roadmap | Long-term planning |
| [07-SECURITY-AND-AUTH.md](./07-SECURITY-AND-AUTH.md) | JWT, OAuth, RBAC, password rules | Anything touching auth |
| [08-DEPLOYMENT.md](./08-DEPLOYMENT.md) | Docker, hosting, scaling | Deploying to a new environment |
| [09-TESTING-STRATEGY.md](./09-TESTING-STRATEGY.md) | Test pyramid, coverage targets | Before adding tests |
| [10-CI-CD.md](./10-CI-CD.md) | GitHub Actions, branch protection | Tweaking workflows |
| [adr/](./adr/) | Architecture Decision Records (one per choice) | Why was X chosen? |
| [runbooks/](./runbooks/) | Operational procedures | When something is on fire |

## What this is and isn't

**Documentation as code.** Every doc here is checked into the repo, reviewed in PRs, and lives next to the code it describes. Update docs in the same PR as the code change — there's a checkbox in the PR template enforcing that.

**Living, not aspirational.** `STATUS.md` reflects what is actually built; `ROADMAP.md` reflects what's planned. Don't conflate.

## Current state — short version

The project is a multi-sport tournament platform (armwrestling first, combat sports next). Core MVP is built: NestJS API with 19 modules, Next.js 15 web app with React Query, TypeORM + PostgreSQL, Telegram bot, full bracket engine for 6 formats (single elim, double elim, round robin, Swiss, groups + playoff, armfight), Socket.io live updates. CI/CD with GitHub Actions, security scans, dependabot.

Coverage at time of writing: bracket-engine 98% / 90.4% branch · api 446 unit tests · web 104 unit tests · 0 E2E.

For a complete grid of what's done vs not, see **[STATUS.md](./STATUS.md)**.

## How to use these docs

- **New contributor?** Read 01 → 02 → STATUS.md, then dive into the area you're touching.
- **Adding a feature?** Check STATUS.md for the area's current state; check ROADMAP.md for the phase it belongs to; update the relevant numbered doc in the same PR.
- **Production incident?** Check `runbooks/` first.
- **Why was X done this way?** Check `adr/`. If there's no ADR for a non-obvious decision, write one.

## Style rules for this folder

- Use 🟢 Done / 🟡 Partial / 🔴 Planned / ⚫ Out of scope status flags consistently in STATUS, ROADMAP, and any per-feature checklist.
- Cross-link generously between docs (relative paths).
- Keep the front of each doc summarising **why** it exists; structure follows.
- When updating, also bump the "Last updated" line at the top.
