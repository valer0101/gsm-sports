# GSM Sports Platform — Database Schema (PostgreSQL)

## 1. ER-диаграмма (упрощённая)

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  users   │────<│ user_roles   │>────│   roles     │
└──────────┘     └──────────────┘     └─────────────┘
     │
     ├──────────────────────────────────────┐
     │                                      │
     ▼                                      ▼
┌──────────────┐                    ┌───────────────┐
│   athletes   │                    │   reviews     │
└──────────────┘                    └───────────────┘
     │
     ▼
┌───────────────────┐     ┌──────────────┐     ┌──────────────┐
│ tournament_entries │────>│ tournaments  │────>│   sports     │
└───────────────────┘     └──────────────┘     └──────────────┘
                               │
                               ▼
                          ┌──────────┐     ┌──────────────┐
                          │ brackets │────>│   matches    │
                          └──────────┘     └──────────────┘
```

---

## 2. Таблицы

### 2.1 `users` — Пользователи

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),                    -- NULL если OAuth
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    phone           VARCHAR(20),
    country         VARCHAR(100),
    city            VARCHAR(100),
    language        VARCHAR(5) DEFAULT 'hy',         -- hy, ru, en
    is_verified     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_country ON users(country);
```

### 2.2 `roles` — Роли

```sql
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,  -- guest, user, athlete, organizer, admin, super_admin
    description VARCHAR(255)
);

INSERT INTO roles (name, description) VALUES
    ('user', 'Зарегистрированный пользователь'),
    ('athlete', 'Верифицированный спортсмен'),
    ('organizer', 'Организатор турниров'),
    ('admin', 'Администратор платформы'),
    ('super_admin', 'Владелец платформы');
```

### 2.3 `user_roles` — Связь пользователей и ролей

```sql
CREATE TABLE user_roles (
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id     INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    granted_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by  UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);
```

### 2.4 `oauth_accounts` — Социальные аккаунты

```sql
CREATE TABLE oauth_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL,      -- google, facebook
    provider_id     VARCHAR(255) NOT NULL,
    access_token    TEXT,
    refresh_token   TEXT,
    expires_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);
```

---

### 2.5 `sports` — Виды спорта

```sql
CREATE TABLE sports (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(50) UNIQUE NOT NULL,    -- armwrestling, boxing, mma
    name_ru         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100) NOT NULL,
    name_hy         VARCHAR(100) NOT NULL,
    icon_url        VARCHAR(500),
    description_ru  TEXT,
    description_en  TEXT,
    description_hy  TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    config          JSONB DEFAULT '{}',            -- специфичные настройки вида спорта
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO sports (slug, name_ru, name_en, name_hy) VALUES
    ('armwrestling', 'Армрестлинг', 'Armwrestling', 'Ձեռնամարտ');
```

### 2.6 `athletes` — Профили спортсменов

```sql
CREATE TABLE athletes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    sport_id        INTEGER REFERENCES sports(id),

    -- Физические данные
    date_of_birth   DATE,
    gender          VARCHAR(10) NOT NULL,           -- male, female
    weight          DECIMAL(5,2),                   -- в кг
    height          DECIMAL(5,2),                   -- в см

    -- Спортивные данные
    experience      VARCHAR(20) DEFAULT 'beginner', -- beginner, amateur, semi_pro, pro
    dominant_hand   VARCHAR(10),                    -- left, right, both (для армрестлинга)
    club            VARCHAR(200),
    coach           VARCHAR(200),

    -- Статистика (кэшированные значения)
    total_matches   INTEGER DEFAULT 0,
    total_wins      INTEGER DEFAULT 0,
    total_losses    INTEGER DEFAULT 0,
    ranking_points  INTEGER DEFAULT 0,

    -- Мета
    bio_ru          TEXT,
    bio_en          TEXT,
    bio_hy          TEXT,
    photo_url       VARCHAR(500),
    cover_photo_url VARCHAR(500),
    social_links    JSONB DEFAULT '{}',            -- {instagram: "...", youtube: "..."}
    is_verified     BOOLEAN DEFAULT FALSE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_athletes_sport ON athletes(sport_id);
CREATE INDEX idx_athletes_ranking ON athletes(sport_id, ranking_points DESC);
CREATE INDEX idx_athletes_country ON athletes(user_id); -- join с users для country
```

---

### 2.7 `tournaments` — Турниры

