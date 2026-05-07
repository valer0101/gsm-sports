# GSM Sports Platform — Documentation Index

## Документация проекта

| # | Документ | Описание |
|---|----------|----------|
| 01 | [Vision & Overview](./01-VISION.md) | Видение проекта, модули, роли, MVP, roadmap |
| 02 | [Technology Stack](./02-TECH-STACK.md) | Стек технологий, архитектура, структура монорепо |
| 03 | [Database Schema](./03-DATABASE-SCHEMA.md) | 16 таблиц PostgreSQL, связи, индексы, миграция данных |
| 04 | [API Design](./04-API-DESIGN.md) | REST API endpoints, примеры запросов/ответов, WebSocket |
| 05 | [Pages & UI](./05-PAGES-AND-UI.md) | Карта сайта, wireframes страниц, дизайн-система |
| 06 | [Migration Plan](./06-MIGRATION-PLAN.md) | Пошаговый план реализации, приоритеты, миграция данных |
| 07 | [Security & Auth](./07-SECURITY-AND-AUTH.md) | JWT flow, OAuth, RBAC, CORS, валидация, env variables |
| 08 | [Deployment](./08-DEPLOYMENT.md) | Docker, CI/CD, окружения, мониторинг, бэкапы, scaling |
| 09 | [Testing Strategy](./09-TESTING-STRATEGY.md) | Unit, Integration, E2E тесты, coverage goals |
| 10 | [CI / CD](./10-CI-CD.md) | GitHub Actions workflows, branch protection, security scanning |

---

## Текущее состояние
- ✅ React 19 + Vite SPA для армрестлинга (рабочий прототип)
- ✅ Double-elimination bracket engine
- ✅ Мультиязычность (RU, EN, HY)
- ❌ Нет базы данных (только localStorage)
- ❌ Нет бэкенда
- ❌ Нет аутентификации
- ❌ Один вид спорта

## Целевое состояние
- Мультиспортивная платформа (ESPN-like)
- Next.js + NestJS + PostgreSQL + Redis
- Полноценная auth система с ролями
- Турниры, рейтинги, новости, видео, трансляции
- Мобильная версия / приложение

## Следующий шаг
→ Начать с **Phase 0** из [Migration Plan](./06-MIGRATION-PLAN.md)
