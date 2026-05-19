# Armfight Section & Main-Event Countdown — Design Spec

> **Status:** Draft v1
> **Date:** 2026-05-19
> **Scope:** Sub-project **A** only — public armfight discovery + main-event promo with countdown.
> **Out of scope (queued separately):** Sub-project **B** — armfight match rules engine (multi-pair simultaneous bouts, best-of-5 scoring, bracket). B gets its own spec → plan → implementation cycle. This spec must not be expanded to cover B.
> **Design language:** Combat Energy — see `docs/design/00-DESIGN-SYSTEM.md` (read first).

---

## 1. Goal

Let users see **which armfight events are coming and when**, and promote a single admin-chosen **main event** with a prominent live countdown — in the visual spirit of fight-promo sites (reference: evwsports.com), adapted to Combat Energy tokens.

An "armfight event" is **an existing `Tournament` with `format = 'armfight'`**, created via the existing admin tournament wizard. No new event entity is introduced. The actual match mechanics (5 pairs, best-of-5) are **not** part of this spec.

---

## 2. Scope

In scope (A):
- Reusable **main-event hero** (full) + **mini-card** (compact) components for the admin-flagged featured armfight.
- Full **countdown** (days : hours : minutes : seconds), ticking to `Tournament.startDate`.
- **"Upcoming armfights" list** on the arm-wrestling sport page.
- Placement on 3 surfaces: home `/`, `/sports/armwrestling`, `/tournaments`.
- Backend: `is_featured_armfight` flag + `armfight_video_url` (+ reserved `stream_url`) on `Tournament`; generated migration; admin-wizard toggle/inputs; service-layer selection logic; list filter.

Explicitly **not** in scope: match rules/scoring/bracket (B); live streaming implementation; ticketing/PPV/merch; sponsor strip.

---

## 3. Data Model

Add to `apps/api/src/tournaments/entities/tournament.entity.ts`:

| Column | Type | Notes |
|---|---|---|
| `is_featured_armfight` | `boolean` default `false`, `@Index()` | Admin-set "main event" flag. Indexed (filtered in queries). |
| `armfight_video_url` | `varchar` nullable | Recording / YouTube link for the specific armfight. Shown post-event on the mini-card. |
| `stream_url` | `varchar` nullable | **Reserved for future** live stream. UI gated behind a feature flag; not active in MVP. |

- Migration is **generated** (`cd apps/api && npx typeorm migration:generate`), never hand-written. Must apply and revert cleanly.
- `armfight_video_url` / `stream_url` validated as URL via `class-validator` in the DTOs.

---

## 4. API

Base path `v1/`. All logic in services; controllers stay thin. Standard error format.

- `GET /v1/tournaments?format=armfight&status=upcoming&page=&limit=` — upcoming armfight list. Existing pagination rules (default 20, **max 100**), sorted by `startDate` ascending.
- `GET /v1/tournaments/featured-armfight` — returns `200` with the single main-event tournament, or `204 No Content` when none is set.

**Featured-event selection (service logic, unit-tested):**
1. Candidates: `format = 'armfight'` AND `is_featured_armfight = true` AND not `completed`/`cancelled`.
2. If several, pick the **soonest** by `startDate`.
3. If none → return null (no auto-substitution — manual mode is intentional).

---

## 5. Frontend

Conventions (`CLAUDE.md`): public pages **SSR for SEO**; **React Query** for client data (no direct fetch/axios in components); **next-intl** new namespace `armfight` (ru/en/hy), ICU plurals for day/hour words; **Combat Energy** tokens/primitives; `next/image`, `next/link`.

Components (`apps/web/src/components/armfight/`):
- `Countdown` + `useCountdown` — pure tick logic separated for unit testing. Handles upcoming / started(live) / ended.
- `MainArmfightHero` — full cinematic hero (full-bleed admin poster + dark gradient overlay, gold weight/title badge, event title, city line, countdown, CTA row). Consumes `useFeaturedArmfight`.
- `MainArmfightMiniCard` — compact horizontal variant for `/tournaments`.
- `UpcomingArmfightsList` — card grid for the sport page; SSR initial data + React Query; skeleton loading; non-empty empty-state.

Data hooks: `useFeaturedArmfight()`, `useUpcomingArmfights()`.

Placement:
| Surface | Element |
|---|---|
| `/` (home) | `MainArmfightHero` (full) |
| `/sports/armwrestling` | `MainArmfightHero` + `UpcomingArmfightsList` ("Ближайшие армфайты") |
| `/tournaments` | `MainArmfightMiniCard` |

