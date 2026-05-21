# Armfight Pair-Builder UI (Sub-Project C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin pair-builder route at `/admin/tournaments/[id]/armfight-pairs` so an admin can curate the `pairs[]` for an armfight tournament from the UI (instead of `curl`).

**Architecture:** Pure-frontend feature in `apps/web`. One new route page + 4 components + 3 React Query hooks + an `armfight_pairs` i18n namespace, plus a conditional CTA on the existing tournament detail page. No backend changes — uses already-existing endpoints (`GET /admin/tournaments/:id`, `GET /admin/tournaments/:id/brackets`, `GET /entries/tournament/:id`, `POST /v1/brackets` with `pairs[]`, `PATCH /v1/brackets/:id/reset`).

**Tech Stack:** Next.js 14 App Router, React 19, TypeScript, Tailwind, shadcn-ish primitives, React Query, `next-intl`, Vitest (`jsdom` + `@testing-library/react`).

**Spec:** `docs/superpowers/specs/2026-05-21-armfight-pair-builder-design.md` (commit `cf6b875` on this branch). Treat the spec as authoritative when this plan is silent.

---

## File Structure

**Created:**
- `apps/web/src/app/admin/tournaments/[id]/armfight-pairs/page.tsx` — route, 4-state switch.
- `apps/web/src/components/admin/armfight-pairs/PairBuilder.tsx` — state 2 form.
- `apps/web/src/components/admin/armfight-pairs/PairRow.tsx` — single pair slot.
- `apps/web/src/components/admin/armfight-pairs/PairsSummary.tsx` — read-only view (states 3+4).
- `apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.tsx` — state 1.
- `apps/web/src/components/admin/armfight-pairs/types.ts` — `PairDraft`, `PairPayload`.
- Five spec files colocated next to each component (`*.spec.tsx`).
- One spec for the page (`page.spec.tsx`).

**Modified:**
- `apps/web/src/hooks/useAdmin.ts` — append `useArmfightBracket`, `useGenerateArmfightBracket`, `useResetBracket`.
- `apps/web/src/messages/ru.json`, `en.json`, `hy.json` — add `armfight_pairs` namespace + `build_pairs_and_generate` key in the existing `admin_tournament_detail` namespace.
- `apps/web/src/app/admin/tournaments/[id]/page.tsx` — conditional CTA for armfight tournaments (replaces the existing generate-button + dialog for that one branch).

**Not modified:**
- `apps/web/src/components/admin/tournament-wizard/**` — wizard stays as-is.
- `apps/api/**`, `packages/**` — no backend / engine / types changes.

---

## Task 1: Pre-flight + i18n namespace

Add the new `armfight_pairs` namespace to all three locale files. Doing i18n first means every component can use `useTranslations('armfight_pairs')` from the moment it's written.

**Files:**
- Modify: `apps/web/src/messages/ru.json`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/hy.json`

- [ ] **Step 1: Confirm branch state**

Run: `git status --short && git log --oneline -3`
Expected: clean working tree on `feature/armfight-pair-builder`, with `cf6b875 docs(web): armfight pair-builder UI spec` as HEAD.

- [ ] **Step 2: Add `armfight_pairs` to `ru.json`**

Open `apps/web/src/messages/ru.json`. Append at the top level (e.g., right after the existing `"armfight": { … }` namespace from sub-project A — confirm with `grep -n '"armfight":' apps/web/src/messages/ru.json`). Insert:

```json
,
  "armfight_pairs": {
    "page_title": "Сборка пар",
    "back_to_tournament": "← К турниру",
    "empty_no_entries_title": "Подтверждённых участников пока нет",
    "empty_no_entries_body": "Откройте регистрацию и дождитесь, пока заявки участников будут подтверждены, прежде чем собирать пары.",
    "roster_title": "Подтверждённые атлеты",
    "roster_count": "{n, plural, one {# атлет} few {# атлета} other {# атлетов}}",
    "pairs_title": "Пары",
    "pairs_count": "{n, plural, one {# пара} few {# пары} other {# пар}}",
    "pair_label": "Пара {n}",
    "add_pair": "+ Добавить пару",
    "remove_pair": "Удалить пару",
    "select_player_placeholder": "— Выбери атлета —",
    "select_hand_placeholder": "— Выбери руку —",
    "hand_left": "Левая",
    "hand_right": "Правая",
    "unpaired_warning": "{n, plural, one {# атлет не в паре} few {# атлета не в парах} other {# атлетов не в парах}}",
    "incomplete_pair_warning": "Пара {n} не заполнена",
    "submit": "Сформировать сетку",
    "submitting": "Формируем…",
    "submit_success_toast": "Сетка собрана из {n, plural, one {# пары} few {# пар} other {# пар}}",
    "rebuild_title": "Сетка уже сформирована",
    "rebuild_body": "Чтобы пересобрать пары, нужно сначала удалить существующую сетку.",
    "rebuild_btn": "Удалить и пересобрать",
    "rebuild_confirm_title": "Удалить сетку?",
    "rebuild_confirm_body": "Сетка и все записанные результаты будут удалены. Это действие необратимо.",
    "rebuild_confirm_yes": "Удалить",
    "rebuild_confirm_no": "Отмена",
    "readonly_completed_note": "Турнир завершён. Пары доступны только для чтения.",
    "not_armfight_title": "Это не армфайт-турнир",
    "not_armfight_body": "Сборка пар доступна только для турниров с типом «армфайт»."
  }
```

Also add `"build_pairs_and_generate": "Сформировать пары и сгенерировать сетку"` inside the existing `"admin_tournament_detail"` namespace (find with `grep -n '"generate_btn"' apps/web/src/messages/ru.json` — should be around line 375; insert the new key right after `generate_btn`).

- [ ] **Step 3: Add the same namespace to `en.json`**

```json
,
  "armfight_pairs": {
    "page_title": "Build pairs",
    "back_to_tournament": "← Back to tournament",
    "empty_no_entries_title": "No confirmed entries yet",
    "empty_no_entries_body": "Open registration and wait for athletes to be confirmed before building pairs.",
    "roster_title": "Confirmed athletes",
    "roster_count": "{n, plural, one {# athlete} other {# athletes}}",
    "pairs_title": "Pairs",
    "pairs_count": "{n, plural, one {# pair} other {# pairs}}",
    "pair_label": "Pair {n}",
    "add_pair": "+ Add pair",
    "remove_pair": "Remove pair",
    "select_player_placeholder": "— Select athlete —",
    "select_hand_placeholder": "— Select hand —",
    "hand_left": "Left",
    "hand_right": "Right",
    "unpaired_warning": "{n, plural, one {# athlete is not in any pair} other {# athletes are not in any pair}}",
    "incomplete_pair_warning": "Pair {n} is not complete",
    "submit": "Generate bracket",
    "submitting": "Generating…",
    "submit_success_toast": "Bracket created from {n, plural, one {# pair} other {# pairs}}",
    "rebuild_title": "Bracket already generated",
    "rebuild_body": "To re-pair, you'll need to delete the existing bracket first.",
    "rebuild_btn": "Delete and rebuild",
    "rebuild_confirm_title": "Delete this bracket?",
    "rebuild_confirm_body": "The bracket and any recorded results will be cleared. This cannot be undone.",
    "rebuild_confirm_yes": "Delete",
    "rebuild_confirm_no": "Cancel",
    "readonly_completed_note": "This tournament is completed. Pairs are read-only.",
    "not_armfight_title": "Not an armfight tournament",
    "not_armfight_body": "Pair-building is only available for tournaments of type \"armfight\"."
  }
