# GSM Sports Platform — Security & Authentication

## 1. Аутентификация (Auth Flow)

### 1.1 JWT Token Flow

```
┌──────────┐                         ┌──────────┐                    ┌──────────┐
│  Client  │                         │  Backend │                    │  Database│
└────┬─────┘                         └────┬─────┘                    └────┬─────┘
     │                                    │                               │
     │  POST /auth/login                  │                               │
     │  {email, password}                 │                               │
     │───────────────────────────────────>│                               │
     │                                    │  Проверить пароль (bcrypt)    │
     │                                    │──────────────────────────────>│
     │                                    │<──────────────────────────────│
     │                                    │                               │
     │  200 OK                            │                               │
     │  {accessToken, refreshToken}       │                               │
     │<───────────────────────────────────│                               │
     │                                    │                               │
     │  GET /api/protected                │                               │
     │  Authorization: Bearer {access}    │                               │
     │───────────────────────────────────>│                               │
     │                                    │  Verify JWT                   │
     │  200 OK {data}                     │                               │
     │<───────────────────────────────────│                               │
     │                                    │                               │
     │  ── accessToken expired ──         │                               │
     │                                    │                               │
     │  POST /auth/refresh                │                               │
     │  {refreshToken}                    │                               │
     │───────────────────────────────────>│                               │
     │                                    │  Проверить refresh в Redis    │
     │  200 OK                            │                               │
     │  {newAccessToken, newRefreshToken} │                               │
     │<───────────────────────────────────│                               │
```

### 1.2 Токены

| Токен | Время жизни | Хранение | Назначение |
|-------|-------------|----------|------------|
| **Access Token** | 15 минут | httpOnly cookie | Авторизация API запросов |
| **Refresh Token** | 7 дней | httpOnly cookie (плюс Redis при включении сессионной ревокации) | Обновление access token |
| **Email Verify Token** | 24 часа | Таблица `email_verification_tokens` (SHA-256 хеш, single-use, FK к users) | Подтверждение email |
| **Password Reset Token** | 30 минут | Таблица `password_reset_tokens` (SHA-256 хеш, single-use, FK к users) | Сброс пароля |

**Заметки по storage:**
- Reset/verify-токены хранятся в Postgres (а не в Redis как изначально планировалось) — это даёт аудит-трейл, явный `usedAt` для single-use гарантии, и нулевой риск молчаливой эвикции по памяти. В таблицах нет открытого токена: только SHA-256 хеш; plaintext живёт только в emailed-ссылке.
- 30-минутный TTL для password reset — короче изначального 1ч плана; компромисс в пользу безопасности.

### 1.3 JWT Payload (Access Token)

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["user", "athlete"],
  "iat": 1700000000,
  "exp": 1700000900
}
```

### 1.4 Хранение токенов на клиенте

```
⛔ НЕ хранить в localStorage (XSS уязвимость)
⛔ НЕ хранить в sessionStorage
✅ httpOnly cookie с флагами:
   - httpOnly: true    (недоступен из JS)
   - secure: true      (только HTTPS)
   - sameSite: 'lax'   (CSRF защита)
   - path: '/'
   - maxAge: 900       (15 мин для access)
```

---

## 2. Google OAuth Flow

Реализация: `apps/api/src/auth/google.strategy.ts`,
`apps/api/src/auth/google-auth.guard.ts`,
`apps/api/src/auth/oauth-state.service.ts`,
`apps/api/src/auth/auth.controller.ts` (`googleAuth`, `googleCallback`).

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Backend │         │  Google  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │ GET /auth/google?redirect=/admin/foo    │
     │───────────────────>│                    │
     │                    │ sign state JWT     │
     │                    │ {redirect, exp 10m}│
     │ 302 → Google OAuth (state=<jwt>)        │
     │<───────────────────│                    │
     │ Consent screen ──────────────────────── >│
     │<────────────── 302 /auth/google/callback?code&state│
     │                    │                    │
     │                    │ verify(state) JWT  │
     │                    │ exchange code      │
     │                    │───────────────────>│
     │                    │<───── tokens + profile (email_verified) ──│
     │                    │ findOrLinkOrCreate │
     │                    │ issue access_token │
     │ 302 → ${GOOGLE_SUCCESS_REDIRECT}?status=ok&redirect=/admin/foo
     │<───────────────────│ Set-Cookie access_token (httpOnly, lax)
```