**Countdown SSR safety:** render with a server time snapshot, start ticking on client after mount to avoid hydration mismatch.

---

## 6. Lifecycle & States

State derived from `startDate` + tournament status. **Live** = `startDate` reached AND status not `completed`/`cancelled`; **Finished** = status `completed`.

| State | `/` and `/sports/armwrestling` | `/tournaments` |
|---|---|---|
| **Upcoming** (flagged, future date) | Full hero + live countdown | Mini-card + mini-countdown |
| **Live** (between start and completion) | Hero; countdown replaced by "LIVE / Идёт" badge. Stream CTA hidden (feature-flag off in MVP) | Mini-card "Идёт" |
| **Finished** (`completed`) | Hero **removed entirely** | Mini-card only + **"Видео / YouTube"** button **iff** `armfight_video_url` is set |

- No featured event set → hero not rendered anywhere; the upcoming list works independently.
- Finished featured event automatically drops out of "featured" selection (it's `completed`); admin flags the next one.

---

## 7. Content & CTA

Per-event content shown: admin **poster** (background art — not data-driven "X vs Y", since an event has many pairs), **event title** (tournament name), **weight category / title** badge, **city**, **date/time**, **countdown**.

**Optional fields render only when set — no empty badges or placeholders** (`CLAUDE.md`: no empty states):
- The gold **weight / title badge** is shown **only if** a weight category and/or title is set for the event. If neither is set, the badge is omitted entirely and the layout closes the gap (it does not reserve empty space).
- Same rule for **city**: omitted if not provided.
- This conditional rendering is covered by component tests (badge present / absent).

CTA buttons in hero (MVP default):
- Primary: **"Участники и сетка"** → tournament bracket page.
- Secondary: **"Подробнее о событии"** → public tournament page.
- "Смотреть трансляцию" — slot reserved, hidden until streaming exists (future, feature-flagged via `stream_url`).

Post-event mini-card CTA: **"Видео / YouTube"** → `armfight_video_url` (hidden if empty).

---

## 8. Admin

Extend the existing tournament wizard (`apps/web/src/components/admin/tournament-wizard/`):
- Toggle **"Главное событие (армфайт)"** (only meaningful when `format = 'armfight'`).
- Optional input **"Ссылка на видео / YouTube"** (`armfight_video_url`).

Backend note: `admin.service.ts:120` strips some fields on PATCH and refuses edits when `bracketGenerated`. These new fields are simple nullable scalars (unlike `weightCategories`) and **must be allowed through on both create and edit**, including when a bracket exists (flagging a main event / adding a video link must work post-bracket).

---

## 9. Testing (Vitest)

Backend (`apps/api`, `*.spec.ts`, repos mocked via `getRepositoryToken()`):
- Featured selection: flagged+soonest+not-completed; multiple flagged → soonest; flagged then completed → excluded; none flagged → null.
- List filter `format=armfight` + pagination cap (≤100).
- DTO validation (flag boolean, URL fields).

Frontend (`apps/web`, Vitest already wired; component pattern from PR #96):
- `useCountdown` pure logic: boundaries (0, elapsed/live, large day counts), zero-padding, ICU plurals (1 день / 2 дня / 5 дней).
- Component tests: hero states (upcoming / live / finished-hidden / no-featured); weight/title badge present vs. absent; city present vs. absent; mini-card shows video button only when `armfight_video_url` present.

Migration verified to apply and revert.

---

## 10. Conventions Compliance Checklist

- [ ] No business logic in controllers (featured selection in service)
- [ ] DTOs with `class-validator` (`@IsUrl`, `@IsBoolean`)
- [ ] TypeORM entity change → generated migration
- [ ] Public pages SSR; React Query for client data
- [ ] All UI text via `next-intl` (`armfight` namespace), no hardcoded strings
- [ ] Combat Energy tokens/primitives reused; red used only per design-system rules
- [ ] `*.spec.ts` for new logic
- [ ] `npx turbo lint` passes
- [ ] Commit format: `feat(web)` / `feat(api)` / `docs(...)`, branch `feature/armfight-section`

---

## 11. Decomposition Note

Sub-project **B** (armfight match rules: 5 simultaneous pairs, best-of-5 scoring, bracket in `packages/bracket-engine` with 90%+ coverage) is intentionally deferred to its own spec → plan → implementation cycle, started immediately after A ships. A delivers user-visible discovery/promo value without touching the critical bracket engine.
