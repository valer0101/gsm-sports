---
allowed-tools: Bash(git diff*), Bash(git status*)
description: Find and fix CLAUDE.md violations in changed files (console.log, business logic in controllers, missing guards). Use when user says "cleanup", "проверь код", "почисти".
---

Scan changed files for CLAUDE.md violations and fix them.

## Scope
Only scan files modified on the current branch vs main:
```
git diff main...HEAD --name-only
```

If no branch changes, scan working tree changes:
```
git diff --name-only
```

## What to find and fix

### Backend (.ts files in apps/api/src/)

1. **console.log → Logger**
   - Find: `console.log(`, `console.error(`, `console.warn(`
   - Replace with NestJS `Logger`:
     - Add `private logger = new Logger(ClassName.name)` if not present
     - `console.log(...)` → `this.logger.log(...)`
     - `console.error(...)` → `this.logger.error(...)`
     - `console.warn(...)` → `this.logger.warn(...)`

2. **Business logic in controllers**
   - Find: conditionals (`if/else`), calculations, or data transformations in `*.controller.ts`
   - Report to user (don't auto-fix — needs manual refactoring to service)

3. **Missing AuthGuard**
   - Find: endpoints in controllers without `@UseGuards(JwtAuthGuard)` (excluding public endpoints marked with `@Public()`)
   - Report to user

4. **Missing DTOs**
   - Find: `@Body() body: { ... }` inline types instead of proper DTO classes
   - Report to user

5. **Raw SQL**
   - Find: `query(` or string template literals with SQL keywords
   - Report to user — should use TypeORM repository methods

### Frontend (.tsx/.ts files in apps/web/)

6. **Direct fetch calls**
   - Find: `fetch(` or `axios.` calls not wrapped in React Query hooks
   - Report to user — should use `useQuery` / `useMutation`

7. **Hardcoded strings**
   - Find: Russian/Armenian/English text directly in JSX instead of i18n keys
   - Report to user — should use `t('key')` from next-intl

## Output

Show a summary:
- Number of auto-fixed issues
- List of issues that need manual attention
- Suggest running `/commit` to save the fixes
