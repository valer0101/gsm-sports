# GSM Sports Platform — Testing Strategy

## 1. Пирамида тестов

```
          ▲
         /E\         E2E Tests (Playwright)
        /2E \        5-10% — критические user flows
       /─────\
      / Integ \      Integration Tests
     / ration  \     20-30% — API endpoints, DB queries
    /───────────\
   /    Unit     \   Unit Tests (Vitest)
  /    Tests      \  60-70% — бизнес-логика, утилиты
 /─────────────────\
```

---

## 2. Unit Tests

### Инструменты
- **Vitest** — быстрый, совместим с Vite/TS
- **Testing Library** — для React компонентов

### Что тестируем:
```
packages/bracket-engine/
  ├── generateDoubleElimination() — генерация сеток
  ├── selectWinner() — запись результатов
  ├── propagateResults() — продвижение по сетке
  └── edge cases: 2 игрока, нечётное число, bye handling

apps/api/
  ├── Services — бизнес-логика (tournament.service, ranking.service)
  ├── DTOs — валидация входных данных
  ├── Guards — проверка ролей, прав доступа
  └── Utils — хелперы, форматирование

apps/web/
  ├── Components — рендеринг, интерактивность
  ├── Hooks — кастомные хуки
  └── Utils — форматирование, валидация форм
```

### Пример unit теста:

```typescript
// packages/bracket-engine/__tests__/generate.test.ts
import { describe, it, expect } from 'vitest';
import { generateDoubleElimination } from '../src';

describe('generateDoubleElimination', () => {
  it('should create correct bracket for 4 players', () => {
    const players = [
      { id: '1', firstName: 'A', lastName: 'A' },
      { id: '2', firstName: 'B', lastName: 'B' },
      { id: '3', firstName: 'C', lastName: 'C' },
      { id: '4', firstName: 'D', lastName: 'D' },
    ];

    const bracket = generateDoubleElimination(players);

    expect(bracket.bracketSize).toBe(4);
    expect(bracket.winnersBracket[0]).toHaveLength(2); // 2 матча в 1 раунде
    expect(bracket.grandFinal).toBeDefined();
    expect(bracket.champion).toBeNull();
  });

  it('should handle odd number of players with byes', () => {
    const players = [
      { id: '1', firstName: 'A', lastName: 'A' },
      { id: '2', firstName: 'B', lastName: 'B' },
      { id: '3', firstName: 'C', lastName: 'C' },
    ];

    const bracket = generateDoubleElimination(players);

    expect(bracket.bracketSize).toBe(4); // rounded up
    // One match should have a bye
    const firstRound = bracket.winnersBracket[0];
    const hasBye = firstRound.some(m =>
      m.player1?.id === 'bye' || m.player2?.id === 'bye'
    );
    expect(hasBye).toBe(true);
  });

  it('should throw for less than 2 players', () => {
    expect(() => generateDoubleElimination([
      { id: '1', firstName: 'A', lastName: 'A' },
    ])).toThrow();
  });
});
```

---

## 3. Integration Tests (API)

### Инструменты
- **Vitest** + **supertest** — HTTP тесты
- **NestJS Testing Module** — мок DI
- **Test database** — отдельная PostgreSQL БД для тестов

### Что тестируем:
```
Auth:
  ├── Регистрация → создаёт user + возвращает tokens
  ├── Логин → проверяет пароль, возвращает tokens
  ├── Refresh → обновляет tokens
  ├── Protected route без токена → 401
  └── Protected route с неверной ролью → 403

Tournaments:
  ├── Создание турнира (organizer role)
  ├── Запись на турнир (athlete role)
  ├── Генерация сетки
  ├── Запись результата матча → propagation
  └── Фильтрация и пагинация

News:
  ├── CRUD (admin only)
  ├── Публичный доступ к published
  ├── Полнотекстовый поиск
  └── Фильтрация по тегам
```

### Пример:

```typescript
// apps/api/test/tournament.e2e-spec.ts
describe('Tournaments API', () => {
  let app: INestApplication;
  let organizerToken: string;
  let athleteToken: string;

  beforeAll(async () => {
    // Setup test app with test database
    app = await createTestApp();
    organizerToken = await loginAs('organizer');
    athleteToken = await loginAs('athlete');
  });

  describe('POST /tournaments', () => {
    it('organizer can create tournament', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Test Tournament',
          sportSlug: 'armwrestling',
          startDate: '2025-06-01T10:00:00Z',
          format: 'double_elimination',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Tournament');
      expect(res.body.slug).toBe('test-tournament');
    });

    it('regular user cannot create tournament', async () => {
      const userToken = await loginAs('user');
      const res = await request(app.getHttpServer())
        .post('/v1/tournaments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(403);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## 4. E2E Tests (Browser)

### Инструменты
- **Playwright** — кросс-браузерное тестирование

### Критические flows:
```
1. Регистрация и логин пользователя
2. Регистрация на турнир (athlete)
3. Создание турнира (organizer)
4. Генерация сетки и запись результатов (admin)
5. Просмотр рейтингов
6. Публикация новости (admin)
7. Оставить отзыв/комментарий
8. Смена языка (RU → EN → HY)
```

---

## 5. Команды

```bash
# Unit tests
npm run test                        # Все unit тесты
npm run test:watch                  # Watch mode
npm run test:coverage               # С покрытием

# API integration tests
npm run test:e2e --workspace=apps/api

# Browser E2E tests
npm run test:e2e --workspace=apps/web

# Всё вместе (CI)
npm run test:ci
```

---

## 6. Coverage Goals

| Модуль | Target | Причина |
|--------|--------|---------|
| `bracket-engine` | **90%+** | Критическая бизнес-логика |
| `api/auth` | **85%+** | Безопасность |
| `api/tournaments` | **80%+** | Ключевой функционал |
| `api/news` | **70%+** | Стандартный CRUD |
| `web/components` | **60%+** | UI компоненты |
| **Общее** | **75%+** | Минимальный порог для CI |