```sql
CREATE TABLE tournaments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_id            INTEGER REFERENCES sports(id) NOT NULL,
    organizer_id        UUID REFERENCES users(id) NOT NULL,

    -- Основное
    name                VARCHAR(300) NOT NULL,
    slug                VARCHAR(300) UNIQUE NOT NULL,
    description_ru      TEXT,
    description_en      TEXT,
    description_hy      TEXT,

    -- Время и место
    start_date          TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date            TIMESTAMP WITH TIME ZONE,
    location            VARCHAR(300),
    address             VARCHAR(500),
    country             VARCHAR(100),
    city                VARCHAR(100),
    venue_coordinates   POINT,                       -- GPS координаты

    -- Настройки
    format              VARCHAR(50) DEFAULT 'double_elimination',  -- single, double, round_robin
    max_participants    INTEGER,
    registration_open   BOOLEAN DEFAULT FALSE,
    registration_deadline TIMESTAMP WITH TIME ZONE,

    -- Статус
    status              VARCHAR(20) DEFAULT 'draft', -- draft, upcoming, registration, active, completed, cancelled
    is_featured         BOOLEAN DEFAULT FALSE,
    is_live             BOOLEAN DEFAULT FALSE,

    -- Медиа
    poster_url          VARCHAR(500),
    stream_url          VARCHAR(500),

    -- Специфичные настройки (для армрестлинга: hands, categories и т.д.)
    sport_config        JSONB DEFAULT '{}',

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tournaments_sport ON tournaments(sport_id);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_date ON tournaments(start_date DESC);
CREATE INDEX idx_tournaments_slug ON tournaments(slug);
```

### 2.8 `weight_categories` — Весовые категории

```sql
CREATE TABLE weight_categories (
    id              SERIAL PRIMARY KEY,
    tournament_id   UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,          -- "до 70 кг"
    min_weight      DECIMAL(5,2),
    max_weight      DECIMAL(5,2),
    gender          VARCHAR(10) DEFAULT 'male',
    sort_order      INTEGER DEFAULT 0
);

CREATE INDEX idx_weight_cat_tournament ON weight_categories(tournament_id);
```

### 2.9 `tournament_entries` — Записи на турнир

```sql
CREATE TABLE tournament_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id       UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    athlete_id          UUID REFERENCES athletes(id) ON DELETE CASCADE,
    weight_category_id  INTEGER REFERENCES weight_categories(id),

    -- Для армрестлинга
    hand                VARCHAR(10),                -- left, right
    weigh_in_weight     DECIMAL(5,2),              -- вес на взвешивании

    -- Статус
    status              VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, checked_in, withdrawn, disqualified
    seed_number         INTEGER,                    -- порядковый номер (для сетки)

    registered_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at        TIMESTAMP WITH TIME ZONE,

    UNIQUE(tournament_id, athlete_id, hand)         -- один атлет = одна рука в одном турнире
);

CREATE INDEX idx_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX idx_entries_athlete ON tournament_entries(athlete_id);
```

---

### 2.10 `brackets` — Турнирные сетки

```sql
CREATE TABLE brackets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id       UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    weight_category_id  INTEGER REFERENCES weight_categories(id),
    hand                VARCHAR(10),                -- для армрестлинга

    -- Структура
    format              VARCHAR(50) DEFAULT 'double_elimination',
    bracket_size        INTEGER NOT NULL,           -- ближайшая степень 2
    status              VARCHAR(20) DEFAULT 'pending', -- pending, active, completed

    -- Данные сетки (JSON — как в текущем bracketLogic.js)
    bracket_data        JSONB NOT NULL,             -- полная структура сетки

    champion_id         UUID REFERENCES athletes(id),

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tournament_id, weight_category_id, hand)
);

CREATE INDEX idx_brackets_tournament ON brackets(tournament_id);
```

### 2.11 `matches` — Отдельные матчи

```sql
CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bracket_id      UUID REFERENCES brackets(id) ON DELETE CASCADE,

    -- Позиция в сетке
    round           INTEGER NOT NULL,
    match_index     INTEGER NOT NULL,
    bracket_side    VARCHAR(20) NOT NULL,          -- winners, losers, grand_final, super_final

    -- Участники
    player1_id      UUID REFERENCES athletes(id),
    player2_id      UUID REFERENCES athletes(id),
    winner_id       UUID REFERENCES athletes(id),
    loser_id        UUID REFERENCES athletes(id),

    -- Результат
    score           VARCHAR(50),                   -- "3-2", "pin" и т.д.
    is_bye          BOOLEAN DEFAULT FALSE,

    -- Связи (для навигации по сетке)
    feeder_match1_id UUID REFERENCES matches(id),
    feeder_match2_id UUID REFERENCES matches(id),

    -- Время
    scheduled_at    TIMESTAMP WITH TIME ZONE,
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_matches_bracket ON matches(bracket_id);
CREATE INDEX idx_matches_players ON matches(player1_id, player2_id);
```

---

### 2.12 `news` — Новости

