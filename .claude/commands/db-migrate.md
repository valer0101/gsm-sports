---
allowed-tools: Bash(npm run migration*), Bash(npx typeorm*), Bash(git diff*), Bash(git status*), Bash(cd apps/api*), Bash(npm run*), Bash(npx ts-node*)
description: Create and run TypeORM migrations after entity changes. Usage: /db-migrate [migration-name]
---

Create and run TypeORM migrations after entity changes.

## Steps

### 1. Check for entity changes

Show what changed in entities:
```
git diff -- 'apps/api/src/**/entities/*.ts'
```

If no changes found, also check unstaged:
```
git diff HEAD -- 'apps/api/src/**/entities/*.ts'
```

If still no changes, tell the user: "Нет изменений в entities. Сначала измени или создай entity."

### 2. Generate migration

If the user provided a migration name:
```
cd apps/api && npx typeorm migration:generate src/migrations/<migration-name> -d src/data-source.ts
```

If no name provided, ask the user for a short migration name (e.g., "create-users-table", "add-ranking-points").

### 3. Run migration

```
cd apps/api && npx typeorm migration:run -d src/data-source.ts
```

### 4. Show results

Output:
```
✅ Миграция сгенерирована: <migration-name>
✅ Миграция применена

Изменения:
<краткий список что добавлено/изменено/удалено>

Следующие шаги:
- Проверь миграцию в apps/api/src/migrations/
- Запусти /test чтобы убедиться что ничего не сломалось
- Запусти /commit чтобы закоммитить
```

## Important

- NEVER modify entity files — only generate and run migrations
- If migration fails, show the full error
- Remind user to commit both entities AND the generated migration file
- To revert: `cd apps/api && npx typeorm migration:revert -d src/data-source.ts`