```

Add `"build_pairs_and_generate": "Build pairs & generate bracket"` to the `admin_tournament_detail` namespace.

- [ ] **Step 4: Add the same to `hy.json`**

```json
,
  "armfight_pairs": {
    "page_title": "Զույգերի կազմում",
    "back_to_tournament": "← Դեպի մրցաշար",
    "empty_no_entries_title": "Հաստատված մասնակիցներ դեռ չկան",
    "empty_no_entries_body": "Բացեք գրանցումը և սպասեք, որ մասնակիցների հայտերը հաստատվեն, նախքան զույգերը կազմելը:",
    "roster_title": "Հաստատված մարզիկներ",
    "roster_count": "{n, plural, one {# մարզիկ} other {# մարզիկներ}}",
    "pairs_title": "Զույգեր",
    "pairs_count": "{n, plural, one {# զույգ} other {# զույգ}}",
    "pair_label": "Զույգ {n}",
    "add_pair": "+ Ավելացնել զույգ",
    "remove_pair": "Հեռացնել զույգը",
    "select_player_placeholder": "— Ընտրեք մարզիկին —",
    "select_hand_placeholder": "— Ընտրեք ձեռքը —",
    "hand_left": "Ձախ",
    "hand_right": "Աջ",
    "unpaired_warning": "{n, plural, one {# մարզիկ զույգում չէ} other {# մարզիկներ զույգերում չեն}}",
    "incomplete_pair_warning": "Զույգ {n}-ը լրացված չէ",
    "submit": "Կազմել ցանցը",
    "submitting": "Կազմում ենք…",
    "submit_success_toast": "Ցանցը կազմված է {n, plural, one {# զույգից} other {# զույգերից}}",
    "rebuild_title": "Ցանցն արդեն կազմված է",
    "rebuild_body": "Զույգերը վերակազմելու համար նախ պետք է ջնջել առկա ցանցը:",
    "rebuild_btn": "Ջնջել և վերակազմել",
    "rebuild_confirm_title": "Ջնջե՞լ ցանցը:",
    "rebuild_confirm_body": "Ցանցը և գրանցված ցանկացած արդյունք կջնջվեն: Սա չի կարելի հետ բերել:",
    "rebuild_confirm_yes": "Ջնջել",
    "rebuild_confirm_no": "Չեղարկել",
    "readonly_completed_note": "Մրցաշարն ավարտված է: Զույգերը հասանելի են միայն ընթերցման համար:",
    "not_armfight_title": "Սա արմֆայթ մրցաշար չէ",
    "not_armfight_body": "Զույգերի կազմումը հասանելի է միայն «արմֆայթ» տիպի մրցաշարերի համար:"
  }
```

Add `"build_pairs_and_generate": "Կազմել զույգեր և գեներացնել ցանց"` to the `admin_tournament_detail` namespace.

- [ ] **Step 5: Validate JSON + run existing web tests**

Run:
```bash
node -e "require('./apps/web/src/messages/ru.json');require('./apps/web/src/messages/en.json');require('./apps/web/src/messages/hy.json'); console.log('all json valid');"
cd apps/web && npx vitest run 2>&1 | tail -5
```
Expected: `all json valid` + 165+ tests pass (no regressions in existing i18n-driven tests).

- [ ] **Step 6: Commit**

```bash
cd /Users/valeryordanyan/Desktop/GSM/gsm-sports
git add apps/web/src/messages/ru.json apps/web/src/messages/en.json apps/web/src/messages/hy.json
git commit -m "$(cat <<'EOF'
feat(web,i18n): armfight_pairs namespace + build_pairs_and_generate key

i18n entries for sub-project C — pair-builder UI. Adds the
armfight_pairs namespace (~30 keys) to ru/en/hy with ICU plurals for
roster/pairs counts. Also adds build_pairs_and_generate to the
existing admin_tournament_detail namespace for the conditional CTA
on the tournament detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend types — `PairDraft` and `PairPayload`

**Files:**
- Create: `apps/web/src/components/admin/armfight-pairs/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// apps/web/src/components/admin/armfight-pairs/types.ts

/** One pair-slot in the builder UI. All three fields start empty;
 *  submit blocks until all three are filled. */
export interface PairDraft {
  /** Local-only id for React `key` + remove targeting. crypto.randomUUID(). */
  id: string;
  playerAId: string | '';
  playerBId: string | '';
  hand: 'left' | 'right' | '';
}

/** Engine-shape payload. `hand` narrowed; ''-states filtered out by the
 *  client validator before submit. */
export interface PairPayload {
  playerAId: string;
  playerBId: string;
  hand: 'left' | 'right';
}

/** Create a fresh empty slot — used on mount and on "+ Add pair". */
export function freshDraft(): PairDraft {
  return {
    id: crypto.randomUUID(),
    playerAId: '',
    playerBId: '',
    hand: '',
  };
}

/** Convert a complete draft to the engine payload. Returns null if any
 *  field is still empty — caller filters those out before submit. */
export function draftToPayload(d: PairDraft): PairPayload | null {
  if (!d.playerAId || !d.playerBId || !d.hand) return null;
  return { playerAId: d.playerAId, playerBId: d.playerBId, hand: d.hand };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean (no output, exit 0).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/admin/armfight-pairs/types.ts
git commit -m "$(cat <<'EOF'
feat(web): armfight-pairs types — PairDraft, PairPayload, helpers

Local-only types for the pair-builder UI: PairDraft (with '' empty
states for each select), PairPayload (engine shape), freshDraft()
for initial state / + Add pair, draftToPayload() for the submit
filter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Hook — `useArmfightBracket`

Derived from the existing `useAdminBrackets`. Reuses its query key so cache invalidations from other admin mutations flow through automatically.

**Files:**
- Modify: `apps/web/src/hooks/useAdmin.ts`
- Create: `apps/web/src/hooks/useAdmin.spec.ts` (if not present — first hook test in this file)

- [ ] **Step 1: Write failing test**

Locate or create `apps/web/src/hooks/useAdmin.spec.ts`. If it doesn't exist (check with `ls apps/web/src/hooks/useAdmin.spec.ts 2>/dev/null`), create it with:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArmfightBracket } from './useAdmin';

// Stub the `api` module so the hook doesn't try to hit a real backend.
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url.includes('/brackets')) {
        return {
          data: [
            { id: 'b1', bracketData: { format: 'double_elim' } },
            { id: 'b2', bracketData: { format: 'armfight' } },
          ],
        };
      }
      throw new Error(`unexpected url ${url}`);
    }),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useArmfightBracket', () => {
  it('finds and returns the armfight bracket from the list', async () => {
    const { result } = renderHook(() => useArmfightBracket('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toMatchObject({ id: 'b2' });
  });
});
```