### 2.1 CSRF protection

Параметр `state` — это **JWT, подписанный сервером** (`OAUTH_STATE_SECRET`,
fallback на `JWT_ACCESS_SECRET`), TTL 10 минут. Структура:
`{ type: 'oauth-state', redirect: string | null, exp }`. Discriminator
`type` исключает реплей утёкшей сессионной куки в качестве `state` и наоборот.

Атакующий не может подделать `state` без секрета, поэтому callback
с фабрикованным или повторно использованным state'ом отвергается до
вызова `loginWithGoogle()` и юзер уходит на фронт с `?status=error`.

### 2.2 Open-redirect protection

`OAuthStateService.sanitizeRedirect()` пропускает только same-origin
пути (`/...`, без `//...`, длина ≤ 200). Абсолютные URL и
protocol-relative дропаются и на write, и на read — два слоя обороны
на случай, если злоумышленник подсовывает state через какую-то иную
дыру.

### 2.3 Email verification

В `GoogleStrategy.validate()` мы отвергаем профиль, у которого
`email_verified === false` (поле читается из `profile._json`). Это
закрывает сценарий «Google Workspace с непроверенным алиасом».

### 2.4 Account linking semantics

Три ветки в `AuthService.loginWithGoogle()`:

1. Найден `googleId` → логин.
2. Найден email без `googleId` → линкуем `googleId`, ставим
   `isVerified = true`. Аватар Google копируется только если у юзера
   нет своего.
3. Никого нет → создаём новый аккаунт с `passwordHash = null`,
   `isVerified = true`, `language` берём из `Accept-Language`
   (`ru | en | hy`, fallback `hy`).

Конкурентные коллбэки (back-button или повторный POST) ловятся через
PostgreSQL `unique_violation` (SQLSTATE 23505) на `googleId`/`email`:
проигравший запрос пере-fetch'ит каноничный ряд и отдаст ту же
сессию. Никаких 500-х на гонку.

### 2.5 Setting a password later

Google-only юзер (`passwordHash = null`) может поставить себе пароль
через `POST /v1/auth/set-password` с тем же JWT-кукой. Если у юзера
уже стоит пароль, в DTO обязательно требуется `currentPassword`,
иначе `400`. Endpoint троттлится 5 запросов / 15 мин на IP — bcrypt
дорогой, не даём DDoS'ить CPU.

