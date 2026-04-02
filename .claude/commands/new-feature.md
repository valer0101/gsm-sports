---
allowed-tools: Bash(git checkout*), Bash(git branch*), Bash(git status*), Bash(mkdir*)
description: Scaffold a new NestJS feature module with controller, service, module, and DTO. Usage: /new-feature <name>
---

Create a new NestJS feature module following the project conventions.

## Input
The user provides a feature name (e.g., "rankings", "videos", "live-streams").

## Steps

1. Create a new git branch from main:
   ```
   git checkout main
   git pull
   git checkout -b feature/<feature-name>
   ```

2. Create the module directory structure in the monorepo:
   ```
   apps/api/src/<feature-name>/
   ├── <feature-name>.module.ts
   ├── <feature-name>.controller.ts
   ├── <feature-name>.service.ts
   ├── <feature-name>.controller.spec.ts
   ├── <feature-name>.service.spec.ts
   ├── dto/
   │   └── create-<feature-name>.dto.ts
   └── entities/
       └── <feature-name>.entity.ts
   ```

3. Generate files following these patterns:

   **Entity** (`entities/<feature-name>.entity.ts`):
   - Use TypeORM decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn('uuid')`)
   - Add `created_at` and `updated_at` timestamps
   - Define relations with other entities if needed

   **Module** (`<feature-name>.module.ts`):
   - Import `TypeOrmModule.forFeature([Entity])` for database access
   - Register controller and service
   - Export service if other modules may need it

   **Controller** (`<feature-name>.controller.ts`):
   - Route prefix: `@Controller('v1/<feature-name>')`
   - Use `@UseGuards(JwtAuthGuard)` on protected endpoints
   - Use `@Roles()` decorator for role-based access
   - NO business logic — only call service methods
   - Use DTOs for request bodies
   - Use `@Request() req` to get authenticated user

   **Service** (`<feature-name>.service.ts`):
   - `@Injectable()` decorator
   - Inject repository via `@InjectRepository(Entity)`
   - Use `private logger = new Logger(<ClassName>.name)` for logging
   - All business logic goes here

   **DTO** (`dto/create-<feature-name>.dto.ts`):
   - Use `class-validator` decorators (`@IsString`, `@IsOptional`, etc.)
   - Add Swagger decorators (`@ApiProperty`)

   **Tests** (`*.spec.ts`):
   - Basic test setup with `@nestjs/testing`
   - Test that controller and service are defined

4. Register the new module in `apps/api/src/app.module.ts` imports array.

5. If the feature needs shared types, create them in `packages/shared-types/src/<feature-name>.ts`.

6. Show the user what was created and suggest next steps:
   - Add TypeORM migration for the entity
   - Implement service methods
   - Add DTOs with validation decorators
   - Write more specific tests
   - Add frontend page in `apps/web/`
