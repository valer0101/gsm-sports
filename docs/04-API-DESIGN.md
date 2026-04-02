# GSM Sports Platform — API Design (REST)

## 1. Общие правила

- **Base URL:** `https://api.gsmsports.am/v1`
- **Формат:** JSON
- **Аутентификация:** Bearer JWT token в заголовке `Authorization`
- **Пагинация:** `?page=1&limit=20` (по умолчанию 20, макс 100)
- **Сортировка:** `?sort=created_at&order=desc`
- **Фильтрация:** `?status=active&sport=armwrestling`
- **Локализация:** заголовок `Accept-Language: ru` (ru | en | hy)
- **Ошибки:** стандартный формат

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "Email is required" }
  ]
}
```

---

## 2. Auth — Аутентификация

```
POST   /auth/register            # Регистрация по email
POST   /auth/login               # Логин (email + password)
POST   /auth/logout              # Выход (invalidate refresh token)
POST   /auth/refresh             # Обновление access token
POST   /auth/forgot-password     # Запрос сброса пароля
POST   /auth/reset-password      # Сброс пароля по токену
POST   /auth/verify-email        # Подтверждение email
GET    /auth/google              # Google OAuth redirect
GET    /auth/google/callback     # Google OAuth callback
GET    /auth/me                  # Текущий пользователь
```

### Примеры

**POST /auth/register**
```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "Armen",
  "lastName": "Hakobyan",
  "country": "Armenia",
  "language": "hy"
}

// Response 201
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Armen",
    "lastName": "Hakobyan"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

**POST /auth/login**
```json
// Request
{ "email": "user@example.com", "password": "SecurePass123!" }

// Response 200
{
  "user": { "id": "uuid", "email": "...", "roles": ["user", "athlete"] },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

---

## 3. Users — Пользователи

```
GET    /users/:id                # Публичный профиль
PATCH  /users/:id                # Обновить свой профиль          [auth: owner]
DELETE /users/:id                # Удалить аккаунт                [auth: owner|admin]
PATCH  /users/:id/avatar         # Загрузить аватар (multipart)   [auth: owner]
GET    /users/:id/activity       # Активность пользователя
```

---

## 4. Sports — Виды спорта

```
GET    /sports                   # Список всех видов спорта
GET    /sports/:slug             # Один вид спорта (armwrestling)
POST   /sports                   # Создать вид спорта             [auth: admin]
PATCH  /sports/:id               # Обновить                       [auth: admin]
DELETE /sports/:id               # Удалить                        [auth: admin]
```

---

## 5. Athletes — Спортсмены

```
GET    /athletes                 # Список атлетов (с фильтрами)
GET    /athletes/:id             # Профиль атлета
POST   /athletes                 # Создать профиль атлета         [auth: user]
PATCH  /athletes/:id             # Обновить профиль               [auth: owner|admin]
GET    /athletes/:id/stats       # Детальная статистика
GET    /athletes/:id/matches     # История матчей
GET    /athletes/:id/tournaments # Турниры атлета
```

### Фильтры для GET /athletes:
```
?sport=armwrestling
&country=Armenia
&experience=pro
&gender=male
&weight_min=70&weight_max=80
&sort=ranking_points&order=desc
&search=Armen
```

### Пример ответа GET /athletes/:id
```json
{
  "id": "uuid",
  "user": {
    "firstName": "Armen",
    "lastName": "Hakobyan",
    "country": "Armenia",
    "city": "Yerevan"
  },
  "sport": { "slug": "armwrestling", "name": "Армрестлинг" },
  "dateOfBirth": "1995-03-15",
  "weight": 75.5,
  "height": 178,
  "experience": "pro",
  "dominantHand": "right",
  "club": "GSM Club",
  "stats": {
    "totalMatches": 42,
    "wins": 35,
    "losses": 7,
    "winRate": 83.3,
    "rankingPoints": 1250
  },
  "ranking": {
    "world": 156,
    "country": 3,
    "previousWorld": 160
  },
  "bio": "Профессиональный армрестлер...",
  "photoUrl": "https://cdn.gsmsports.am/athletes/photo.jpg",
  "socialLinks": {
    "instagram": "https://instagram.com/armen"
  },
  "isVerified": true
}
```

---

## 6. Tournaments — Турниры

```
GET    /tournaments              # Список турниров (с фильтрами)
GET    /tournaments/:id          # Детали турнира
POST   /tournaments              # Создать турнир                  [auth: organizer]
PATCH  /tournaments/:id          # Обновить турнир                 [auth: organizer|admin]
DELETE /tournaments/:id          # Удалить турнир                  [auth: organizer|admin]

# Регистрация участников
GET    /tournaments/:id/entries              # Список участников
POST   /tournaments/:id/entries              # Записаться на турнир    [auth: athlete]
DELETE /tournaments/:id/entries/:entryId     # Отменить запись         [auth: owner|admin]
PATCH  /tournaments/:id/entries/:entryId     # Обновить (подтвердить)  [auth: organizer]

