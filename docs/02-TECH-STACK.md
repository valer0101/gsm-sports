# GSM Sports Platform — Technology Stack

## 1. Обзор архитектуры

```
┌──────────────────────────────────────────────────────────┐
│                        КЛИЕНТ                             │
│  Next.js 14+ (React 19)  ·  Tailwind CSS  ·  TypeScript  │
│  SSR для публичных страниц  ·  SPA для панелей управления │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS / REST API + WebSocket
┌──────────────────────▼───────────────────────────────────┐
│                     API GATEWAY                           │
│              Nginx / Traefik (reverse proxy)              │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│                      BACKEND                              │
│    Node.js + NestJS (TypeScript)                          │
│    ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│    │ Auth Module  │  │ Sports Module│  │ Media Module  │  │
│    │ (JWT+OAuth)  │  │ (Tournaments)│  │ (Upload/CDN)  │  │
│    └─────────────┘  └──────────────┘  └───────────────┘  │
│    ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│    │ News Module  │  │ Users Module │  │ Notify Module │  │
│    └─────────────┘  └──────────────┘  └───────────────┘  │
└───────┬──────────────────┬──────────────────┬────────────┘
        │                  │                  │
┌───────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
│  PostgreSQL    │ │    Redis       │ │ AWS S3 / R2    │
│  (основная БД) │ │ (кэш/сессии)  │ │ (файлы/медиа)  │
└────────────────┘ └────────────────┘ └────────────────┘
```

---

## 2. Frontend

| Технология | Зачем |
|-----------|-------|
| **Next.js 14+** (App Router) | SSR для SEO (новости, рейтинги, профили атлетов), API Routes, Image optimization |
| **TypeScript** | Типобезопасность, меньше багов, лучше автокомплит |
| **Tailwind CSS** | Быстрая стилизация, consistency, responsive by default |
| **shadcn/ui** | Готовые UI-компоненты поверх Tailwind (таблицы, формы, модалки) |
| **React Query (TanStack)** | Кэширование данных, автообновление, optimistic updates |
| **Zustand** | Легковесный state management (замена Redux) |
| **next-intl** | i18n с поддержкой SSR (замена react-i18next) |
| **Framer Motion** | Анимации для UI |
| **React Hook Form + Zod** | Валидация форм на клиенте |

### Почему Next.js вместо Vite+React?
- **SEO** — новости, рейтинги, профили должны индексироваться Google
- **Производительность** — SSR + Streaming для быстрой загрузки
- **Image Optimization** — автоматическая оптимизация фото атлетов
- **API Routes** — можно использовать для BFF (Backend for Frontend)
- **Middleware** — для auth проверок на уровне роутинга

---

## 3. Backend

| Технология | Зачем |
|-----------|-------|
| **NestJS** (TypeScript) | Модульная архитектура, DI, декораторы, swagger автодокументация |
| **TypeORM** | ORM для PostgreSQL с миграциями и отношениями |
| **Passport.js** | Auth стратегии (JWT, Google OAuth, Facebook) |
| **class-validator** | Валидация DTO на бэкенде |
| **Bull / BullMQ** | Очереди задач (рассылка email, обработка видео) |
| **Socket.io** | WebSocket для live обновлений (трансляции, live brackets) |
| **Swagger** | Автоматическая API документация |

### Почему NestJS?
- Модульная архитектура — каждый вид спорта отдельный модуль
- TypeScript native — единый язык с фронтендом
- Встроенная поддержка WebSocket, GraphQL, microservices
- Guards, Interceptors, Pipes — чистая обработка auth/validation
- Хорошо масштабируется

---

## 4. База данных

### PostgreSQL (основная)
- Реляционные данные: пользователи, турниры, результаты, статьи
- Полнотекстовый поиск (tsvector) для новостей и атлетов
- JSON/JSONB для гибких данных (настройки турнира, bracket structure)
- Индексы для быстрых запросов рейтингов

### Redis
- Кэш популярных запросов (рейтинги, главная страница)
- Хранение сессий
- Rate limiting
- Очереди задач (BullMQ)
- Pub/Sub для realtime обновлений

---

## 5. Инфраструктура и DevOps

| Технология | Зачем |
|-----------|-------|
| **Docker + Docker Compose** | Контейнеризация всех сервисов |
| **GitHub Actions** | CI/CD пайплайн (lint, test, build, deploy) |
| **Vercel** (frontend) | Хостинг Next.js с edge CDN |
| **Railway / Render** (backend) | Хостинг NestJS + PostgreSQL + Redis |
| **Cloudflare R2** | Хранение медиа (дешевле S3) |
| **Cloudflare CDN** | Кэширование статики и изображений |
| **Sentry** | Мониторинг ошибок |
| **PostHog / Plausible** | Аналитика |

---

## 6. Внешние сервисы

| Сервис | Зачем |
|--------|-------|
| **Resend** или **SendGrid** | Email (подтверждение, уведомления) |
| **Google OAuth** | Социальный логин |
| **YouTube API** | Встраивание видео и трансляций |
| **Mux.com** | Live streaming (Phase 3) |
| **Cloudinary** | Обработка изображений (resize, crop, watermark) |
| **Stripe** | Платежи (Phase 4) |

---

## 7. Структура монорепозитория

```
gsm-sports/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # UI components
│   │   ├── lib/                # Utilities, API client
│   │   └── public/             # Static files
│   │
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── auth/           # Auth module
│       │   ├── users/          # Users module
│       │   ├── sports/         # Sports module (generic)
│       │   ├── armwrestling/   # Armwrestling-specific logic
│       │   ├── tournaments/    # Tournaments module
│       │   ├── news/           # News module
│       │   ├── media/          # Media upload module
│       │   ├── rankings/       # Rankings module
│       │   ├── reviews/        # Reviews/comments module
│       │   └── common/         # Shared utilities, guards, pipes
│       └── test/
│
├── packages/
│   ├── shared-types/           # TypeScript типы общие для frontend и backend
│   ├── bracket-engine/         # Логика турнирных сеток (из текущего bracketLogic.js)
│   └── config/                 # Общие конфиги (eslint, tsconfig, prettier)
│
├── docker-compose.yml
├── turbo.json                  # Turborepo config
├── package.json                # Root workspace
└── docs/                       # Документация
```

### Почему монорепо?
- Общие TypeScript типы между фронтом и бэком
- bracket-engine как отдельный пакет (переиспользуемый)
- Единый CI/CD пайплайн
- Turborepo для параллельных билдов и кэширования

---

## 8. Миграция с текущего проекта

| Текущее | Новое | Действие |
|---------|-------|----------|
| React + Vite SPA | Next.js App Router | Переписать страницы с SSR |
| localStorage | PostgreSQL + TypeORM | Создать схему БД, миграции |
| `storage.js` | NestJS REST API | Каждый метод → API endpoint |
| `bracketLogic.js` | `packages/bracket-engine` | Перенести и типизировать |
| `index.css` (1125 строк) | Tailwind CSS + shadcn/ui | Переписать стили |
| react-i18next | next-intl | Перенести переводы, добавить SSR |
| Нет auth | Passport.js + JWT | Реализовать с нуля |
| Нет ролей | RBAC (Role-Based Access) | Реализовать guards |