```sql
CREATE TABLE news (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID REFERENCES users(id),
    sport_id        INTEGER REFERENCES sports(id),

    -- Контент
    title_ru        VARCHAR(500),
    title_en        VARCHAR(500),
    title_hy        VARCHAR(500),
    slug            VARCHAR(500) UNIQUE NOT NULL,
    content_ru      TEXT,
    content_en      TEXT,
    content_hy      TEXT,
    excerpt_ru      VARCHAR(1000),
    excerpt_en      VARCHAR(1000),
    excerpt_hy      VARCHAR(1000),

    -- Медиа
    cover_image_url VARCHAR(500),
    images          JSONB DEFAULT '[]',

    -- Мета
    tags            VARCHAR(50)[] DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'draft',   -- draft, published, archived
    is_featured     BOOLEAN DEFAULT FALSE,
    views_count     INTEGER DEFAULT 0,

    published_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_news_sport ON news(sport_id);
CREATE INDEX idx_news_status ON news(status, published_at DESC);
CREATE INDEX idx_news_slug ON news(slug);
CREATE INDEX idx_news_tags ON news USING GIN(tags);
-- Полнотекстовый поиск
CREATE INDEX idx_news_search_ru ON news USING GIN(to_tsvector('russian', coalesce(title_ru,'') || ' ' || coalesce(content_ru,'')));
CREATE INDEX idx_news_search_en ON news USING GIN(to_tsvector('english', coalesce(title_en,'') || ' ' || coalesce(content_en,'')));
```

### 2.13 `videos` — Видео

```sql
CREATE TABLE videos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id     UUID REFERENCES users(id),
    sport_id        INTEGER REFERENCES sports(id),
    tournament_id   UUID REFERENCES tournaments(id),

    title_ru        VARCHAR(500),
    title_en        VARCHAR(500),
    title_hy        VARCHAR(500),
    description     TEXT,

    -- Источник
    source_type     VARCHAR(20) NOT NULL,          -- youtube, upload, mux
    source_url      VARCHAR(500) NOT NULL,
    thumbnail_url   VARCHAR(500),
    duration        INTEGER,                       -- секунды

    -- Мета
    tags            VARCHAR(50)[] DEFAULT '{}',
    is_live         BOOLEAN DEFAULT FALSE,
    is_featured     BOOLEAN DEFAULT FALSE,
    views_count     INTEGER DEFAULT 0,

    published_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_videos_sport ON videos(sport_id);
CREATE INDEX idx_videos_tournament ON videos(tournament_id);
```

---

### 2.14 `reviews` — Отзывы

```sql
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Полиморфная связь
    target_type     VARCHAR(50) NOT NULL,          -- tournament, athlete, news, video
    target_id       UUID NOT NULL,

    -- Контент
    rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
    title           VARCHAR(300),
    content         TEXT NOT NULL,

    -- Модерация
    status          VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    moderated_by    UUID REFERENCES users(id),
    moderated_at    TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status);
```

### 2.15 `comments` — Комментарии (вложенные)

```sql
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE, -- для вложенности

    -- Полиморфная связь
    target_type     VARCHAR(50) NOT NULL,          -- news, video, tournament, match
    target_id       UUID NOT NULL,

    content         TEXT NOT NULL,

    -- Модерация
    is_hidden       BOOLEAN DEFAULT FALSE,
    likes_count     INTEGER DEFAULT 0,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
```

---

### 2.16 `rankings` — Рейтинги

```sql
CREATE TABLE rankings (
    id              SERIAL PRIMARY KEY,
    athlete_id      UUID REFERENCES athletes(id) ON DELETE CASCADE,
    sport_id        INTEGER REFERENCES sports(id),

    -- Тип рейтинга
    ranking_type    VARCHAR(50) NOT NULL,          -- world, country, weight_class
    scope           VARCHAR(100),                  -- "AM" (Armenia), "70kg", и т.д.

    -- Позиция
    position        INTEGER NOT NULL,
    previous_position INTEGER,
    points          INTEGER DEFAULT 0,

    -- Период
    period          VARCHAR(20) NOT NULL,          -- "2025-Q1", "2025-03" и т.д.

    calculated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(athlete_id, sport_id, ranking_type, scope, period)
);

CREATE INDEX idx_rankings_sport_type ON rankings(sport_id, ranking_type, period);
CREATE INDEX idx_rankings_position ON rankings(position);
```

---

## 3. Связи между таблицами (Relationship Map)

```
users ──1:N──> oauth_accounts
users ──M:N──> roles           (через user_roles)
users ──1:1──> athletes
users ──1:N──> reviews
users ──1:N──> comments
users ──1:N──> tournaments     (как organizer)
users ──1:N──> news            (как author)

athletes ──1:N──> tournament_entries
athletes ──1:N──> rankings
athletes ──M:1──> sports

sports ──1:N──> tournaments
sports ──1:N──> news
sports ──1:N──> videos

tournaments ──1:N──> weight_categories
tournaments ──1:N──> tournament_entries
tournaments ──1:N──> brackets
tournaments ──1:N──> videos

brackets ──1:N──> matches

weight_categories ──1:N──> tournament_entries
```

---

## 4. Миграция данных из localStorage

| localStorage ключ | Новая таблица | Примечания |
|-------------------|---------------|------------|
| `gsm_tournaments` | `tournaments` + `weight_categories` | Разнести категории в отдельную таблицу |
| `gsm_participants` | `users` + `athletes` + `tournament_entries` | Разделить на 3 сущности |
| `gsm_brackets` | `brackets` + `matches` | bracket_data как JSONB + matches отдельно |
| `gsm_active_tournament` | `tournaments.status = 'active'` | Флаг в самом турнире |
| `gsm_admin_password` | `users` + `roles` | Полноценная auth система |
