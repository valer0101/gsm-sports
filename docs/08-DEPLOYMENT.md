# GSM Sports Platform — Deployment & Infrastructure

## 1. Deployment Architecture

```
                        ┌──────────────────┐
                        │   Cloudflare     │
                        │   DNS + CDN      │
                        │   WAF + DDoS     │
                        └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌───▼────┐ ┌────▼──────┐
              │  Vercel   │ │ Railway│ │Cloudflare │
              │  (Next.js)│ │(NestJS)│ │    R2     │
              │  Frontend │ │Backend │ │  (Media)  │
              └───────────┘ └───┬────┘ └───────────┘
                                │
                     ┌──────────┼──────────┐
                     │                     │
               ┌─────▼─────┐        ┌─────▼─────┐
               │ PostgreSQL│        │   Redis   │
               │ (Railway) │        │ (Railway) │
               └───────────┘        └───────────┘
```

---

## 2. Environments (Окружения)

| Окружение | URL | Назначение | Деплой |
|-----------|-----|-----------|--------|
| **Development** | localhost:3000 / :4000 | Локальная разработка | Docker Compose |
| **Staging** | staging.gsmsports.am | Тестирование перед продакшном | Push в `develop` branch |
| **Production** | gsmsports.am | Рабочий сайт | Push в `main` branch |

---

## 3. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gsm_sports
      POSTGRES_USER: gsm_user
      POSTGRES_PASSWORD: gsm_dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://gsm_user:gsm_dev_password@postgres:5432/gsm_sports
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis
    volumes:
      - ./apps/api/src:/app/src  # Hot reload

volumes:
  postgres_data:
  redis_data:
```

---

## 4. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ─── LINT & TYPECHECK ──────────────────────
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  # ─── TESTS ─────────────────────────────────
  test-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: gsm_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run test --workspace=apps/api
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/gsm_test
          REDIS_URL: redis://localhost:6379

  # ─── BUILD ─────────────────────────────────
  build:
    needs: [quality, test-api]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run build

  # ─── DEPLOY (only on main) ────────────────
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel (frontend)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Deploy to Railway (backend)
        run: railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 5. Database Migrations

```bash
# Создание новой миграции
npm run migration:generate --workspace=apps/api -- -n CreateUsersTable

# Запуск миграций
npm run migration:run --workspace=apps/api

# Откат последней миграции
npm run migration:revert --workspace=apps/api

# На production — миграции запускаются автоматически при деплое
# В Dockerfile: CMD ["sh", "-c", "npm run migration:run && node dist/main.js"]
```

### Правила миграций:
- Каждая миграция — один файл с timestamp
- Всегда пишем `up()` И `down()` методы
- Никогда не редактируем уже запущенные миграции
- Деструктивные изменения (DROP) — через 2 шага:
  1. Первый деплой: добавить новое + скопировать данные
  2. Второй деплой: удалить старое

---

## 6. Мониторинг

### Sentry (Ошибки)
```
Frontend: @sentry/nextjs
Backend:  @sentry/nestjs
- Все uncaught exceptions
- Performance monitoring (трассировка запросов)
- Source maps для читаемых стектрейсов
- Алерты в Telegram/Slack при критических ошибках
```

### Health Checks
```
GET /health          → { status: "ok", uptime: 12345 }
GET /health/db       → { status: "ok", latency: "2ms" }
GET /health/redis    → { status: "ok", latency: "1ms" }
```

### Метрики
```
- Response time (p50, p95, p99)
- Error rate
- Active users (online)
- Database query time
- Redis hit/miss ratio
- File upload success rate
```

---

## 7. Backup Strategy

```
PostgreSQL:
  - Автоматический бэкап каждые 6 часов (Railway/managed)
  - Ежедневный pg_dump → Cloudflare R2 (отдельный bucket)
  - Retention: 30 дней daily, 12 месяцев weekly

Redis:
  - RDB snapshots каждые 15 минут
  - Не критично — кэш можно восстановить

Media (R2):
  - Cloudflare R2 имеет 11 девяток durability (99.999999999%)
  - Доп. бэкап не нужен
```

---

## 8. Scaling Plan

### Phase 1 (MVP) — Single Instance
```
Vercel Free/Pro     → Frontend (достаточно)
Railway Hobby       → NestJS (1 instance)
Railway             → PostgreSQL (1GB RAM)
Railway             → Redis (256MB)
Cloudflare R2       → Free tier (10GB)
```
**Стоимость: ~$5-20/мес**

### Phase 2 — Growing
```
Vercel Pro          → Frontend (edge CDN)
Railway Pro         → NestJS (2+ instances, load balanced)
Railway             → PostgreSQL (4GB RAM, connection pooling)
Railway             → Redis (1GB)
Cloudflare R2       → Paid tier
```
**Стоимость: ~$50-100/мес**

### Phase 3 — Scale
```
Vercel Enterprise   → Frontend
AWS ECS / Railway   → NestJS (auto-scaling)
AWS RDS             → PostgreSQL (Multi-AZ, read replicas)
AWS ElastiCache     → Redis cluster
Cloudflare R2       → + CDN cache rules
Mux                 → Live streaming
```
**Стоимость: ~$200-500/мес**

---

## 9. Domain & DNS

```
gsmsports.am           → Vercel (frontend)
api.gsmsports.am       → Railway (backend)
cdn.gsmsports.am       → Cloudflare R2 (media)
staging.gsmsports.am   → Vercel preview
admin.gsmsports.am     → Vercel (тот же Next.js, /admin route)

DNS: Cloudflare (бесплатный план)
SSL: Автоматический через Cloudflare
```
