---
allowed-tools: Bash(npx vitest*), Bash(npx jest*), Bash(npm run test*), Bash(npx turbo*), Bash(git diff*), Bash(git status*)
description: Run tests or generate missing test files. Usage: /test [module], /test generate [module], /test check
---

Run or generate tests following project conventions.

## Modes

### 1. Run tests (default)

**Usage:** `/test` or `/test <module-name>`

- No argument → run ALL tests:
  ```
  npx turbo test
  ```
- With module name → run tests for that module:
  - Backend: `cd apps/api && npx vitest run --reporter=verbose src/<module-name>/`
  - Bracket engine: `cd packages/bracket-engine && npx vitest run`
  - Frontend: `cd apps/web && npx vitest run`
- Add `--coverage` if user asks for coverage report

**Output format:**
- Show pass/fail summary
- If failures: show failing test name + error message
- If all pass: show count of passed tests

### 2. Generate tests

**Usage:** `/test generate <module-name>`

Find services and controllers in `apps/api/src/<module-name>/` that are missing spec files, and generate proper tests.

**Steps:**

1. Read the source file to understand:
   - All public methods
   - Constructor dependencies (injected services/repositories)
   - Return types and error cases

2. Generate spec files using Vitest pattern:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceName } from './<module>.service';
import { Entity } from './entities/<entity>.entity';

describe('ServiceName', () => {
  let service: ServiceName;
  let repository: jest.Mocked<Repository<Entity>>;

  const mockRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: getRepositoryToken(Entity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Generate tests for each public method...
});
```

**Rules:**
- Mock ALL external dependencies (repositories, other services, ConfigService)
- Test both success and error paths
- Use `vi.fn()` for mocks (Vitest, not Jest)
- Do NOT mock the service being tested

### 3. Check coverage gaps

**Usage:** `/test check`

Scan all modules and report test coverage:

```
Module              | Service Spec | Controller Spec | Status
--------------------|-------------|-----------------|--------
auth                | ✅ 12 tests  | ✅ 5 tests      | Good
tournaments         | ⚠️ skeleton  | ❌ missing       | Needs work
rankings            | ❌ missing   | ❌ missing       | No tests
```

## Important

- NEVER modify source code — only create/update spec files
- Always run generated tests to verify they pass
- If generated tests fail, fix the test (not the source code)
