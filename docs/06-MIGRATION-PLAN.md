# GSM Sports Platform — Migration & Implementation Plan

## Фазы реализации

---

## Phase 0: Подготовка (1 неделя)

### 0.1 Инициализация монорепо
```
1. Создать новый репозиторий gsm-sports
2. Настроить Turborepo
3. Создать workspace-структуру (apps/web, apps/api, packages/*)
4. Настроить TypeScript, ESLint, Prettier
5. Настроить Docker Compose (PostgreSQL, Redis)
6. Настроить GitHub Actions (CI: lint, typecheck, build)
```

### 0.2 Перенос bracket engine
```
1. Создать packages/bracket-engine
2. Переписать bracketLogic.js на TypeScript
3. Добавить типы для всех структур (Match, Bracket, Player)
4. Написать юнит-тесты (Vitest)
5. Экспортировать как npm пакет для использования в web и api
```

---

## Phase 1: MVP — Backend (3-4 недели)

### 1.1 Настройка NestJS
```
Неделя 1:
├── Инициализация NestJS проекта
├── Настройка TypeORM + PostgreSQL
├── Настройка миграций
├── Docker: postgres + redis + nestjs
├── Swagger автодокументация
└── Health check endpoint
```

### 1.2 Auth модуль
```
Неделя 1-2:
├── User entity + миграция
├── POST /auth/register (email + password)
├── POST /auth/login (JWT access + refresh tokens)
├── POST /auth/refresh
├── GET /auth/me
├── Passport JWT strategy
├── Role-based guards (RBAC)
├── Google OAuth (Passport Google strategy)
└── Email verification (Resend)
```

### 1.3 Core модули
```
Неделя 2-3:
├── Sports CRUD (+ seed: armwrestling)
├── Athletes CRUD
├── Tournaments CRUD
├── Weight Categories CRUD
├── Tournament Entries (регистрация на турнир)
├── File upload (Cloudflare R2)
└── Валидация (class-validator)
```

### 1.4 Brackets модуль
```
Неделя 3-4:
├── Интеграция packages/bracket-engine
├── POST /tournaments/:id/brackets/generate
├── PATCH /brackets/:id/matches/:id (запись результатов)
├── GET /tournaments/:id/brackets (полная сетка)
├── WebSocket: bracket live updates
└── Тесты
```

### 1.5 News модуль
```
Неделя 4:
├── News CRUD
├── Slug генерация
├── Полнотекстовый поиск (PostgreSQL tsvector)
├── Tags
├── Image upload для новостей
└── Пагинация
```

---

## Phase 1: MVP — Frontend (параллельно, 3-4 недели)

### 1.6 Настройка Next.js
```
Неделя 1:
├── Инициализация Next.js 14 (App Router)
├── Tailwind CSS + shadcn/ui
├── next-intl (RU, EN, HY — перенос переводов)
├── React Query (TanStack Query)
├── Zustand (auth state)
├── Axios API client с interceptors
└── Layout: Navbar + Footer
```

### 1.7 Auth страницы
```
Неделя 1-2:
├── /auth/login
├── /auth/register
├── /auth/forgot-password
├── Google OAuth кнопка
├── Auth middleware (protected routes)
├── Profile dropdown в navbar
└── Сохранение токенов (httpOnly cookies)
```

### 1.8 Публичные страницы
```
Неделя 2-3:
├── / (главная — hero, новости, рейтинги, турниры)
├── /tournaments (список + фильтры)
├── /tournaments/[slug] (детали + вкладки)
├── /tournaments/[slug]/register (форма регистрации)
├── /athletes (каталог + фильтры + поиск)
├── /athletes/[id] (профиль + статистика)
├── /news (лента новостей)
├── /news/[slug] (статья)
└── /rankings (таблицы рейтингов)
```

### 1.9 Bracket отображение
```
Неделя 3:
├── Перенос BracketView компонента
├── Адаптация под новый API
├── Добавление анимаций
├── Responsive bracket view
└── Live обновления через WebSocket
```

