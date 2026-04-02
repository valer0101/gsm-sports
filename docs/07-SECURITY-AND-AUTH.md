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
| **Refresh Token** | 7 дней | httpOnly cookie + Redis | Обновление access token |
| **Email Verify Token** | 24 часа | Redis | Подтверждение email |
| **Password Reset Token** | 1 час | Redis | Сброс пароля |

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

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Backend │         │  Google  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │ Клик "Войти через Google"               │
     │───────────────────>│                    │
     │                    │                    │
     │ Redirect → Google OAuth                 │
     │<───────────────────│                    │
     │                    │                    │
     │ Авторизация в Google ──────────────────>│
     │<────────────────── Redirect с code ─────│
     │                    │                    │
     │ GET /auth/google/callback?code=xxx      │
     │───────────────────>│                    │
     │                    │ Exchange code → token
     │                    │───────────────────>│
     │                    │<───────────────────│
     │                    │ Get user profile   │
     │                    │───────────────────>│
     │                    │<───────────────────│
     │                    │                    │
     │                    │ Find/Create user   │
     │                    │ Link oauth_account │
     │                    │ Issue JWT tokens   │
     │                    │                    │
     │ Set cookies + redirect to /             │
     │<───────────────────│                    │
```

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
