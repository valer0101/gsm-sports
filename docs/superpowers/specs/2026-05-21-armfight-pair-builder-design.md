# Armfight Pair-Builder UI (Sub-Project C) — Design Spec

> **Status:** Draft v1
> **Date:** 2026-05-21
> **Scope:** Sub-project **C** — admin UI for building the pair list of an armfight fight card and submitting it as a generated bracket. Pure frontend; no backend changes.
> **Out of scope:** Operator live-scoring UI (sub-project D); spectator bracket-render UI (sub-project E); changes to the tournament wizard.

---

## 1. Goal

Today an admin can create an armfight tournament through the existing wizard (sub-project A added the `competitionType === 'armfight'` branch in Step 2 and the isFeatured + videoUrl inputs in Step 4), and the API accepts `POST /v1/brackets { tournamentId, bracketFormat:'armfight', pairs[] }` (added in sub-project B, Task 19). But **there is no UI for building `pairs[]`** — the admin has to call the endpoint with `curl` or Postman. This spec adds that UI so armfight events become end-to-end usable from the admin panel.

Sibling context:
- Sub-project A — public discovery / main-event countdown (PR #103, merged).
- Sub-project B — engine + API for fight-card scoring (PR #105, merged) + hardening (PR #107, merged).
- Sub-project D — operator UI for live leg-by-leg scoring. **Blocked on C** (operators need an existing armfight bracket to score).
- Sub-project E — spectator UI. Also blocked on C / D.

---

## 2. Decisions made during brainstorming

These are the load-bearing decisions; anything contradicting them is a bug in this spec.

1. **Placement: dedicated route** `/admin/tournaments/[id]/armfight-pairs`. Not a wizard step (athletes don't exist at wizard time), not a modal (would be cramped for 5+ pairs), not an inline section on the detail page (which is already 1955 lines).
2. **UX: selects per slot.** Each pair = three `<select>`s — playerA, playerB, hand. Native browser selects; mobile-friendly; accessible by default. No drag-and-drop, no checkbox-then-button, no auto-filtering of selected entries from other selects.
3. **Hand default: empty.** Admin must explicitly pick `'left'` or `'right'` — no implicit defaulting to `'right'`. One more click, zero hidden behaviour.
4. **No auto-filter on selects.** All selects show all confirmed entries. Cross-pair duplicates are caught by the server (PR #107 Fix #5 returns a clear 400 naming the duplicate id and pair indices) and surfaced under the form.
5. **Submit allowed with unpaired athletes.** If admin pairs 3 out of 10 confirmed entries, show a warning "4 athletes not in any pair" — but allow submit. Engine accepts any non-empty `pairs[]` per sub-project B §6.2 ("admin's list is trusted").
6. **Show name + weight + registered hand in selects.** `"Levon Hakobyan · 76kg · R"` not just `"Levon Hakobyan"`.
7. **Full lifecycle on the page.** Four states (see §4), not a partial gate.
8. **No new backend.** All four endpoints used (GET tournament, GET confirmed entries, POST /v1/brackets, PATCH /v1/brackets/:id/reset) already exist.
9. **Rebuild = reset then re-pair.** No DELETE endpoint; the existing `PATCH /v1/brackets/:id/reset` (which clears `bracketData` and resets `status: 'pending'`, `bracketGenerated: false`) is the path from state 3 back to state 2.

---

## 3. Architecture

### 3.1. Components touched

```
apps/web/
  src/app/admin/tournaments/[id]/armfight-pairs/
    page.tsx                          ← NEW route — 4-state switch
  src/components/admin/armfight-pairs/
    PairBuilder.tsx                   ← NEW — state 2 form
    PairRow.tsx                       ← NEW — one slot (3 selects + 🗑)
    PairsSummary.tsx                  ← NEW — state 3+4 read-only
    EmptyEntriesState.tsx             ← NEW — state 1
    types.ts                          ← NEW — PairDraft, BuilderState
  src/hooks/
    useAdmin.ts                       ← MODIFIED — add useArmfightBracket,
                                        useGenerateArmfightBracket, useResetBracket
                                        next to the existing useAdminBrackets (line 167)
  src/messages/{ru,en,hy}.json        ← + namespace "armfight_pairs"
  src/app/admin/tournaments/[id]/page.tsx  ← MODIFIED — replace generate-button cta for armfight
```

Not modified (intentionally):
- `apps/web/src/components/admin/tournament-wizard/**` — wizard stays as-is.
- `apps/api/**` — all required endpoints already exist.
- `packages/bracket-engine/**`, `packages/shared-types/**` — no engine or type changes.

### 3.2. High-level flow

```
admin clicks "Build pairs & generate bracket" on /admin/tournaments/[id]
   → navigate to /admin/tournaments/[id]/armfight-pairs
      → page.tsx loads tournament + confirmedEntries + armfightBracket
      → switches by (confirmedEntries.length, bracket?, status):

         state 1 (no entries):     <EmptyEntriesState />
         state 2 (entries, no br): <PairBuilder />
         state 3 (br generated):   <PairsSummary canRebuild />
         state 4 (completed):      <PairsSummary />

state 2 — admin fills PairRow's, clicks "Generate"
   → useGenerateArmfightBracket.mutate({ pairs })
   → POST /v1/brackets { tournamentId, bracketFormat:'armfight', pairs[] }
   → success toast → navigate('/admin/tournaments/[id]') (now state 3)
   → error 400 → parse + render under form

state 3 — admin clicks "Delete and rebuild"
   → confirm modal
   → useResetBracket.mutate(bracketId)
   → PATCH /v1/brackets/:id/reset
   → invalidate queries → page re-renders in state 2
```

---

## 4. State machine

Four states. The page chooses one per render based on the current tournament + confirmed-entries + bracket data.

| # | Condition | Component | Actions available |
|---|---|---|---|
| 1 | `confirmedEntries.length < 2` OR `tournament.status === 'draft'` | `EmptyEntriesState` | Back link to `/admin/tournaments/[id]` |
| 2 | `confirmedEntries.length ≥ 2` AND `bracketGenerated === false` AND status not terminal | `PairBuilder` | Build pairs, submit |
| 3 | `bracketGenerated === true` AND status not terminal | `PairsSummary canRebuild` | View, click "Delete and rebuild" |
| 4 | status ∈ `{'completed', 'cancelled'}` | `PairsSummary` | View only |

State (1) explicitly includes `< 2` (not `=== 0`) because a 1-confirmed-entry tournament can't form a single pair either — same empty state.

---

## 5. Data model (frontend types)

```ts
// apps/web/src/components/admin/armfight-pairs/types.ts

import type { Hand } from '@/types/api';

/** One pair-slot in the builder UI. All three fields start empty;
 *  submit blocks until all three are filled. */
export interface PairDraft {
  /** Local-only id for React `key` + remove targeting. crypto.randomUUID(). */
  id: string;
  playerAId: string | '';
  playerBId: string | '';
  hand: Hand | '';
}

/** Snapshot fed into the submit mutation. Engine accepts hand ∈
 *  {'left','right'} only; '' is filtered out by the client validator. */
export interface PairPayload {
  playerAId: string;
  playerBId: string;
  hand: 'left' | 'right';
}
```

`Hand` already exists in `apps/web/src/types/api.ts` as `'left' | 'right' | 'both'` — we narrow to `'left' | 'right'` for the engine boundary.

---

## 6. Component contracts

### 6.1. `page.tsx`

```ts
// /admin/tournaments/[id]/armfight-pairs/page.tsx — server component
//   client-only because it uses hooks; redirect non-armfight tournaments
//   to /admin/tournaments/[id]
```

Behaviour:
- Wraps `<AdminLayout>` (existing).
- Loads via three hooks: `useAdminTournament(id)`, `useConfirmedEntries(id)`, `useArmfightBracket(id)`.
- Loading: full-page skeleton.
- If `!isArmfightTournament(tournament)` → render a "Not an armfight tournament" panel with link back. (Defensive — guards direct URL access.)
- Otherwise switches state per §4 table; renders one of the four sub-components.

### 6.2. `PairBuilder.tsx` — state 2

```ts
interface Props {
  tournamentId: string;
  confirmedEntries: TournamentEntry[];
}
```

Owns local state `pairs: PairDraft[]` (initial = `[freshDraft()]` — one empty slot).

Layout: two-column flex (responsive: `lg:grid-cols-[1fr_2fr]`, mobile: stacked).

Left column — **roster** (read-only):
- Title with count: `t('roster_count', { n: entries.length })`.
- One row per entry: `${user.firstName} ${user.lastName} · ${weightKg}kg · ${hand === 'left' ? 'L' : 'R'}`.
- No interactions — purely informational.

Right column — **pairs**:
- Title with count: `t('pairs_title', { n: pairs.length })`.
- Rendered list of `<PairRow>` per `pairs` entry.
- `+ Add pair` button under the last row.
- Warnings block (see §6.3).
- Submit button: `t('submit')` or `t('submitting')`.

Client-side submit validation (in this order):
1. At least one row in `pairs`.
2. Every row has all three fields non-empty.
3. (Client only — server is authoritative) No duplicate ids within a row (UI should prevent this case anyway by playerA/playerB select state).

Cross-pair duplicates are NOT checked client-side — admin sees all entries in all selects (decision §2.4), server returns 400 with clear message (PR #107 Fix #5).

### 6.3. Warnings

| Trigger | Severity | Blocks submit? | Copy key |
|---|---|---|---|
| `confirmedEntries.length - pairs.length*2 > 0` (some entries unpaired) | info | no | `armfight_pairs.unpaired_warning` |
| Some row has empty field | error | yes | `armfight_pairs.incomplete_pair_warning` |
| Server returned 400 | error | n/a (submit failed) | server message displayed verbatim |

### 6.4. `PairRow.tsx`

```ts
interface Props {
  index: number;                      // 0-based; display as index+1
  entries: TournamentEntry[];         // all confirmed entries
  value: PairDraft;
  onChange: (next: PairDraft) => void;
  onRemove: () => void;
  disabled?: boolean;                 // during submit
}
```

Pure controlled component. Three native `<select>`s:
- `playerA`: placeholder option `t('select_player_placeholder')`, then one `<option value={entry.id}>` per entry with the formatted label.
- `playerB`: same.
- `hand`: placeholder, then two options — `t('hand_left')`, `t('hand_right')`.

Trash icon `<button onClick={onRemove}>` to remove the row (allowed at any time; if last row removed, builder shows an empty state hint + `+ Add pair` only).

### 6.5. `PairsSummary.tsx` — states 3 + 4

```ts
interface Props {
  bracket: Bracket;
  canRebuild: boolean;                // false in state 4
}
```

Renders the existing pair list read-only from `bracket.bracketData.winnersBracket[0]`:
- Header with bracket created date.
- One card per match: `<index>. <player1> vs <player2> — hand: <R|L>`.
- If `canRebuild === true`: red `Delete and rebuild` button → confirm modal → `useResetBracket.mutate(bracket.id)` → on success, query invalidation puts the page back into state 2.

### 6.6. `EmptyEntriesState.tsx` — state 1

Simple panel: title, body text explaining "open registration and wait for confirmed entries", primary CTA "Back to tournament" linking to `/admin/tournaments/[id]`.

---

## 7. Data hooks

### 7.1. `useArmfightBracket(tournamentId)`

Built on top of the existing `useAdminBrackets(tournamentId)` (`apps/web/src/hooks/useAdmin.ts:167`), which already fetches `GET /admin/tournaments/:id/brackets`. We add a small derived hook that filters the list to the armfight bracket (at most one per tournament — armfight is a single fight card, not a multi-category event):

```ts
// apps/web/src/hooks/useAdmin.ts — added next to useAdminBrackets
import type { Bracket } from '@/types/api';

export function useArmfightBracket(tournamentId: string) {
  const { data, ...rest } = useAdminBrackets(tournamentId);
  const bracket = (data ?? []).find(
    (b: Bracket) => (b.bracketData as any)?.format === 'armfight',
  ) ?? null;
  return { ...rest, data: bracket };
}
```

Reuses the existing query key (`['admin', 'brackets', tournamentId]`) so cache invalidations from other mutations (record-result, reset, etc.) flow through automatically.

### 7.2. `useGenerateArmfightBracket(tournamentId)`

```ts
export function useGenerateArmfightBracket(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { pairs: PairPayload[] }) =>
      api.post('/v1/brackets', {
        tournamentId,
        bracketFormat: 'armfight',
        pairs: body.pairs,
      }).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
    },
  });
}
```

### 7.3. `useResetBracket(bracketId)`

```ts
export function useResetBracket(tournamentId: string, bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/v1/brackets/${bracketId}/reset`)
      .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
    },
  });
}
```

`PATCH /v1/brackets/:id/reset` already exists in `brackets.controller.ts:148` and clears `bracketData`, sets `status: 'pending'`, unlocks the bracket.

---

## 8. Integration with the existing detail page

In `apps/web/src/app/admin/tournaments/[id]/page.tsx`, in the "Generate brackets" block (around the existing `<button>` near line 270):

```tsx
import { isArmfightTournament } from '@/lib/armfight';

