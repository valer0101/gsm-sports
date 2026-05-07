# Combat Energy Design System — Handoff

> **Established:** 2026-05-06 in PR [#80](https://github.com/valer0101/gsm-sports/pull/80) — admin tournament-creation wizard.
> **Status:** in-flight. Wizard is the first surface using this language; bracket-related pages are next.
> This doc is the handoff for any future session continuing the redesign.

---

## 1. What's done

`/admin/tournaments/new` — 4-step wizard (Basic → Format → Categories → Registration & Prizes).

Highlights:
- "Combat Energy" visual language (deep navy + signal red + gold) extending existing tokens in `globals.css`.
- 4-step shell with animated transitions, shake-on-disabled-Next, focus management, mobile reflow.
- Sub-page primitives split out for reuse: `Section`, `Label`, `Helper`, `TextInput`, `DateTimeInput`, `Toggle`, `BigChoiceCard`, `HandCard`, `PosterUpload`, `SportSelect`, `PlaceGroup`, `PrizeRow`, `ReviewBlock`, `WizardProgress`, `WizardFooter`.
- Pure-logic helpers: `slug.ts` (Cyrillic transliterator), `prize-calc.ts` (override cascade across `(age × weight)`).
- Vitest configured in `apps/web` for the first time; 28 tests cover the helpers.

Spec: [`docs/design/admin-tournament-wizard.md`](./admin-tournament-wizard.md).

---

## 2. Design tokens

All in `apps/web/src/app/globals.css`. The wizard added the lower half of the table (the "NEW" tokens). Reuse these — don't introduce parallel tokens for new pages.

| Token | Hex | Usage |
|---|---|---|
| `--color-background` | `#0F0F1A` | Page background |
| `--color-surface` | `#1A1A2E` | Cards, sections |
| `--color-surface-2` | `#252538` | Inputs, hover, elevated cards |
| `--color-border` | `#2E2E45` | Default borders |
| `--color-border-strong` | `#43435A` | Hover/active borders |
| `--color-text-primary` | `#FFFFFF` | Headings, primary text |
| `--color-text-secondary` | `#A0A0B0` | Helpers, labels |
| `--color-text-muted` | `#6A6A80` | Disabled, placeholders |
| `--color-primary` | `#C8102E` | Primary CTA, current step, "live" indicators |
| `--color-primary-hover` | `#E11D3A` | CTA hover |
| `--color-primary-dim` | `rgba(200,16,46,0.12)` | Active backgrounds, focus rings |
| `--color-accent` | `#FFD700` | Gold — 1st place, featured badges, money totals |
| `--color-success` | `#22C55E` | Completed steps, confirmed states |
| `--color-error` | `#EF4444` | Form errors (distinct from primary red) |
| `--color-warning` | `#F59E0B` | Drafts, soft warnings |

**Rules:**
- Sport red (`--color-primary`) is sacred — only for primary CTA, current step, "live", brand accents. Form errors use `--color-error` (orange-red) on purpose.
- Body font: `Inter`. Mono font for stats/weights/money: any system mono (already inherits from existing CSS).
- Border radius: 6px for inputs/buttons, 10px for cards.
- Animations defined in `globals.css`: `wizard-step-in` (slide+fade 240ms), `wizard-shake` (4px shake 280ms). Reuse for new wizards.

---

## 3. Reusable primitives

All under `apps/web/src/app/admin/tournaments/new/_components/`. They are currently route-local (private folder), but **promote them to `apps/web/src/components/wizard/`** if a second surface needs them.

| Primitive | File | What it does |
|---|---|---|
| `Section` / `SectionTitle` / `Label` / `Helper` | `_components/fields/Section.tsx` | Form layout primitives |
| `TextInput` | `_components/fields/TextInput.tsx` | Standard input with optional left icon |
| `DateTimeInput` | `_components/fields/DateTimeInput.tsx` | Datetime picker with min/disabled/invalid props |
| `Toggle` | `_components/fields/Toggle.tsx` | Pill-style on/off switch |
| `BigChoiceCard` | `_components/fields/BigChoiceCard.tsx` | Large icon + title + subtitle radio (e.g. SETKA / ARMFIGHT) |
| `HandCard` | `_components/fields/HandCard.tsx` | Smaller icon + title selector with extra note slot |
| `PosterUpload` | `_components/fields/PosterUpload.tsx` | Drag-drop image upload with instant preview + spinner overlay |
| `SportSelect` | `_components/fields/SportSelect.tsx` | Custom dropdown bound to `useSports()` (re-exported from `@/hooks/useAthletes`) |
| `WizardProgress` | `_components/WizardProgress.tsx` | Numbered nodes (desktop) / thin bar (mobile) |
| `WizardFooter` | `_components/WizardFooter.tsx` | Sticky Previous / Next / Create row |
| `ReviewBlock` | `_components/ReviewBlock.tsx` | Final-step summary card with edit-step jumps |
| `PlaceGroup` / `PrizeRow` | `_components/PlaceGroup.tsx` + `PrizeRow.tsx` | Per-place prize card with multiple rewards |

**Convention for new surfaces:**
1. If you need 1-2 of these, import directly from the wizard path.
2. If you need 3+, **promote** them to `apps/web/src/components/` first (its own commit). Don't duplicate.

---

## 4. Conventions

### 4.1 i18n
- Wizard owns the `tournament_wizard` namespace in `apps/web/src/messages/{en,ru,hy}.json` — 211 keys.
- New surfaces should use **their own namespace** (e.g. `tournament_arena`, `tournament_admin_detail`). Don't pile into `tournament_wizard`.
- Russian translations are first-class. Armenian fallbacks to English on hard keys — the project translates later, that's fine.
- Always use `useTranslations('namespace')`. Never hardcode user-facing strings.

### 4.2 Tests
- `vitest.config.ts` lives at `apps/web/vitest.config.ts` (env: node, since wizard tests don't touch DOM).
- Add `*.spec.ts` next to source files.
- For React component tests, switch the env to `jsdom` and add `@testing-library/react` (not in deps yet).
- Run: `cd apps/web && npm run test` (or `npm run test:watch`).

### 4.3 File structure for new wizards / multi-step pages
```
<route>/
├── page.tsx                              # orchestrator only (state + props passing)
├── _lib/
│   ├── icons.tsx                         # all SVGs as { name: () => JSX }
│   ├── types.ts                          # type definitions
│   ├── constants.ts                      # static lists (presets, options)
│   ├── hooks.ts                          # API hooks (or re-exports)
│   └── <pure-logic>.ts                   # plus *.spec.ts
└── _components/
    ├── fields/                           # input primitives
    └── steps/                            # one file per step
```

For non-wizard routes (single-page), drop `steps/` and put main render directly in `page.tsx` — but keep the `_lib` and `_components/fields` split.

### 4.4 API
- Forms submit via existing hooks in `apps/web/src/hooks/useAdmin.ts` (or sibling). Don't duplicate mutations — extend the hook file.
- Backend `CreateTournamentDto` whitelists fields strictly. When in doubt, **read the DTO** — saved 3 round-trips on this PR. Pattern: `apps/api/src/<domain>/dto/<verb>-<entity>.dto.ts`.

### 4.5 A11y baseline
- `aria-live="polite"` on the step content container.
- Focus moves to the step heading on each step change (`tabIndex={-1}` + `ref.focus()`).
- `aria-disabled` (not `disabled`) on Next while invalid — keeps the button focusable so a click can shake the form.
- Color is never the only error signal — pair with icon + text.

---

## 5. Next pages to redesign (bracket-connected)

User priority on 2026-05-06: continue the redesign on bracket-related surfaces. In rough order of value:

| # | Route | What it is | Notes |
|---|---|---|---|
| 1 | `/tournaments/[slug]` | **Public tournament page** — the place where the bracket is displayed to spectators / participants | Highest visible impact. Should land first. SSR for SEO (per CLAUDE.md). |
| 2 | `/tournaments/[slug]/arena` | **Live arena view** — projected on the venue screen | Public, full-screen layout (no app chrome). `ConditionalLayout` already bypasses chrome for `arena/*`. |
| 3 | `/tournaments/[slug]/broadcast/[tableId]` | **OBS overlay** for a single table | Already has chroma-free version (PR #25). Could use a Combat Energy refresh for the dark-bg variant. |
| 4 | `/operator/tournaments/[tournamentId]` | **Operator console** — running matches at a table | Live operational tool — minimalism + readability matter more than wow. |
| 5a | `/admin/tournaments/[id]` | **Admin tournament detail** (Combat Energy redesign) | Reuse wizard primitives for the read-only summary header. Adds `✏️ Редактировать` link to the new `/edit` route. |
| 5b | `/admin/tournaments/[id]/edit` | **Admin tournament edit** (NEW route) | Reuses the create wizard verbatim — same 4 steps, same primitives — with `mode="edit"` and `initialData` preloaded from `useAdminTournament(id)`. Submit via `useUpdateTournament(id)`. See §7 for the full decision. |
| 6 | `/admin/tournaments/[id]/check-in` | **QR check-in scanner** | Already PR #24. Smaller refresh. |

**Suggested approach for each:**
1. Start with a design spec at `docs/design/<route>.md` (mirror what `admin-tournament-wizard.md` does — sections + decisions).
2. Build a prototype at the same URL but in a `_design/` private folder if needed for iteration; otherwise edit in place.
3. Reuse tokens, primitives, conventions from §2-4.
4. Add tests for any new pure logic.
5. Run `npm run typecheck && npm run test` before push.
6. Open PR with the same review checklist (i18n, next/image, no duplicate hooks, tests).

---

## 6. Tech context (so a fresh session doesn't have to re-discover)

- **Stack**: Next.js 15 App Router, React 19, Tailwind v4 (CSS-first config), TypeScript 5.7, next-intl 4.x.
- **Auth**: `apps/web/src/middleware.ts` gates `/admin/*` and `/operator/*` via JWT cookie + role check.
- **API client**: `apps/web/src/lib/api.ts` — Axios with `withCredentials`, base URL `NEXT_PUBLIC_API_URL` (defaults `http://localhost:4000/v1`).
- **State**: React Query (`@tanstack/react-query` ^5) for fetching; Zustand for client-only state (not used in wizard yet — useState lifted to orchestrator was enough).
- **Forms**: CLAUDE.md prescribes React Hook Form + Zod, but the wizard uses controlled `useState` everywhere (works fine, satisfies "no uncontrolled forms"). For larger forms / heavy validation, consider RHF.
- **No vitest before this PR in `apps/web`** — vitest config + 28 tests landed with the wizard.
- **CLAUDE.md violations to watch**: `next lint` is broken (interactive setup not done at the project level — pre-existing gap, not blocking). `RichTextEditor.tsx:84` has a tiptap signature drift that breaks `next build` (pre-existing, separate task chip).

---

## 7. Open questions / known gaps for the next surface

- **Toast library** — wizard uses inline error banner + `confirm()`. Next surfaces should consider sonner (most popular Next.js choice). Affects every page that mutates.
- **Edit page (DECIDED 2026-05-07)** — admin tournament edit ships at its own route `/admin/tournaments/[id]/edit` and reuses the create wizard verbatim. The wizard component must be parameterized: extract to `_components/TournamentWizard.tsx` (or similar shared location) accepting `mode: 'create' | 'edit'`, `initialData?: Partial<Tournament>`, `onSubmit: (payload) => Promise`. The two route orchestrators become thin: `/new/page.tsx` passes `mode="create"` + `useCreateTournament().mutateAsync`; `/[id]/edit/page.tsx` fetches via `useAdminTournament(id)`, passes `mode="edit" initialData={tournament}` + `useUpdateTournament(id).mutateAsync`. Detail page (`/admin/tournaments/[id]`) gets a "✏️ Редактировать" link in the header to the edit route. **Inline editing on the detail page is rejected** — one URL one purpose; back button + dirty-guard work cleanly only when edit owns its own page. **Destructive actions stay on the detail page** (close registration, delete, generate brackets) — edit covers metadata only. This is the path for any "edit X" pattern across the app.
- **Slug uniqueness check** — debounced `GET /admin/tournaments/check-slug` would be a small UX win in Step 1, deferred from this PR.
- **Per-(age × weight) prize backend support** — wizard ships `ageGroup` + `weightCategoryId` on each prize entry into `sportConfig.prizes` JSONB, but the public tournament page doesn't yet parse that hierarchy. This connects to the `/tournaments/[slug]` redesign.
- **Per-category gender override** — Step 3 has a tournament-level `Genders competing` toggle, but no per-category gender selection (the underlying type field exists, the UI was deferred).
