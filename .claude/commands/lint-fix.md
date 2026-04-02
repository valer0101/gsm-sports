---
allowed-tools: Bash(npx eslint*), Bash(npx prettier*), Bash(npm run lint*), Bash(git diff*), Bash(git status*), Bash(npx turbo*)
description: Auto-fix ESLint and Prettier issues. Usage: /lint-fix [app-name] or /lint-fix --all
---

Auto-fix linting and formatting issues across the monorepo.

## Modes

### 1. Changed files only (default)

**Usage:** `/lint-fix`

Fix only files changed on the current branch vs main:
```
git diff main...HEAD --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx'
```

If no branch changes, fix files changed in working tree:
```
git diff --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx'
```

For each changed file, run:
```
npx eslint --fix <file>
npx prettier --write <file>
```

### 2. Specific app/package

**Usage:** `/lint-fix api` or `/lint-fix web` or `/lint-fix bracket-engine`

- `api` → `cd apps/api && npx eslint --fix "src/**/*.ts" && npx prettier --write "src/**/*.ts"`
- `web` → `cd apps/web && npx eslint --fix "**/*.{ts,tsx}" && npx prettier --write "**/*.{ts,tsx}"`
- `bracket-engine` → `cd packages/bracket-engine && npx eslint --fix "src/**/*.ts" && npx prettier --write "src/**/*.ts"`

### 3. Entire monorepo

**Usage:** `/lint-fix --all`

```
npx turbo lint -- --fix
npx prettier --write "**/*.{ts,tsx,js,jsx}"
```

Warn the user this may take a while.

## Output

- Show count of files fixed
- Show count of remaining issues that couldn't be auto-fixed
- If there are unfixable issues, list them with file:line
- Suggest running `/commit` to save the fixes