// ... inside the render of the generate block ...
{isArmfightTournament(tournament) ? (
  <Link
    href={`/admin/tournaments/${tournament.id}/armfight-pairs`}
    className="…"  // same primary-button class as existing
  >
    {t('build_pairs_and_generate')}
  </Link>
) : (
  // existing button + showGenerateConfirm dialog + format selector
}
```

For armfight tournaments, the format-selector dropdown does not render (format is fixed) and the existing confirm dialog is skipped — the pair-builder page is the confirmation surface.

The existing "Bracket generated" badge keeps working unchanged — it reads `tournament.bracketGenerated` which is true in state 3 / state 4.

---

## 9. i18n — namespace `armfight_pairs`

Added to all three locale files (`apps/web/src/messages/{ru,en,hy}.json`). Keys:

```json
{
  "armfight_pairs": {
    "page_title": "Build pairs",
    "back_to_tournament": "Back to tournament",

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

    "readonly_completed_note": "This tournament is completed. Pairs are read-only."
  }
}
```

Plus one new key in the existing `admin_tournament_detail` namespace (where `generate_btn` already lives at `messages/ru.json:375`):
```json
{
  "build_pairs_and_generate": "Build pairs & generate bracket"
}
```

The existing button uses `t('generate_btn')`; the conditional swap reads `t('build_pairs_and_generate')` for armfight tournaments. Both keys live in the same namespace.

---

## 10. Testing

Vitest is already wired in `apps/web` (`apps/web/vitest.config.ts`, ~165 tests passing). New spec files:

| File | Cases (~) |
|---|---|
| `PairBuilder.spec.tsx` | initial state with one empty slot; add-pair grows array; remove-pair shrinks; submit with valid pairs → mutation called with right payload; submit with incomplete pair → blocked, warning visible; warning for unpaired entries; submit with server-side dup → error rendered |
| `PairRow.spec.tsx` | 3 selects render with right options; onChange prokidaetsia; trash → onRemove; disabled prop disables all controls |
| `PairsSummary.spec.tsx` | state 3: rebuild button visible, click → confirm → mutation called; state 4: rebuild button hidden; pair list renders from bracketData |
| `EmptyEntriesState.spec.tsx` | copy renders; back link href |
| `page.spec.tsx` | routing between 4 states (mock the three hooks) |

Hook tests inline in their respective files OR co-located:
- `useArmfightBracket.spec.ts` — mocks `api.get`, verifies URL + return shape + filter logic
- `useGenerateArmfightBracket.spec.ts` — mocks `api.post`, verifies body shape + invalidations
- `useResetBracket.spec.ts` — mocks `api.patch`, verifies invalidations

Approximate test count: 25-30. No coverage gate set for `apps/web` — only `npx turbo test` green.

E2E (Playwright) explicitly out of scope per `CLAUDE.md` Testing & Quality Roadmap (we're on step 3, E2E is step 5).

---

## 11. What we are NOT doing (YAGNI guardrails)

- **No drag-to-reorder pairs.** Pair order = position in the array; admin removes/adds.
- **No draft persistence.** If admin reloads the page mid-build, state is lost. Submit or don't.
- **No live preview** of the generated bracket — navigation to the detail page on success shows the result.
- **No CSV import / template** for pairs.
- **No bulk pairing operation** ("select N entries and auto-pair").
- **No photos** in selects — text only.
- **No mobile-specific gestures** — responsive layout, but no swipe-to-delete or similar.

---

## 12. Conventions Compliance Checklist

- [ ] Frontend uses React Query for data fetching (per `CLAUDE.md` — no direct `fetch`/`axios` in components).
- [ ] All UI text via `next-intl` (`t('armfight_pairs.xxx')`); no hardcoded strings.
- [ ] Uses Combat Energy CSS tokens / primitives (same surface as other admin pages).
- [ ] DTOs not needed (no backend).
- [ ] Public surface unchanged — admin-only route.
- [ ] Conventional commits: `feat(web)` for new components, `test(web)` for tests, `chore(web)` for i18n.
- [ ] Branch name: `feature/armfight-pair-builder`.

---

## 13. Implementation order (preview for writing-plans)

1. Hooks (`useArmfightBracket`, `useGenerateArmfightBracket`, `useResetBracket`) + their unit tests.
2. `PairRow` component + spec (smallest, no children).
3. `PairBuilder` component + spec (uses PairRow).
4. `EmptyEntriesState` + spec.
5. `PairsSummary` + spec.
6. `page.tsx` with state switch + spec.
7. i18n entries in all three locales.
8. Detail-page integration (`apps/web/src/app/admin/tournaments/[id]/page.tsx`) — conditional CTA for armfight.
9. Final gate: `npx turbo lint && npx turbo test`.

Single PR. Branch `feature/armfight-pair-builder`. ~1100-1400 LOC, ~25-30 new test cases.