### 2.6 Configuration

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.example.com/v1/auth/google/callback
GOOGLE_SUCCESS_REDIRECT=https://example.com/auth/google/callback
OAUTH_STATE_SECRET=<32+ bytes, отдельный от JWT_ACCESS_SECRET>
```

Без `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` стратегия
не регистрируется (см. `auth.module.ts`) и приложение всё равно
стартует — endpoint'ы вернут 500 с понятной строкой вместо краша
на boot'е.

---

## 3. RBAC (Role-Based Access Control)

### 3.1 Матрица разрешений

| Ресурс / Действие | Guest | User | Athlete | Organizer | Admin |
|-------------------|-------|------|---------|-----------|-------|
| Просмотр новостей | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр рейтингов | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр турниров | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр профилей атлетов | ✅ | ✅ | ✅ | ✅ | ✅ |
| Оставить комментарий | ❌ | ✅ | ✅ | ✅ | ✅ |
| Оставить отзыв | ❌ | ✅ | ✅ | ✅ | ✅ |
| Записаться на турнир | ❌ | ❌ | ✅ | ✅ | ✅ |
| Редактировать профиль атлета | ❌ | ❌ | own | ❌ | ✅ |
| Создать турнир | ❌ | ❌ | ❌ | ✅ | ✅ |
| Управлять сетками | ❌ | ❌ | ❌ | own | ✅ |
| Создать новость | ❌ | ❌ | ❌ | ❌ | ✅ |
| Модерация отзывов | ❌ | ❌ | ❌ | ❌ | ✅ |
| Управление пользователями | ❌ | ❌ | ❌ | ❌ | ✅ |
| Управление ролями | ❌ | ❌ | ❌ | ❌ | super_admin |

### 3.2 NestJS Guard реализация

```typescript
// Декоратор для указания необходимых ролей
@Roles('admin', 'organizer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Post('/tournaments')
createTournament() { ... }

// Декоратор для публичных эндпоинтов
@Public()
@Get('/news')
getNews() { ... }

// Декоратор "владелец или админ"
@UseGuards(JwtAuthGuard, OwnerOrAdminGuard)
@Patch('/users/:id')
updateUser() { ... }
```

---

## 4. Безопасность API

### 4.1 CORS Configuration

```typescript
// В NestJS main.ts
app.enableCors({
  origin: [
    'https://gsmsports.am',
    'https://www.gsmsports.am',
    process.env.NODE_ENV === 'development' && 'http://localhost:3000',
  ].filter(Boolean),
  credentials: true,        // для cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
});
```

### 4.2 Rate Limiting

```typescript
// Глобальный rate limiter
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,        // секунды
      limit: 100,     // запросов
    }),
  ],
})

// Для auth endpoints — строже
@Throttle(10, 900)  // 10 запросов за 15 минут
@Post('/auth/login')
login() { ... }
```

### 4.3 Валидация данных

```typescript
// Все входящие данные проходят через class-validator
class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  name: string;

  @IsDateString()
  startDate: string;

  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(256)
  maxParticipants?: number;
}
```

### 4.4 SQL Injection защита
- TypeORM с параметризованными запросами (автоматически)
- Никогда не используем raw SQL с конкатенацией строк
- JSONB поля валидируются перед сохранением

### 4.5 XSS защита
- Контент новостей sanitize через DOMPurify на бэкенде
- Комментарии и отзывы — plain text (no HTML)
- Next.js по умолчанию экранирует вывод в JSX

### 4.6 CSRF защита
- httpOnly cookies + sameSite: 'lax' = основная защита
- Для мутаций — Double Submit Cookie pattern (если нужно)

---

## 5. Пароли

```
Хеширование:    bcrypt (12 rounds)
Минимум:        8 символов, 1 заглавная, 1 цифра
Блокировка:     5 неудачных попыток → блокировка на 15 минут
Сброс:          Одноразовый токен по email (1 час)
```

---

## 6. Защита загрузки файлов

```
Изображения:
  - Макс размер: 5 MB
  - Форматы: jpg, png, webp, gif
  - Проверка MIME type (не только расширение)
  - Генерация нового имени (UUID)
  - Обработка через sharp (resize, strip metadata)

Видео:
  - Макс размер: 500 MB
  - Форматы: mp4, mov, webm
  - Загрузка через presigned URL (напрямую в S3/R2)
  - Обработка в очереди (BullMQ)
```

---

## 7. Environment Variables

```bash
# .env.example (НИКОГДА не коммитить .env)

# App
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gsm_sports

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=gsm-media
R2_PUBLIC_URL=https://cdn.gsmsports.am

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@gsmsports.am

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 8. Логирование и аудит

```
Что логируем:
├── Все auth события (login, logout, failed attempts, password reset)
├── Изменения ролей пользователей
├── CRUD операции администратора
├── Ошибки 4xx и 5xx
├── Подозрительная активность (rate limit hits, invalid tokens)
└── Изменения в турнирах и результатах

Формат:
{
  "timestamp": "2025-03-15T10:30:00Z",
  "level": "info",
  "action": "auth.login",
  "userId": "uuid",
  "ip": "1.2.3.4",
  "userAgent": "...",
  "details": { ... }
}
```