If the file already exists, append the same `describe('useArmfightBracket', …)` block at the bottom.

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/hooks/useAdmin.spec.ts -t "useArmfightBracket"`
Expected: FAIL — `useArmfightBracket` not exported.

- [ ] **Step 3: Implement the hook**

In `apps/web/src/hooks/useAdmin.ts`, find the existing `useAdminBrackets` function (around line 167). Append immediately after it:

```ts
import type { Bracket } from '@/types/api';

/**
 * Derived hook: finds the armfight bracket among the tournament's
 * brackets list (at most one — armfight is a single fight card, not a
 * multi-category event). Reuses `useAdminBrackets`'s query so all
 * cache invalidations from existing bracket mutations flow through.
 */
export function useArmfightBracket(tournamentId: string) {
  const { data, ...rest } = useAdminBrackets(tournamentId);
  const bracket = (data ?? []).find(
    (b) => (b.bracketData as any)?.format === 'armfight',
  ) ?? null;
  return { ...rest, data: bracket };
}
```

(If `Bracket` is already imported at the top of this file, skip the duplicate import; otherwise add it.)

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/hooks/useAdmin.spec.ts -t "useArmfightBracket"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useAdmin.ts apps/web/src/hooks/useAdmin.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): useArmfightBracket — derived hook for finding the armfight bracket

Reuses useAdminBrackets's query key so the data flows in automatically
when other admin mutations invalidate the cache. Returns at most one
bracket per tournament (armfight is a single fight card).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Hook — `useGenerateArmfightBracket`

**Files:**
- Modify: `apps/web/src/hooks/useAdmin.ts`
- Modify: `apps/web/src/hooks/useAdmin.spec.ts`

- [ ] **Step 1: Write failing test**

Append to `useAdmin.spec.ts`:

```ts
import { useGenerateArmfightBracket } from './useAdmin';

