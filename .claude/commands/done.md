---
allowed-tools: Bash(git diff*), Bash(git status*), Bash(npx vitest*), Bash(npx turbo*), Bash(grep*), Bash(find*), Bash(wc*)
description: Show next steps after finishing a task. Checks test coverage and shows the workflow order. Use when user says "done", "готово", "что дальше".
---

The user finished coding. Analyze what they changed and guide them through the next steps.

## Steps

### 1. Find changed modules

Get all changed files on the current branch vs main:
```
git diff main...HEAD --name-only
```

If no branch changes, use working tree:
```
git diff --name-only
git status --short
```

Categorize changes:
- `apps/api/src/<module>/` → backend module
- `apps/web/` → frontend changes
- `packages/bracket-engine/` → bracket logic
- `packages/shared-types/` → shared types

### 2. Check for entity changes

```
git diff main...HEAD --name-only -- 'apps/api/src/**/entities/*.ts'
```

If changed, add a warning:
```
⚠️ Entities изменены! Запусти: /db-migrate <migration-name>
```

### 3. Check test coverage for changed backend modules

For each changed module in `apps/api/src/<module>/`:

1. Does `<module>.service.spec.ts` exist?
2. Does `<module>.controller.spec.ts` exist?
3. If spec exists, count `it(` or `test(` calls — if only 1, mark as ⚠️ skeleton

Classify:
- ✅ **Good** — spec exists with 2+ tests
- ⚠️ **Skeleton** — spec exists but only "should be defined"
- ❌ **Missing** — no spec file

### 4. Check bracket engine

If `packages/bracket-engine/` was changed, check if tests exist and pass:
```
cd packages/bracket-engine && npx vitest run --reporter=verbose 2>&1 | tail -5
```

### 5. Show results

```
Изменённые области:

Backend:
  ⚠️ rankings — только скелет теста! Запусти: /test generate rankings
  ❌ videos — нет тестов! Запусти: /test generate videos
  ✅ auth — 12 тестов
  ✅ tournaments — 8 тестов

Frontend:
  ✅ apps/web — 3 файла изменены

Bracket Engine:
  ✅ 15 тестов, все проходят

Порядок действий:
1. /db-migrate <name>       — применить миграцию (если entities изменены)
2. /test generate <module>  — создать тесты (если есть ⚠️ или ❌)
3. /lint-fix                — исправить форматирование
4. /cleanup                 — проверить конвенции CLAUDE.md
5. /test                    — запустить все тесты
6. /commit                  — закоммитить
7. /pr                      — создать pull request
```

### 6. Other commands

Always show at the end:
```
Другие команды:
- /test check              — полный аудит покрытия тестами
- /branch <name>           — начать новую задачу
- /code-review <PR#>       — ревью pull request
```

## Important

- Do NOT run any fixes automatically — only show what to do
- Do NOT modify any files
- Keep output concise and in Russian
