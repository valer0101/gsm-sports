---
allowed-tools: Bash(git checkout*), Bash(git branch*), Bash(git status*), Bash(mkdir*)
description: Scaffold a new NestJS feature module with controller, service, module, and DTO
---

Create a new NestJS feature module in the GSM Sports monorepo.

## Input
Feature name (e.g., "rankings", "videos", "live-streams").

## Steps

1. Create branch: `git checkout -b feature/<name>` from main.

2. Create structure in `apps/api/src/<name>/`:
   - `<name>.module.ts` — TypeOrmModule.forFeature([Entity])
   - `<name>.controller.ts` — `@Controller('v1/<name>')`, guards, DTOs
   - `<name>.service.ts` — `@Injectable()`, `@InjectRepository()`, Logger
   - `entities/<name>.entity.ts` — TypeORM entity
   - `dto/create-<name>.dto.ts` — class-validator decorators
   - `*.spec.ts` — basic tests

3. Register module in `apps/api/src/app.module.ts`.

4. Create shared types in `packages/shared-types/` if needed.

5. Suggest next steps: migration, implement methods, add DTOs, write tests.