# Весовые категории
GET    /tournaments/:id/categories           # Список категорий
POST   /tournaments/:id/categories           # Добавить категорию      [auth: organizer]
DELETE /tournaments/:id/categories/:catId    # Удалить категорию       [auth: organizer]
```

### Фильтры для GET /tournaments:
```
?sport=armwrestling
&status=upcoming
&country=Armenia
&date_from=2025-01-01
&date_to=2025-12-31
&is_featured=true
```

---

## 7. Brackets — Турнирные сетки

```
GET    /tournaments/:id/brackets                  # Все сетки турнира
GET    /tournaments/:id/brackets/:bracketId       # Одна сетка (полная структура)
POST   /tournaments/:id/brackets/generate         # Сгенерировать сетки    [auth: organizer]
DELETE /tournaments/:id/brackets/:bracketId       # Удалить сетку          [auth: organizer]

# Матчи в сетке
GET    /brackets/:bracketId/matches               # Все матчи сетки
PATCH  /brackets/:bracketId/matches/:matchId      # Записать результат     [auth: organizer]
```

### Пример PATCH /brackets/:bracketId/matches/:matchId
```json
// Request
{
  "winnerId": "athlete-uuid",
  "score": "3-1"
}

// Response 200
{
  "match": { "id": "...", "winnerId": "...", "loserId": "..." },
  "bracket": { /* обновлённая структура сетки */ },
  "nextMatches": [ /* матчи, куда продвинулись игроки */ ]
}
```

---

## 8. News — Новости

```
GET    /news                     # Список новостей (пагинация)
GET    /news/:slug               # Одна новость по slug
POST   /news                     # Создать новость                 [auth: admin]
PATCH  /news/:id                 # Обновить                        [auth: admin]
DELETE /news/:id                 # Удалить                         [auth: admin]
GET    /news/featured            # Избранные новости (для главной)
GET    /news/tags                # Список всех тегов
```

### Фильтры для GET /news:
```
?sport=armwrestling
&tag=tournament
&status=published
&search=чемпионат
```

---

## 9. Videos — Видео

```
GET    /videos                   # Список видео
GET    /videos/:id               # Одно видео
POST   /videos                   # Добавить видео                  [auth: admin|organizer]
PATCH  /videos/:id               # Обновить                        [auth: admin]
DELETE /videos/:id               # Удалить                         [auth: admin]
GET    /videos/live              # Текущие трансляции
```

---

## 10. Rankings — Рейтинги

```
GET    /rankings                          # Общий рейтинг
GET    /rankings/world                    # Мировой рейтинг
GET    /rankings/country/:countryCode     # Рейтинг по стране
GET    /rankings/sport/:sportSlug         # Рейтинг по виду спорта
```

### Фильтры:
```
?sport=armwrestling
&gender=male
&weight_class=70kg
&period=2025-Q1
&limit=50
```

---

## 11. Reviews & Comments — Отзывы и комментарии

```
# Отзывы
GET    /reviews?target_type=tournament&target_id=uuid    # Отзывы к объекту
POST   /reviews                                          # Оставить отзыв      [auth: user]
PATCH  /reviews/:id                                      # Обновить             [auth: owner]
DELETE /reviews/:id                                      # Удалить              [auth: owner|admin]

# Комментарии
GET    /comments?target_type=news&target_id=uuid         # Комментарии к объекту
POST   /comments                                         # Написать коммент     [auth: user]
PATCH  /comments/:id                                     # Редактировать        [auth: owner]
DELETE /comments/:id                                     # Удалить              [auth: owner|admin]
POST   /comments/:id/like                                # Лайк                 [auth: user]
```

---

## 12. Media Upload — Загрузка файлов

```
POST   /upload/image             # Загрузить изображение   [auth: user]
POST   /upload/video             # Загрузить видео         [auth: admin|organizer]
DELETE /upload/:fileId           # Удалить файл            [auth: owner|admin]
```

### POST /upload/image
```
Content-Type: multipart/form-data
Body: file (max 5MB, jpg/png/webp)

Response 201:
{
  "id": "file-uuid",
  "url": "https://cdn.gsmsports.am/images/abc123.webp",
  "thumbnailUrl": "https://cdn.gsmsports.am/images/abc123_thumb.webp",
  "width": 1200,
  "height": 800,
  "size": 245000
}
```

---

## 13. Search — Глобальный поиск

```
GET    /search?q=Armen&type=all          # Поиск по всему
GET    /search?q=Armen&type=athletes     # Только атлеты
GET    /search?q=чемпионат&type=news     # Только новости
```

### Пример ответа
```json
{
  "query": "Armen",
  "results": {
    "athletes": [{ "id": "...", "name": "Armen Hakobyan", "sport": "armwrestling" }],
    "tournaments": [],
    "news": [{ "id": "...", "title": "Armen wins championship" }]
  },
  "total": 5
}
```

---

## 14. WebSocket Events (для live обновлений)

```
# Клиент подключается к:
wss://api.gsmsports.am/ws

# События:
tournament:match_update    # Обновление матча в реальном времени
tournament:bracket_update  # Обновление сетки
tournament:live_start      # Начало трансляции
news:published             # Новая новость
comment:new                # Новый комментарий
```

---

## 15. Rate Limiting

| Endpoint | Лимит | Окно |
|----------|-------|------|
| `POST /auth/*` | 10 req | 15 мин |
| `POST /upload/*` | 20 req | 1 час |
| `GET /search` | 30 req | 1 мин |
| Все остальные | 100 req | 1 мин |
| Авторизованные | 200 req | 1 мин |

---

## 16. Версионирование API

- URL-based: `/v1/`, `/v2/`
- Старые версии поддерживаются 6 месяцев после выхода новой
- Заголовок `X-API-Version` для информации