### 1.10 Admin панель
```
Неделя 3-4:
├── /admin/dashboard (статистика)
├── /admin/tournaments (CRUD)
├── /admin/news (CRUD + Rich Text Editor)
├── /admin/athletes (управление + верификация)
├── /admin/users (список + роли)
├── /admin/brackets (генерация + запись результатов)
└── /admin/settings
```

---

## Phase 2: Расширение (2-3 месяца после MVP)

```
├── Reviews & Comments (отзывы, комментарии, лайки)
├── Videos модуль (YouTube интеграция, загрузка)
├── Rankings система (автоматический расчёт, периоды)
├── Мультиспорт (добавление 2-го вида спорта — бокс или MMA)
├── Расширенный поиск (Elasticsearch или PostgreSQL FTS)
├── Email уведомления (новый турнир, результаты)
├── User favorites (избранные атлеты, турниры)
├── SEO оптимизация (meta, OG tags, sitemap.xml)
└── Performance (кэширование Redis, image optimization)
```

---

## Phase 3: Live & Engagement (2-3 месяца)

```
├── Live streaming (Mux.com интеграция)
├── Live bracket updates (WebSocket в реальном времени)
├── Push notifications (Web Push API)
├── In-app notifications
├── Social sharing
├── Embed виджет (bracket widget для сторонних сайтов)
└── Advanced analytics (PostHog)
```

---

## Phase 4: Масштабирование (2-3 месяца)

```
├── Mobile App (React Native или PWA)
├── Monetization (Stripe: подписки, VIP)
├── API для партнёров (Public API + API keys)
├── CDN оптимизация
├── Microservices (если нужно)
├── Load testing
└── Multi-region deployment
```

---

## Миграция текущих данных

### Шаг 1: Экспорт из localStorage
```javascript
// Скрипт для экспорта текущих данных
const exportData = {
  tournaments: JSON.parse(localStorage.getItem('gsm_tournaments') || '[]'),
  participants: JSON.parse(localStorage.getItem('gsm_participants') || '[]'),
  brackets: JSON.parse(localStorage.getItem('gsm_brackets') || '{}'),
};
// Сохранить как JSON файл
```

### Шаг 2: Seed скрипт для PostgreSQL
```
1. Создать seed файл с маппингом старых данных на новые таблицы
2. tournaments → tournaments + weight_categories
3. participants → users + athletes + tournament_entries
4. brackets → brackets + matches
5. Запустить seed через TypeORM
```

### Шаг 3: Параллельная работа
```
Во время миграции:
- Текущий сайт (Vite) работает на gsm-armwrestling.am (если есть)
- Новый сайт разрабатывается на dev.gsmsports.am
- После готовности MVP — переключение DNS
- Старый сайт → redirect на новый
```

---

## Приоритеты MVP (что делать ПЕРВЫМ)

```
Приоритет 1 (Блокирующие):
  ✅ Docker + PostgreSQL + Redis
  ✅ NestJS: Auth модуль
  ✅ NestJS: Sports + Tournaments + Athletes
  ✅ Next.js: Layout + Auth pages

Приоритет 2 (Core):
  ✅ NestJS: Brackets + Matches
  ✅ NestJS: News
  ✅ Next.js: Tournament pages
  ✅ Next.js: Athlete pages
  ✅ Next.js: Bracket view

Приоритет 3 (Polish):
  ✅ Rankings page
  ✅ Search
  ✅ Admin panel
  ✅ i18n (все 3 языка)
  ✅ Responsive design

Приоритет 4 (Nice to have для MVP):
  ○ Google OAuth
  ○ Email notifications
  ○ Video section
```

---

## Инструменты для команды

| Инструмент | Зачем |
|-----------|-------|
| **GitHub** | Код, Issues, PR reviews |
| **GitHub Projects** | Kanban-доска задач |
| **Figma** | UI/UX дизайн |
| **Notion** | Документация |
| **Discord/Telegram** | Коммуникация |
| **Postman** | Тестирование API |
| **Sentry** | Мониторинг ошибок |
