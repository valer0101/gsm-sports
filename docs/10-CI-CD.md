# CI / CD

GitHub Actions workflows live in `.github/workflows/`. This doc explains what
each workflow does and the one-time GitHub UI configuration required to make
the setup enforce quality on `main`.

## Workflows

### `ci.yml` — gate for every PR
Triggered on `pull_request` to `main` and on `push` to `main`.

Jobs (parallel):
- **lint** — `npx turbo run lint` (ESLint across all workspaces)
- **typecheck** — `npx turbo run typecheck` (`tsc --noEmit`)
- **build** — `npx turbo run build` (NestJS, Next.js, all packages)
- **test** — `npx turbo run test` (Vitest, unit only)
- **ci-success** — aggregate gate that depends on all of the above

Caches: `node_modules` keyed on `package-lock.json` (single `npm ci` for the
whole pipeline) and per-task Turbo cache.

### `security.yml` — vulnerability scanning
Triggered on PR, push to `main`, and weekly (Mondays 06:00 Yerevan).

Jobs:
- **codeql** — GitHub's static analysis with `security-extended` queries
- **dependency-review** — blocks PRs that introduce high-severity CVEs
- **npm-audit** — fails on high+ vulnerabilities in production deps
- **secret-scan** — gitleaks scan of the full git history

### `pr-lint.yml` — PR title quality
Validates the PR title matches conventional commits:
`<type>(<scope>): <description>`. Allowed types and scopes are documented in
`CLAUDE.md` § Git Workflow.

## Dependabot — `.github/dependabot.yml`

Weekly PRs (Mondays 06:00 Yerevan) for npm and GitHub Actions updates.
Patch + minor are grouped; majors are ignored and must be done manually.

## CODEOWNERS — `.github/CODEOWNERS`

Auto-assigns reviewers based on the changed paths. Today everything is owned
by `@valer0101`; replace with team handles when the team grows.

## PR template — `.github/PULL_REQUEST_TEMPLATE.md`

Mirrors the Reviewer Checklist from `CLAUDE.md` so authors self-check before
asking for review.

---

## Required GitHub UI configuration (one-time)

These cannot be configured in code; an admin must do them in the repo settings.

### 1. Branch protection on `main`

`Settings → Branches → Add rule` (or `Edit`) for `main`:

- ☑ Require a pull request before merging
  - ☑ Require approvals: **1**
  - ☑ Dismiss stale pull request approvals when new commits are pushed
  - ☑ Require review from Code Owners
- ☑ Require status checks to pass before merging
  - ☑ Require branches to be up to date before merging
  - **Required checks** (search and add):
    - `CI Success` (from `ci.yml`)
    - `CodeQL` (from `security.yml`)
    - `Conventional commit title` (from `pr-lint.yml`)
- ☑ Require conversation resolution before merging
- ☑ Require linear history
- ☑ Do not allow bypassing the above settings

### 2. Default merge strategy

`Settings → General → Pull Requests`:

- ☑ Allow squash merging — **set as default**
- ☐ Allow merge commits
- ☐ Allow rebase merging
- ☑ Automatically delete head branches

### 3. Code scanning

`Settings → Code security`:

- ☑ Enable Dependabot alerts
- ☑ Enable Dependabot security updates
- ☑ Enable secret scanning + push protection

### 4. Actions permissions

`Settings → Actions → General`:

- Workflow permissions: **Read repository contents and packages permissions**
- ☑ Allow GitHub Actions to create and approve pull requests (needed for
  Dependabot auto-merge if you enable it later)

---

## Local equivalents

Run the same checks before pushing:

```bash
npx turbo lint
npx turbo typecheck
npx turbo build
npx turbo test
```

---

## Future additions (do not add yet)

See the **Testing & Quality Roadmap** section in `CLAUDE.md`.

- Component tests on critical UI flows (after auth/tournament UI stabilizes)
- Playwright E2E (after MVP ships first critical flow to prod)
- Codecov upload (when meaningful coverage exists)
- Docker image build & push to a registry (when deploy target is chosen)