describe('useGenerateArmfightBracket', () => {
  it('POSTs to /v1/brackets with format=armfight and the given pairs', async () => {
    const post = vi.fn(async () => ({ data: { id: 'new-bracket' } }));
    // Re-mock api with both .get and .post for this block
    vi.doMock('@/lib/api', () => ({ api: { get: vi.fn(), post } }));

    const { result } = renderHook(() => useGenerateArmfightBracket('t1'), { wrapper });
    result.current.mutate({
      pairs: [
        { playerAId: 'e1', playerBId: 'e2', hand: 'right' },
        { playerAId: 'e3', playerBId: 'e4', hand: 'left' },
      ],
    });
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/v1/brackets');
    expect(post.mock.calls[0][1]).toMatchObject({
      tournamentId: 't1',
      bracketFormat: 'armfight',
      pairs: [
        { playerAId: 'e1', playerBId: 'e2', hand: 'right' },
        { playerAId: 'e3', playerBId: 'e4', hand: 'left' },
      ],
    });
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/hooks/useAdmin.spec.ts -t "useGenerateArmfightBracket"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `apps/web/src/hooks/useAdmin.ts` (after `useArmfightBracket`):

```ts
import type { PairPayload } from '@/components/admin/armfight-pairs/types';

/**
 * Submit a curated `pairs[]` to create an armfight bracket. Routes
 * through the sub-project B path (POST /v1/brackets) rather than the
 * generic admin generate-brackets endpoint, which refuses armfight
 * (Task 20 of sub-project B).
 */
export function useGenerateArmfightBracket(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { pairs: PairPayload[] }) =>
      api
        .post('/v1/brackets', {
          tournamentId,
          bracketFormat: 'armfight',
          pairs: body.pairs,
        })
        .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/hooks/useAdmin.spec.ts -t "useGenerateArmfightBracket"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useAdmin.ts apps/web/src/hooks/useAdmin.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): useGenerateArmfightBracket — POST /v1/brackets with pairs[]

Mutation hook that submits the curated pair list. Invalidates both
admin/tournament/:id (for bracketGenerated flip) and
admin/brackets/:id (so useArmfightBracket re-fetches).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Hook — `useResetBracket`

**Files:**
- Modify: `apps/web/src/hooks/useAdmin.ts`
- Modify: `apps/web/src/hooks/useAdmin.spec.ts`

- [ ] **Step 1: Write failing test**

Append to `useAdmin.spec.ts`:

```ts
import { useResetBracket } from './useAdmin';

describe('useResetBracket', () => {
  it('PATCHes /v1/brackets/:id/reset and invalidates queries', async () => {
    const patch = vi.fn(async () => ({ data: { id: 'b2', bracketData: null } }));
    vi.doMock('@/lib/api', () => ({ api: { get: vi.fn(), patch } }));

    const { result } = renderHook(
      () => useResetBracket('t1', 'b2'),
      { wrapper },
    );
    result.current.mutate();
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/v1/brackets/b2/reset');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/hooks/useAdmin.spec.ts -t "useResetBracket"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `apps/web/src/hooks/useAdmin.ts`:

```ts
/**
 * PATCH a bracket back to `pending` — clears `bracketData`, unlocks,
 * resets modification counter. Used by the pair-builder rebuild flow
 * (state 3 → state 2).
 */
export function useResetBracket(tournamentId: string, bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch(`/v1/brackets/${bracketId}/reset`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/hooks/useAdmin.spec.ts -t "useResetBracket"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useAdmin.ts apps/web/src/hooks/useAdmin.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): useResetBracket — clears bracketData via PATCH /reset

Used by the pair-builder rebuild flow: state 3 (bracket generated)
→ reset → state 2 (form open again). PATCH /v1/brackets/:id/reset
is an existing endpoint that clears bracketData, status='pending'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `EmptyEntriesState` component (smallest, no deps)

**Files:**
- Create: `apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.tsx`
- Create: `apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.spec.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import { EmptyEntriesState } from './EmptyEntriesState';

describe('EmptyEntriesState', () => {
  it('renders the empty-state copy and a back link to the tournament', () => {
    render(<EmptyEntriesState tournamentId="t1" />);
    expect(screen.getByText('empty_no_entries_title')).toBeInTheDocument();
    expect(screen.getByText('empty_no_entries_body')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'back_to_tournament' });
    expect(link).toHaveAttribute('href', '/admin/tournaments/t1');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/EmptyEntriesState.spec.tsx`
Expected: FAIL — `EmptyEntriesState` not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.tsx`:

```tsx
import { useTranslations } from 'next-intl';
import Link from 'next/link';

/** State 1 — fewer than 2 confirmed entries OR tournament still in
 *  draft. Tells the admin to open registration first. */
export function EmptyEntriesState({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('armfight_pairs');
  return (
    <div className="max-w-xl mx-auto py-12 text-center">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
        {t('empty_no_entries_title')}
      </h2>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {t('empty_no_entries_body')}
      </p>
      <Link
        href={`/admin/tournaments/${tournamentId}`}
        className="inline-block mt-6 px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        {t('back_to_tournament')}
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/EmptyEntriesState.spec.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.tsx apps/web/src/components/admin/armfight-pairs/EmptyEntriesState.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): EmptyEntriesState — state 1 of the pair-builder

Empty-state panel for tournaments without confirmed entries. Shows
the copy from the armfight_pairs i18n namespace and a back link
to the tournament detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `PairRow` component (single slot with 3 selects + 🗑)

**Files:**
- Create: `apps/web/src/components/admin/armfight-pairs/PairRow.tsx`
- Create: `apps/web/src/components/admin/armfight-pairs/PairRow.spec.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/components/admin/armfight-pairs/PairRow.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

import { PairRow } from './PairRow';
import type { ConfirmedEntry } from '@/hooks/useAdmin';

const makeEntry = (id: string, name: string, kg: number, hand: 'left'|'right'): ConfirmedEntry => ({
  id, status: 'confirmed', ageGroup: null, hand, weightKg: kg, seedNumber: null,
  user: { id: `u-${id}`, firstName: name, lastName: 'X', avatarUrl: null },
});

const entries = [
  makeEntry('e1', 'Levon', 76, 'right'),
  makeEntry('e2', 'Garik', 78, 'right'),
  makeEntry('e3', 'Artur', 82, 'left'),
];

const emptyValue = { id: 'd1', playerAId: '' as const, playerBId: '' as const, hand: '' as const };

describe('PairRow', () => {
  it('renders three selects + a remove button', () => {
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={() => {}} />,
    );
    // 2 player selects + 1 hand select
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /remove_pair/i })).toBeInTheDocument();
  });

  it('shows entry options as "Name · weight · hand"', () => {
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={() => {}} />,
    );
    expect(screen.getByText('Levon X · 76kg · R')).toBeInTheDocument();
    expect(screen.getByText('Artur X · 82kg · L')).toBeInTheDocument();
  });

  it('calls onChange when playerA is picked', () => {
    const onChange = vi.fn();
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={onChange} onRemove={() => {}} />,
    );
    const [playerASelect] = screen.getAllByRole('combobox');
    fireEvent.change(playerASelect, { target: { value: 'e1' } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyValue, playerAId: 'e1' });
  });

  it('calls onChange when hand is picked', () => {
    const onChange = vi.fn();
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={onChange} onRemove={() => {}} />,
    );
    const selects = screen.getAllByRole('combobox');
    const handSelect = selects[2];
    fireEvent.change(handSelect, { target: { value: 'left' } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyValue, hand: 'left' });
  });

  it('calls onRemove when the trash button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remove_pair/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('disables all controls when disabled=true', () => {
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={() => {}} disabled />,
    );
    for (const sel of screen.getAllByRole('combobox')) {
      expect(sel).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /remove_pair/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/PairRow.spec.tsx`
Expected: FAIL — `PairRow` not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/admin/armfight-pairs/PairRow.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import type { ConfirmedEntry } from '@/hooks/useAdmin';
import type { PairDraft } from './types';

export interface PairRowProps {
  /** 0-based; UI displays index + 1. */
  index: number;
  /** All confirmed entries (no client-side filtering). */
  entries: ConfirmedEntry[];
  value: PairDraft;
  onChange: (next: PairDraft) => void;
  onRemove: () => void;
  /** During submit. */
  disabled?: boolean;
}

function labelForEntry(e: ConfirmedEntry): string {
  const name = `${e.user?.firstName ?? '—'} ${e.user?.lastName ?? ''}`.trim();
  const kg = e.weightKg != null ? `${e.weightKg}kg` : '?kg';
  const hand = e.hand === 'left' ? 'L' : e.hand === 'right' ? 'R' : '—';
  return `${name} · ${kg} · ${hand}`;
}

export function PairRow({ index, entries, value, onChange, onRemove, disabled }: PairRowProps) {
  const t = useTranslations('armfight_pairs');
  const baseSelectClass =
    'h-10 px-3 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-50';

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {t('pair_label', { n: index + 1 })}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('remove_pair')}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          🗑
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-2 items-center">
        <select
          value={value.playerAId}
          onChange={(e) => onChange({ ...value, playerAId: e.target.value })}
          disabled={disabled}
          className={baseSelectClass}
        >
          <option value="">{t('select_player_placeholder')}</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>{labelForEntry(e)}</option>
          ))}
        </select>

        <select
          value={value.playerBId}
          onChange={(e) => onChange({ ...value, playerBId: e.target.value })}
          disabled={disabled}
          className={baseSelectClass}
        >
          <option value="">{t('select_player_placeholder')}</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>{labelForEntry(e)}</option>
          ))}
        </select>

        <select
          value={value.hand}
          onChange={(e) => onChange({ ...value, hand: e.target.value as 'left' | 'right' | '' })}
          disabled={disabled}
          className={baseSelectClass}
        >
          <option value="">{t('select_hand_placeholder')}</option>
          <option value="left">{t('hand_left')}</option>
          <option value="right">{t('hand_right')}</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/PairRow.spec.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/armfight-pairs/PairRow.tsx apps/web/src/components/admin/armfight-pairs/PairRow.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): PairRow — one pair slot (3 selects + remove button)

Controlled component: playerA, playerB, hand selects + trash button.
Entries shown as 'Name · weight · hand' per spec §6. No client-side
auto-filter — all selects show all entries; dup detection happens
on submit via the server's clean 400 (PR #107 Fix #5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `PairBuilder` component (state 2 — the main form)

**Files:**
- Create: `apps/web/src/components/admin/armfight-pairs/PairBuilder.tsx`
- Create: `apps/web/src/components/admin/armfight-pairs/PairBuilder.spec.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/components/admin/armfight-pairs/PairBuilder.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mutate = vi.fn();
const useGenerateArmfightBracketMock = vi.fn(() => ({
  mutate,
  isPending: false,
  isError: false,
  error: null,
}));
vi.mock('@/hooks/useAdmin', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useAdmin')>('@/hooks/useAdmin');
  return {
    ...actual,
    useGenerateArmfightBracket: (...args: any[]) => useGenerateArmfightBracketMock(...args),
  };
});

import { PairBuilder } from './PairBuilder';
import type { ConfirmedEntry } from '@/hooks/useAdmin';

const makeEntry = (id: string, name: string): ConfirmedEntry => ({
  id, status: 'confirmed', ageGroup: null, hand: 'right', weightKg: 80, seedNumber: null,
  user: { id: `u-${id}`, firstName: name, lastName: 'X', avatarUrl: null },
});

const entries = [
  makeEntry('e1', 'A'),
  makeEntry('e2', 'B'),
  makeEntry('e3', 'C'),
  makeEntry('e4', 'D'),
];

describe('PairBuilder', () => {
  beforeEach(() => {
    mutate.mockClear();
    useGenerateArmfightBracketMock.mockClear();
  });

  it('starts with one empty pair slot', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    expect(screen.getAllByText('pair_label').length).toBe(1);
  });

  it('+ Add pair grows the array', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    fireEvent.click(screen.getByRole('button', { name: /add_pair/i }));
    expect(screen.getAllByText('pair_label').length).toBe(2);
  });

  it('renders roster count from confirmed entries', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    // roster_count is rendered via t() — text passes through our mock
    expect(screen.getByText('roster_count')).toBeInTheDocument();
  });

  it('submit blocked when any pair is incomplete', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    const submit = screen.getByRole('button', { name: /^submit$/ });
    fireEvent.click(submit);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit succeeds when all rows are complete', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'e1' } });
    fireEvent.change(selects[1], { target: { value: 'e2' } });
    fireEvent.change(selects[2], { target: { value: 'right' } });

    fireEvent.click(screen.getByRole('button', { name: /^submit$/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      pairs: [{ playerAId: 'e1', playerBId: 'e2', hand: 'right' }],
    });
  });

  it('shows unpaired warning when entries.length - pairs.length*2 > 0', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    // Fill one pair → 2 entries paired, 2 unpaired
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'e1' } });
    fireEvent.change(selects[1], { target: { value: 'e2' } });
    fireEvent.change(selects[2], { target: { value: 'right' } });
    expect(screen.getByText('unpaired_warning')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/PairBuilder.spec.tsx`
Expected: FAIL — `PairBuilder` not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/admin/armfight-pairs/PairBuilder.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useGenerateArmfightBracket, type ConfirmedEntry } from '@/hooks/useAdmin';
import { PairRow } from './PairRow';
import { freshDraft, draftToPayload, type PairDraft } from './types';

export interface PairBuilderProps {
  tournamentId: string;
  confirmedEntries: ConfirmedEntry[];
}

function labelForEntry(e: ConfirmedEntry): string {
  const name = `${e.user?.firstName ?? '—'} ${e.user?.lastName ?? ''}`.trim();
  const kg = e.weightKg != null ? `${e.weightKg}kg` : '?kg';
  const hand = e.hand === 'left' ? 'L' : e.hand === 'right' ? 'R' : '—';
  return `${name} · ${kg} · ${hand}`;
}

export function PairBuilder({ tournamentId, confirmedEntries }: PairBuilderProps) {
  const t = useTranslations('armfight_pairs');
  const router = useRouter();
  const [pairs, setPairs] = useState<PairDraft[]>(() => [freshDraft()]);
  const generate = useGenerateArmfightBracket(tournamentId);

  const completePayloads = useMemo(
    () => pairs.map(draftToPayload).filter((p): p is NonNullable<typeof p> => p !== null),
    [pairs],
  );
  const incompleteIndex = pairs.findIndex((p) => draftToPayload(p) === null);
  const usedPlayerCount = completePayloads.length * 2;
  const unpairedCount = Math.max(0, confirmedEntries.length - usedPlayerCount);

  const canSubmit =
    !generate.isPending &&
    completePayloads.length >= 1 &&
    incompleteIndex === -1;

  const onSubmit = () => {
    if (!canSubmit) return;
    generate.mutate(
      { pairs: completePayloads },
      {
        onSuccess: () => {
          router.push(`/admin/tournaments/${tournamentId}`);
        },
      },
    );
  };

  const errorMessage =
    generate.isError
      ? ((generate.error as any)?.response?.data?.message
          ?? (generate.error as any)?.message
          ?? 'error')
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
      {/* Roster — read-only */}
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-2">
          {t('roster_title')}
        </div>
        <div className="text-sm text-[var(--color-text-secondary)] mb-3">
          {t('roster_count', { n: confirmedEntries.length })}
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] divide-y divide-[var(--color-border)]">
          {confirmedEntries.map((e) => (
            <div key={e.id} className="px-3 py-2 text-sm text-[var(--color-text-primary)]">
              {labelForEntry(e)}
            </div>
          ))}
        </div>
      </div>

      {/* Pairs */}
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {t('pairs_count', { n: pairs.length })}
        </div>

        {pairs.map((p, idx) => (
          <PairRow
            key={p.id}
            index={idx}
            entries={confirmedEntries}
            value={p}
            onChange={(next) => setPairs(pairs.map((x) => (x.id === p.id ? next : x)))}
            onRemove={() => setPairs(pairs.filter((x) => x.id !== p.id))}
            disabled={generate.isPending}
          />
        ))}

        <button
          type="button"
          onClick={() => setPairs([...pairs, freshDraft()])}
          disabled={generate.isPending}
          className="px-4 py-2 rounded-md text-sm font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('add_pair')}
        </button>

        {/* Warnings */}
        {incompleteIndex !== -1 && (
          <div className="text-sm text-[var(--color-error)]">
            {t('incomplete_pair_warning', { n: incompleteIndex + 1 })}
          </div>
        )}
        {unpairedCount > 0 && (
          <div className="text-sm text-[var(--color-warning)]">
            ⚠ {t('unpaired_warning', { n: unpairedCount })}
          </div>
        )}
        {errorMessage && (
          <div className="text-sm text-[var(--color-error)] whitespace-pre-wrap">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto px-6 py-3 rounded-md text-sm font-bold uppercase tracking-wide bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {generate.isPending ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/PairBuilder.spec.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/armfight-pairs/PairBuilder.tsx apps/web/src/components/admin/armfight-pairs/PairBuilder.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): PairBuilder — state 2 form (roster + pairs + submit)

Two-column layout: confirmed entries roster on the left (read-only),
list of PairRow's + add/submit controls on the right. Submit blocked
while any pair is incomplete; warning shown when there are unpaired
entries (per spec §6.3). On success → navigate to detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `PairsSummary` component (states 3 + 4 — read-only)

**Files:**
- Create: `apps/web/src/components/admin/armfight-pairs/PairsSummary.tsx`
- Create: `apps/web/src/components/admin/armfight-pairs/PairsSummary.spec.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/components/admin/armfight-pairs/PairsSummary.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const mutate = vi.fn();
const useResetBracketMock = vi.fn(() => ({ mutate, isPending: false, isError: false, error: null }));
vi.mock('@/hooks/useAdmin', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useAdmin')>('@/hooks/useAdmin');
  return {
    ...actual,
    useResetBracket: (...args: any[]) => useResetBracketMock(...args),
  };
});

import { PairsSummary } from './PairsSummary';
import type { Bracket } from '@/types/api';

const makeBracket = (): Bracket => ({
  id: 'b1',
  tournamentId: 't1',
  weightCategoryId: null,
  status: 'active',
  isLocked: false,
  modificationCount: 0,
  lastModifiedBy: null,
  lastModifiedAt: null,
  completedAt: null,
  bracketData: {
    format: 'armfight',
    bracketSize: 4,
    wbRounds: 1,
    players: [],
    losersBracket: [],
    grandFinal: { id: 'gf' } as any,
    superFinal: { id: 'sf', needed: false } as any,
    champion: null,
    status: 'active',
    winnersBracket: [[
      {
        id: 'wb_1_0', round: 1, matchIndex: 0,
        player1: { id: 'p1', firstName: 'Levon', lastName: 'H', number: 1 },
        player2: { id: 'p2', firstName: 'Garik', lastName: 'P', number: 2 },
        winner: null, loser: null,
        result: { hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' } as any,
      } as any,
      {
        id: 'wb_1_1', round: 1, matchIndex: 1,
        player1: { id: 'p3', firstName: 'Artur', lastName: 'K', number: 3 },
        player2: { id: 'p4', firstName: 'Vahe', lastName: 'M', number: 4 },
        winner: null, loser: null,
        result: { hand: 'left', legs: [], scoreA: 0, scoreB: 0, status: 'pending' } as any,
      } as any,
    ]],
  } as any,
} as any);

describe('PairsSummary', () => {
  beforeEach(() => {
    mutate.mockClear();
    useResetBracketMock.mockClear();
  });

  it('renders one card per bout from winnersBracket[0]', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild />);
    expect(screen.getByText(/Levon H/)).toBeInTheDocument();
    expect(screen.getByText(/Garik P/)).toBeInTheDocument();
    expect(screen.getByText(/Artur K/)).toBeInTheDocument();
    expect(screen.getByText(/Vahe M/)).toBeInTheDocument();
  });

  it('shows the rebuild button when canRebuild=true', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild />);
    expect(screen.getByRole('button', { name: /rebuild_btn/i })).toBeInTheDocument();
  });

  it('hides the rebuild button when canRebuild=false', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild={false} />);
    expect(screen.queryByRole('button', { name: /rebuild_btn/i })).toBeNull();
  });

  it('rebuild flow: click → confirm → mutate', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild />);
    fireEvent.click(screen.getByRole('button', { name: /rebuild_btn/i }));
    // confirm modal visible
    expect(screen.getByText('rebuild_confirm_title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /rebuild_confirm_yes/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/PairsSummary.spec.tsx`
Expected: FAIL — `PairsSummary` not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/admin/armfight-pairs/PairsSummary.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useResetBracket } from '@/hooks/useAdmin';
import type { Bracket, BracketMatch } from '@/types/api';

export interface PairsSummaryProps {
  tournamentId: string;
  bracket: Bracket;
  /** false in state 4 (completed/cancelled). */
  canRebuild: boolean;
}

function handLabelShort(r: unknown): string {
  const hand = (r as { hand?: unknown } | null)?.hand;
  return hand === 'left' ? 'L' : hand === 'right' ? 'R' : '—';
}

function fullName(p: BracketMatch['player1']): string {
  return `${p.firstName ?? '—'} ${p.lastName ?? ''}`.trim();
}

export function PairsSummary({ tournamentId, bracket, canRebuild }: PairsSummaryProps) {
  const t = useTranslations('armfight_pairs');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reset = useResetBracket(tournamentId, bracket.id);
  const bouts = (bracket.bracketData?.winnersBracket?.[0] ?? []) as BracketMatch[];

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
        {t('pairs_title')}
      </h2>

      {!canRebuild && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {t('readonly_completed_note')}
        </p>
      )}

      <ul className="space-y-2">
        {bouts.map((m, idx) => (
          <li
            key={m.id}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 flex items-center justify-between gap-3"
          >
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              {t('pair_label', { n: idx + 1 })}
            </span>
            <span className="text-sm text-[var(--color-text-primary)] flex-1 text-center">
              <strong>{fullName(m.player1)}</strong>
              <span className="mx-2 text-[var(--color-text-muted)]">vs</span>
              <strong>{fullName(m.player2)}</strong>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
              {handLabelShort(m.result)}
            </span>
          </li>
        ))}
      </ul>

      {canRebuild && (
        <div className="mt-8 rounded-md border border-[var(--color-error)] bg-[var(--color-error)]/10 p-4">
          <h3 className="text-sm font-bold text-[var(--color-error)] mb-1">
            {t('rebuild_title')}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {t('rebuild_body')}
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={reset.isPending}
            className="px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-error)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {t('rebuild_btn')}
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-2">
              {t('rebuild_confirm_title')}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {t('rebuild_confirm_body')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={reset.isPending}
                className="px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              >
                {t('rebuild_confirm_no')}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
                }}
                disabled={reset.isPending}
                className="px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-error)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('rebuild_confirm_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/components/admin/armfight-pairs/PairsSummary.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/armfight-pairs/PairsSummary.tsx apps/web/src/components/admin/armfight-pairs/PairsSummary.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): PairsSummary — read-only view of generated armfight pairs

Renders the bracket's winnersBracket[0] as a list of pair cards
(Name vs Name + hand). For state 3, shows the 'Delete and rebuild'
CTA with a confirm modal that triggers useResetBracket. For state 4
(completed), hides the CTA and shows a 'read-only' note.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Route `page.tsx` + 4-state switch

**Files:**
- Create: `apps/web/src/app/admin/tournaments/[id]/armfight-pairs/page.tsx`
- Create: `apps/web/src/app/admin/tournaments/[id]/armfight-pairs/page.spec.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/admin/tournaments/[id]/armfight-pairs/page.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const useAdminTournament = vi.fn();
const useConfirmedEntries = vi.fn();
const useArmfightBracket = vi.fn();
vi.mock('@/hooks/useAdmin', () => ({
  useAdminTournament: (...a: any[]) => useAdminTournament(...a),
  useConfirmedEntries: (...a: any[]) => useConfirmedEntries(...a),
  useArmfightBracket: (...a: any[]) => useArmfightBracket(...a),
  useGenerateArmfightBracket: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useResetBracket: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

import ArmfightPairsPage from './page';

function setup({
  tournament,
  entries = [],
  bracket = null,
}: { tournament: any; entries?: any[]; bracket?: any }) {
  useAdminTournament.mockReturnValue({ data: tournament, isLoading: false });
  useConfirmedEntries.mockReturnValue({ data: { data: entries }, isLoading: false });
  useArmfightBracket.mockReturnValue({ data: bracket, isLoading: false });
  return render(<ArmfightPairsPage params={{ id: 't1' }} />);
}

describe('ArmfightPairsPage', () => {
  it('state 1 — < 2 entries → EmptyEntriesState', () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: false, status: 'upcoming' },
      entries: [],
    });
    expect(screen.getByText('empty_no_entries_title')).toBeInTheDocument();
  });

  it('state 2 — entries + no bracket → PairBuilder', () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: false, status: 'active' },
      entries: [
        { id: 'e1', status: 'confirmed', user: { firstName: 'A', lastName: 'X' }, weightKg: 76, hand: 'right' },
        { id: 'e2', status: 'confirmed', user: { firstName: 'B', lastName: 'X' }, weightKg: 78, hand: 'right' },
      ],
      bracket: null,
    });
    expect(screen.getByText('roster_title')).toBeInTheDocument();
  });

  it('state 3 — bracket generated → PairsSummary with rebuild', () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: true, status: 'active' },
      entries: [],
      bracket: {
        id: 'b1', bracketData: { format: 'armfight', winnersBracket: [[]] },
      },
    });
    expect(screen.getByText('pairs_title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rebuild_btn/i })).toBeInTheDocument();
  });

  it('state 4 — completed → PairsSummary without rebuild', () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: true, status: 'completed' },
      entries: [],
      bracket: {
        id: 'b1', bracketData: { format: 'armfight', winnersBracket: [[]] },
      },
    });
    expect(screen.getByText('readonly_completed_note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rebuild_btn/i })).toBeNull();
  });

  it('non-armfight tournament → not-armfight panel', () => {
    setup({
      tournament: { id: 't1', format: 'double_elim', bracketGenerated: false, status: 'active' },
      entries: [],
    });
    expect(screen.getByText('not_armfight_title')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd apps/web && npx vitest run src/app/admin/tournaments/'[id]'/armfight-pairs/page.spec.tsx`
Expected: FAIL — page not found.

- [ ] **Step 3: Implement the page**

Create `apps/web/src/app/admin/tournaments/[id]/armfight-pairs/page.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAdminTournament, useConfirmedEntries, useArmfightBracket } from '@/hooks/useAdmin';
import { isArmfightTournament } from '@/lib/armfight';
import { PairBuilder } from '@/components/admin/armfight-pairs/PairBuilder';
import { PairsSummary } from '@/components/admin/armfight-pairs/PairsSummary';
import { EmptyEntriesState } from '@/components/admin/armfight-pairs/EmptyEntriesState';

export default function ArmfightPairsPage({ params }: { params: { id: string } }) {
  const t = useTranslations('armfight_pairs');
  const { data: tournament, isLoading: loadingT } = useAdminTournament(params.id);
  const { data: entriesEnvelope, isLoading: loadingE } = useConfirmedEntries(params.id);
  const { data: bracket, isLoading: loadingB } = useArmfightBracket(params.id);

  if (loadingT || loadingE || loadingB) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-6 w-40 rounded bg-[var(--color-surface-2)] animate-pulse mb-6" />
        <div className="h-64 rounded bg-[var(--color-surface-2)] animate-pulse" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold">404</h2>
      </div>
    );
  }

  // Defensive: direct URL access to /armfight-pairs on a non-armfight tournament
  if (!isArmfightTournament(tournament as any)) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t('not_armfight_title')}
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {t('not_armfight_body')}
        </p>
        <Link
          href={`/admin/tournaments/${params.id}`}
          className="inline-block mt-6 px-4 py-2 rounded-md text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
        >
          {t('back_to_tournament')}
        </Link>
      </div>
    );
  }

  const entries = entriesEnvelope?.data ?? [];
  const status = (tournament as any).status as string;
  const bracketGenerated = (tournament as any).bracketGenerated as boolean;
  const terminal = status === 'completed' || status === 'cancelled';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('page_title')}
        </h1>
        <Link
          href={`/admin/tournaments/${params.id}`}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t('back_to_tournament')}
        </Link>
      </div>

      {/* State 4 — completed/cancelled (bracket may be null if never generated) */}
      {terminal ? (
        bracket ? (
          <PairsSummary tournamentId={params.id} bracket={bracket} canRebuild={false} />
        ) : (
          <EmptyEntriesState tournamentId={params.id} />
        )
      ) : /* State 3 — bracket generated */
      bracketGenerated && bracket ? (
        <PairsSummary tournamentId={params.id} bracket={bracket} canRebuild />
      ) : /* State 1 — fewer than 2 confirmed entries */
      entries.length < 2 ? (
        <EmptyEntriesState tournamentId={params.id} />
      ) : (
        /* State 2 — full form */
        <PairBuilder tournamentId={params.id} confirmedEntries={entries} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd apps/web && npx vitest run src/app/admin/tournaments/'[id]'/armfight-pairs/page.spec.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/tournaments/'[id]'/armfight-pairs/page.tsx apps/web/src/app/admin/tournaments/'[id]'/armfight-pairs/page.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): /admin/tournaments/[id]/armfight-pairs route

4-state page: state 1 (no entries) → EmptyEntriesState; state 2
(entries, no bracket) → PairBuilder; state 3 (bracket generated)
→ PairsSummary canRebuild; state 4 (terminal) → PairsSummary
read-only. Non-armfight tournaments accessing this URL directly
get a friendly "not-armfight" panel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Detail-page CTA integration

Replace the existing "Generate brackets" affordance with a Link to `/armfight-pairs` for armfight tournaments only. Other formats keep the existing flow.

**Files:**
- Modify: `apps/web/src/app/admin/tournaments/[id]/page.tsx`

- [ ] **Step 1: Locate the existing button**

Run: `grep -n "generate_btn\|setShowGenerateConfirm\|showGenerateConfirm" apps/web/src/app/admin/tournaments/'[id]'/page.tsx | head -20`
Expected: A few hits around lines 260-274 — the button, the dialog toggler, and the dialog itself.

- [ ] **Step 2: Add the import + isArmfight helper**

Near the top of `apps/web/src/app/admin/tournaments/[id]/page.tsx`, in the existing import block, add:
```ts
import { isArmfightTournament } from '@/lib/armfight';
```

Right before the JSX that contains the "Generate brackets" button, add:
```ts
const isArmfight = isArmfightTournament(tournament as any);
```

(Use `tournament as any` until type alignment — `Tournament` from `@/types/api` already has the needed shape, the cast is defensive against minor type-shape divergence.)

- [ ] **Step 3: Conditionally swap the button**

Find the JSX block where `setShowGenerateConfirm(true)` is bound to the existing button. Wrap it:

```tsx
{!tournament.registrationOpen && !tournament.bracketGenerated && (
  isArmfight ? (
    <Link
      href={`/admin/tournaments/${tournament.id}/armfight-pairs`}
      className="px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
    >
      {t('build_pairs_and_generate')}
    </Link>
  ) : (
    // existing button — KEEP AS-IS
    <button …>{t('generate_btn')}</button>
  )
)}
```

(Replace `…` with the existing button props. Look at the existing code around line 263-271 — copy its className and onClick verbatim; don't reformat. The condition `!registrationOpen && !bracketGenerated` is the same one already gating it.)

Likewise, wrap the `showGenerateConfirm` dialog so it's skipped for armfight:
```tsx
{!isArmfight && showGenerateConfirm && (
  // existing dialog
)}
```

- [ ] **Step 4: Typecheck + run web tests**

```bash
cd apps/web && npx tsc --noEmit && npx vitest run 2>&1 | tail -5
```
Expected: tsc clean; all tests pass (no test currently exercises the detail-page armfight branch — verified manually).

- [ ] **Step 5: Smoke-check the build**

```bash
cd apps/web && npx next build --no-lint 2>&1 | tail -5
```
Expected: build succeeds (the same `NEXT_PUBLIC_SITE_URL` issue may still surface — if so, that's pre-existing, not from this PR).

If the build fails due to env vars (pre-existing), note it and move on. The TypeScript check + tests are the authoritative gates.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/tournaments/'[id]'/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): admin detail page links to pair-builder for armfight

For armfight tournaments, the 'Generate brackets' button is swapped
for a Link to /armfight-pairs (the format selector dialog is also
skipped — format is fixed). Other formats keep the existing flow
verbatim.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final gate — lint + test + tsc

**Files:** none modified — pure verification.

- [ ] **Step 1: Lint**

Run: `cd /Users/valeryordanyan/Desktop/GSM/gsm-sports && npx turbo lint 2>&1 | tail -5`
Expected: 0 errors. Pre-existing `any` warnings unchanged.

- [ ] **Step 2: Test**

Run: `npx turbo test 2>&1 | tail -8`
Expected: all 9 turbo tasks succeed. `@gsm/web:test` count grew by ~25-30 tests (from ~165 to ~190-195).

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit && cd ../api && npx tsc --noEmit && echo "all clean"
```
Expected: `all clean`.

- [ ] **Step 4: Final commit (if any tweaks made in steps 1-3)**

If lint/test/tsc required any fixes during steps 1-3, commit them with `chore(web): final lint+test cleanup`. If everything was already clean, no commit needed.

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-05-21-armfight-pair-builder-design.md`):

- Spec §2 decisions 1-9 → all reflected:
  - §2.1 dedicated route → Task 10.
  - §2.2 selects per slot → Task 7 (PairRow).
  - §2.3 empty hand default → Task 2 (`hand: ''` initial state) + Task 7 (placeholder option, no default).
  - §2.4 no auto-filter → Task 7 (all entries in every select).
  - §2.5 submit with unpaired allowed → Task 8 (`canSubmit` doesn't include unpaired count; warning only).
  - §2.6 name + weight + hand in select → Task 7 (`labelForEntry`).
  - §2.7 4-state lifecycle → Task 10 (page switch).
  - §2.8 no new backend → no backend tasks; all hooks (Tasks 3-5) consume existing endpoints.
  - §2.9 rebuild = reset → Task 5 (`useResetBracket`) + Task 9 (PairsSummary confirm modal).
- Spec §3 file structure → all 4 components + page + types + 3 hooks landed.
- Spec §4 state machine → covered by Task 10's switch + Task 10 spec's 5 it() cases.
- Spec §5 types → Task 2.
- Spec §6 component contracts → Tasks 6-10 each implement one component.
- Spec §7 data hooks → Tasks 3-5.
- Spec §8 detail-page integration → Task 11.
- Spec §9 i18n → Task 1.
- Spec §10 testing → every task is TDD with at least one spec file; full table in spec §10 maps 1:1.
- Spec §11 YAGNI guardrails → no extra features sneaked into any task (no drag-reorder, no draft save, no live preview, no CSV import, no bulk pairing, no photos).
- Spec §12 conventions checklist → React Query everywhere, `next-intl` everywhere, no hardcoded strings, no backend changes, conventional commits.
- Spec §13 implementation order (9 steps) → maps to 11 implementation tasks here (hooks split into 3 tasks for clarity); plus Task 1 (pre-flight + i18n) and Task 12 (final gate).

**Placeholder scan:** No "TBD/TODO/implement later" anywhere. Task 11 Step 3 says "Look at the existing code around line 263-271 — copy its className and onClick verbatim" — that's a precise instruction (the engineer reads the live file), not a placeholder.

**Type consistency:**
- `PairDraft` (Task 2) → consumed by Tasks 7, 8.
- `PairPayload` (Task 2) → consumed by Tasks 4, 8.
- `ConfirmedEntry` (existing, `@/hooks/useAdmin`) → consumed by Tasks 7, 8.
- `Bracket` (existing, `@/types/api`) → consumed by Tasks 3, 5, 9, 10.
- `useArmfightBracket` (Task 3) → consumed by Task 10.
- `useGenerateArmfightBracket` (Task 4) → consumed by Task 8.
- `useResetBracket` (Task 5) → consumed by Task 9.
- Hook signatures match between definition + use. ✓

---

## Execution Handoff

See the chat message accompanying this plan for the two execution options.
