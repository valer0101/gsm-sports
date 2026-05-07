# GSM Sports Platform — Project Conventions

## Tech Stack

- **Backend:** NestJS (TypeScript), TypeORM, PostgreSQL, Redis
- **Frontend:** Next.js 14+ (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Monorepo:** Turborepo with npm workspaces
- **Auth:** JWT + Passport.js (Local, Google OAuth)
- **Real-time:** Socket.io (live brackets, match updates)
- **Bracket Engine:** Shared package (`packages/bracket-engine`) — double-elimination logic
- **i18n:** next-intl (Russian, English, Armenian)
- **Testing:** Vitest
- **ORM:** TypeORM with migrations (NOT Prisma)

## Monorepo Structure

```
gsm-sports/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── api/                    # NestJS backend
├── packages/
│   ├── bracket-engine/         # Double-elimination bracket logic
│   ├── shared-types/           # TypeScript types shared between apps
│   └── config/                 # Shared ESLint, TSConfig, Prettier
└── docs/                       # Architecture documentation
```

## Commands

```bash
# Root (monorepo)
npx turbo dev                # Start all dev servers
npx turbo build              # Build all apps
npx turbo lint               # Lint all apps
npx turbo test               # Run all tests

# Backend (apps/api)
cd apps/api
npm run dev                  # NestJS dev server (watch mode)
npm run build                # Production build
npm run test                 # Unit tests (Vitest)
npm run test:e2e             # E2E tests
npm run migration:generate   # Generate TypeORM migration
npm run migration:run        # Run migrations

# Frontend (apps/web)
cd apps/web
npm run dev                  # Next.js dev server
npm run build                # Production build
npm run lint                 # ESLint

# Bracket Engine (packages/bracket-engine)
cd packages/bracket-engine
npm run test                 # Unit tests
npm run build                # Build package
```

## Backend Conventions (NestJS)

### Module Structure
Every feature module follows this pattern:
```
apps/api/src/<module-name>/
├── <module-name>.module.ts          # Module definition
├── <module-name>.controller.ts      # HTTP endpoints only — no business logic
├── <module-name>.service.ts         # Business logic lives here
├── <module-name>.controller.spec.ts # Controller tests
├── <module-name>.service.spec.ts    # Service tests
├── dto/                             # Data Transfer Objects
│   ├── create-<module-name>.dto.ts
│   └── update-<module-name>.dto.ts
└── entities/                        # TypeORM entities
    └── <module-name>.entity.ts
```

### Rules
- **No business logic in controllers.** Controllers must only call service methods and return results. Validation, conditionals on domain state, and calculations belong in services.
- **DTOs required** for all request bodies. Use `class-validator` decorators for validation. Use `@ApiProperty()` for Swagger documentation.
- **Use `@Injectable()` services**, inject dependencies via constructor.
- **Error handling:** Throw `HttpException` with appropriate `HttpStatus` codes. Do not catch errors just to re-throw with a generic message.
- **Auth guards:** Use `@UseGuards(JwtAuthGuard)` on protected endpoints. Use `@Roles()` decorator for role-based access. Mark public endpoints with `@Public()`.
- **Database access:** Use TypeORM repositories via `@InjectRepository(Entity)`. No raw SQL queries with string concatenation. Use QueryBuilder for complex queries.
- **Logging:** Use NestJS `Logger` class (`private logger = new Logger(ClassName.name)`). Do not use `console.log` in production code.
- **Naming:** Files — `kebab-case`, classes — `PascalCase`, methods/variables — `camelCase`.
- **API versioning:** All routes prefixed with `v1/` (e.g., `@Controller('v1/tournaments')`).
- **Pagination:** All list endpoints support `?page=1&limit=20`. Max limit: 100.
- **Multi-language fields:** Use separate columns per language (`title_ru`, `title_en`, `title_hy`).

### TypeORM Conventions
- Entities use `@PrimaryGeneratedColumn('uuid')` for IDs.
- Always include `created_at` and `updated_at` timestamp columns.
- Use `@Index()` on columns used in filters and sorting.
- Use JSONB for flexible/sport-specific data (`sport_config`, `bracket_data`, `social_links`).
- Migrations are generated, never hand-written: `npx typeorm migration:generate`.
- Never edit already-applied migrations. Create new ones instead.

## Frontend Conventions (Next.js)

### Architecture
```
apps/web/
├── app/                     # App Router pages
│   ├── [locale]/            # i18n routing
│   │   ├── page.tsx         # Home page
│   │   ├── tournaments/     # Tournament pages
│   │   ├── athletes/        # Athlete pages
│   │   ├── news/            # News pages
│   │   ├── rankings/        # Rankings pages
│   │   ├── auth/            # Login/Register
│   │   └── admin/           # Admin panel
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/              # Reusable UI components
│   ├── ui/                  # shadcn/ui components
│   └── ...                  # Feature components
├── lib/                     # Utilities
│   ├── api.ts               # API client (Axios)
│   ├── auth.ts              # Auth utilities
│   └── utils.ts             # Helpers
├── hooks/                   # Custom React hooks
├── stores/                  # Zustand stores
└── messages/                # i18n translation files
    ├── ru.json
    ├── en.json
    └── hy.json
```

### Rules
- **Data fetching:** Use React Query (TanStack Query) for all API calls. No direct `fetch()` or `axios` in components.
- **State management:** Use Zustand for client-side state (auth, UI). No Redux.
- **Forms:** Use React Hook Form + Zod for validation. No uncontrolled forms for data entry.
- **Styling:** Tailwind CSS + shadcn/ui components. No inline styles. No CSS modules.
- **i18n:** All user-facing text must go through `next-intl` (`t('key')`). No hardcoded strings in JSX.
- **Images:** Use `next/image` for all images (automatic optimization).
- **Links:** Use `next/link` for all internal navigation.
- **SSR:** Public pages (news, rankings, athletes, tournaments) must be server-rendered for SEO.
- **Admin pages:** Client-side only, protected by auth middleware.
- **Loading states:** Use Skeleton components for async data. No empty screens.
- **Error states:** Always handle error/empty states in data-fetching components.

## Bracket Engine (packages/bracket-engine)

- Pure TypeScript, no framework dependencies.
- Core functions: `generateDoubleElimination()`, `selectWinner()`, `propagateResults()`.
- Must have **90%+ test coverage** — this is critical business logic.
- Exported as an npm package, used by both `apps/api` and `apps/web`.

## Database (TypeORM + PostgreSQL)

- Schema defined via TypeORM entities in `apps/api/src/**/entities/*.ts`.
- Full schema documentation: `docs/03-DATABASE-SCHEMA.md`.
- After entity changes, generate migration: `cd apps/api && npx typeorm migration:generate`.
- Use TypeORM transactions for multi-step DB operations.
- Use `JSONB` columns for sport-specific configurations.
- Full-text search via PostgreSQL `tsvector` for news and athletes.

## API Design

- Full API documentation: `docs/04-API-DESIGN.md`.
- REST API with base path `/v1/`.
- Standard error format: `{ statusCode, error, message, details }`.
- Auth: Bearer JWT in `Authorization` header. Tokens stored in httpOnly cookies.
- Localization: `Accept-Language` header (ru | en | hy).
- Rate limiting: 100 req/min (general), 10 req/15min (auth endpoints).

## Security

- Full security documentation: `docs/07-SECURITY-AND-AUTH.md`.
- Passwords: bcrypt (12 rounds), minimum 8 chars.
- Tokens: httpOnly cookies, never localStorage.
- CORS: whitelist frontend domain only.
- Validation: class-validator on backend, Zod on frontend. Validate at boundaries.
- File uploads: check MIME type, limit size, generate UUID filenames.
- No secrets in code or logs. Use `.env` (never committed).

## Testing

- Full testing strategy: `docs/09-TESTING-STRATEGY.md`.
- Framework: **Vitest** (not Jest).
- Test files: `*.spec.ts`, colocated next to source files.
- Mock external dependencies only, never the service under test.
- Use `vi.fn()` (not `jest.fn()`), `vi.mock()`, `mockResolvedValue`.
- Backend: mock TypeORM repositories via `getRepositoryToken()`.
- Bracket engine: 90%+ coverage required.
- Run: `npx turbo test` (all), `npx vitest run` (specific package).

## Linting

- ESLint 9 (flat config) + Prettier.
- Shared config in `packages/config/`.
- Run: `npx turbo lint` (must pass before merge).

## Git Workflow

- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`
- Commit format: `<type>(<scope>): <description>` (English, lowercase, no period, under 72 chars)
- Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`
- Scopes: `api`, `web`, `bracket`, `db`, `auth`, `i18n`
- PR required for all merges to `main`.

## Architecture Documentation

Detailed architecture docs are in `docs/`:
- [Vision & Overview](docs/01-VISION.md) — project scope, modules, roles, roadmap
- [Tech Stack](docs/02-TECH-STACK.md) — technology choices, monorepo structure
- [Database Schema](docs/03-DATABASE-SCHEMA.md) — 16 tables with SQL, indices
- [API Design](docs/04-API-DESIGN.md) — 60+ REST endpoints with examples
- [Pages & UI](docs/05-PAGES-AND-UI.md) — sitemap, wireframes, design system
- [Migration Plan](docs/06-MIGRATION-PLAN.md) — phased implementation plan
- [Security & Auth](docs/07-SECURITY-AND-AUTH.md) — JWT flow, OAuth, RBAC
- [Deployment](docs/08-DEPLOYMENT.md) — Docker, CI/CD, monitoring, scaling
- [Testing Strategy](docs/09-TESTING-STRATEGY.md) — test pyramid, coverage goals
- [CI / CD](docs/10-CI-CD.md) — GitHub Actions, branch protection, security scanning

When making significant architectural changes, update the relevant doc in `docs/`.

## Reviewer Checklist
- [ ] No business logic in controllers (service layer only)
- [ ] DTOs have proper `class-validator` decorators
- [ ] Protected endpoints use `JwtAuthGuard` + `@Roles()` where needed
- [ ] No `console.log` in backend production code (use NestJS `Logger`)
- [ ] New logic has corresponding `*.spec.ts` tests
- [ ] ESLint + Prettier pass (`npx turbo lint`)
- [ ] TypeORM entity changes include a generated migration
- [ ] Frontend uses React Query for data fetching, not direct fetch/axios
- [ ] All UI text uses `next-intl` (`t('key')`), no hardcoded strings
- [ ] No hardcoded secrets or API keys
- [ ] Public pages are server-rendered (SSR) for SEO
- [ ] Changes comply with architecture docs in `docs/`

## Testing & Quality Roadmap

Order of work, agreed with the team. Do tasks in sequence, do not skip ahead.

1. **CI/CD setup** — GitHub Actions (lint, typecheck, build, test, security). _Done in branch `claude/automate-code-review-merge-IsfGO`._
2. **Bracket-engine coverage to 90%+** — `packages/bracket-engine` is critical business logic. Currently has 1 spec file, needs full coverage of `generateDoubleElimination()`, `selectWinner()`, `propagateResults()`.
3. **Web unit/utility tests** — extend coverage in `apps/web` (only `slug.spec.ts` and `prize-calc.spec.ts` exist today).
4. **Component tests on critical UI** — once auth and tournament-creation flows stabilize, add `@testing-library/react` tests on login form, registration form, tournament builder.
5. **E2E with Playwright** — last. Only after MVP UI is frozen and at least one critical flow has shipped to prod. 3-5 scenarios max: login → create tournament → register athlete → run match → view bracket.

Do NOT add Playwright/Cypress before step 4 is in progress — empty E2E suites in CI are cargo cult.

## Known Mistakes — Do Not Repeat

<!-- This section is auto-updated after /code-review finds recurring issues. -->
<!-- Claude reads this before writing code to avoid past mistakes. -->

_No entries yet. After code reviews, recurring issues will be added here._

---

## Legacy Code (Current SPA)

The current codebase (`src/`) is a React 19 + Vite SPA that will be migrated to the new monorepo structure. Key files:

- `src/bracket/bracketLogic.js` → will become `packages/bracket-engine` (TypeScript)
- `src/storage/storage.js` → will be replaced by TypeORM + PostgreSQL
- `src/pages/*` → will be rewritten as Next.js pages in `apps/web/`
- `src/components/*` → will be rewritten with Tailwind + shadcn/ui
- `src/i18n/` → translations will migrate to `next-intl` format

During migration, both old (`src/`) and new (`apps/`) code may coexist temporarily.
