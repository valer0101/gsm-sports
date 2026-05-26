# Armfight Operator UI (Sub-Project D) — Design Spec

> **Status:** Draft v1
> **Date:** 2026-05-25
> **Scope:** Sub-project **D** — operator UI for live leg-by-leg scoring of armfight bo5 bouts on the existing `/operator` surface. Pure frontend; no backend, no engine, no DB changes.
> **Out of scope:** Spectator broadcast UI (sub-E); admin armfight UX refresh (potential sub-G); multi-table parallel scoring; leg-level correction; auto-advance to next bout.

---

## 1. Goal

After sub-projects A (public discovery), B (engine + scoring API), and C (admin pair-builder) merged into `main`, an admin can fully prepare an armfight fight card: create the tournament, register athletes, build pairs, generate the bracket. The API has all three live-scoring endpoints — `POST /v1/brackets/:id/legs`, `POST /v1/brackets/:id/forfeit`, `GET /v1/brackets/:id/bouts` (`apps/api/src/brackets/brackets.controller.ts:74-94`).

But **the operator side is broken**: the existing `/operator/tournaments/[id]` page walks `bracketData.winnersBracket[0]` through its generic `MatchList` and would call `PATCH /v1/brackets/:id/result` — which `BracketsService.recordResult` explicitly refuses for armfight (`brackets.service.ts:818-822`). A ref or assigned operator cannot record a single leg today.

Sub-D delivers the missing layer: a fight-card list view plus a per-bout focus screen that scores armfight bo5 bouts leg-by-leg via the existing API, on the existing `/operator` route tree.

Sibling context:
- Sub-A — public discovery / main-event countdown (PR #103, merged).
- Sub-B — engine + API for fight-card scoring (PR #105, merged) + hardening (PR #107, merged).
- Sub-C — admin pair-builder UI (PR #108, merged). Required upstream for D — without it, no armfight bracket exists to score.
- Sub-E — spectator UI for live armfight viewing. **Blocked on D** stabilising operator entry first.

---

## 2. Decisions made during brainstorming

These are load-bearing; anything contradicting them is a bug in this spec.

1. **Event scenario is a single ring, sequential bouts.** Bouts run one at a time; the next starts only when the current closes. UI optimises for "one active bout at a time" rather than a multi-table dashboard.
2. **Layout is fully responsive, mobile-first.** Primary device is a phone in the chief judge's hand at the ring, but tablet and laptop must work without separate layouts. Combat Energy tokens / primitives (see `docs/design/00-DESIGN-SYSTEM.md`).
3. **Two-screen flow: list → focus.** `/operator/tournaments/[id]` shows the fight card with all bouts and their statuses. Tapping a bout opens a focus screen at `/operator/tournaments/[id]/bouts/[boutId]` that owns the entire scoring surface for that one bout. Back-link returns to the list.
4. **Two-step leg input with explicit confirm.** Step 1 — tap the player who won the leg. Step 2 — a `LegInputPanel` opens with `[Pin] [Foul] [DQ]` (Pin pre-selected as default, since ≥95% of legs are pins) plus an explicit `Подтвердить` button. Mistakes cost a full bout reset (engine has no leg-level correction), so the two-step gate is worth the extra tap.
5. **Bout close → winner card + manual back.** When `status` transitions to `completed` or `walkover`, the focus view shows a winner card with the final score (and walkover badge/reason if applicable) plus one CTA — `← Назад к карточке`. No auto-advance, no auto-navigation. The list highlights the next pending bout via a `Следующий` badge.
6. **Operator cannot reset a bout from the UI.** `PATCH /v1/brackets/:id/match-reset` is `allowOperator: false` (`brackets.service.ts:1559`). The leg history is read-only with an inline hint pointing to the organizer.
7. **Forfeit (walkover) is an operator-accessible secondary action.** Separate red-outlined button below the player buttons in focus mode. Opens `ForfeitDialog` with required winner selection + optional `walkoverReason` for the audit log.
8. **Reuse existing `useBracketSocket` for live sync.** When a second device commits a leg, the focus screen updates without manual refresh. No new socket infrastructure.
9. **Accept the known concurrency race from sub-B's `TODO(armfight-concurrency)`.** Two operators committing leg #1 simultaneously — the second is rejected loudly by the engine's "next-in-sequence" guard. This is correct behaviour and visible to the user via an error banner; we do NOT add optimistic locking in sub-D.
10. **Conditional render on the existing operator route, not a new tree.** `/operator/tournaments/[id]/page.tsx` adds an armfight branch that mounts `<ArmfightFightCard>` instead of `<MatchList>` when `bracketData.format === 'armfight'`. The new focus route is the only fresh page added to the tree.
11. **No `MyTableBanner` / claim-next-match flow for armfight.** The table-assignment model doesn't apply to a single-ring fight card. The armfight branch simply does not render that scaffolding.

---

## 3. Architecture

### 3.1. Components touched

```
apps/web/
  src/app/operator/tournaments/[tournamentId]/
    page.tsx                                   ← MODIFIED — armfight branch in MatchList area
    bouts/
      [boutId]/
        page.tsx                               ← NEW — focus mode entry

  src/components/operator/armfight/
    ArmfightFightCard.tsx                      ← NEW — fight card list
    BoutListItem.tsx                           ← NEW — one bout row in the list
    BoutFocusView.tsx                          ← NEW — focus-mode orchestrator
    Scoreboard.tsx                             ← NEW — big A:B + hand label
    LegInputPanel.tsx                          ← NEW — two-step input modal
    LegHistoryStrip.tsx                        ← NEW — horizontal 5-slot strip
    ForfeitDialog.tsx                          ← NEW — walkover confirm modal
    WinnerCard.tsx                             ← NEW — terminal-state card
    types.ts                                   ← NEW — local types (BoutSnapshot mirror)

  src/hooks/
    useArmfight.ts                             ← NEW — useArmfightBouts,
                                                       useRecordLeg,
                                                       useForfeitBout
    useBracketSocket.ts                        ← MODIFIED — extra invalidation
                                                            for ['brackets', bracketId, 'bouts']

  src/messages/{ru,en,hy}.json                 ← MODIFIED — + namespace `operator_armfight`
```

### 3.2. Components NOT touched (deliberate)

- `apps/api/**` — all three endpoints exist (sub-B); no service, controller, DTO, or guard changes.
- `packages/bracket-engine/**` — `recordLeg`, `forfeitBout`, `getBoutScore`, `isArmfightBoutResult`, all types already exported.
- `packages/shared-types/**` — `MatchResultSchema` already includes `'armfight_bo5'`; no type changes.
- Existing `MatchList` in `apps/web/src/app/operator/tournaments/[tournamentId]/page.tsx` — unchanged; runs for non-armfight brackets as before.
- `MyTableBanner` and table/claim hooks (`useOperatorMyTable`, `useOperatorClaimNext`) — not rendered for armfight; left untouched for everything else.
- `apps/web/src/components/admin/armfight-pairs/**` (sub-C) — admin path unchanged.

### 3.3. High-level flow

```
operator opens /operator           (existing — list of assigned tournaments)
   ↓ tap armfight tournament
/operator/tournaments/[tournamentId]
   ↓ page loads bracket via useOperatorBrackets
   ↓ branch on bracketData.format:
       'armfight' → <ArmfightFightCard>
       else      → <MatchList>          (existing, untouched)

<ArmfightFightCard>
   ↓ useArmfightBouts(bracket.id)       → GET /v1/brackets/:id/bouts
   ↓ useBracketSocket(tournamentId)     → live invalidation
   ↓ render <BoutListItem> per bout (sorted by `order`)
   ↓ highlight first 'pending' as `Следующий` once at least one bout is closed
   ↓ tap a bout

/operator/tournaments/[tournamentId]/bouts/[boutId]
   ↓ <BoutFocusView>
   ↓ useArmfightBouts(bracketId)        → find bout by id; 404-panel if missing
   ↓ defensive guard: bracketData.format !== 'armfight' → not-armfight panel
   ↓ switch by bout.status:

      pending / in_progress:
         <Scoreboard /> + <LegHistoryStrip /> + 2× player buttons + Forfeit button
         tap player → <LegInputPanel> modal opens
                      → user picks winType (default Pin) → Подтвердить
                      → useRecordLeg.mutate({ boutId, legIndex: legs.length+1, winnerId, winType })
                      → engine guard rejects out-of-order / closed → banner
                      → on success, scoreboard refreshes; if score reaches 3, status flips to completed
         tap Forfeit → <ForfeitDialog>
                      → pick winner + optional reason → Подтвердить
                      → useForfeitBout.mutate(...)

      completed / walkover:
         <WinnerCard /> with status badge + reason + ← Назад к карточке

returning to list → next pending highlighted as `Следующий`
```

---

## 4. State machine & interaction flows

### 4.1. Bout state machine (engine-enforced; UI mirrors it)

```
pending
  ├─ recordLeg #1            → in_progress
  └─ forfeitBout(winnerId)   → walkover

in_progress
  ├─ recordLeg #N (no 3)     → in_progress
  ├─ recordLeg #N (3 wins)   → completed
  └─ forfeitBout(winnerId)   → walkover

completed   (terminal)
walkover    (terminal)
```

Per sub-B `bracket-logic.spec.ts` and §4.3 of the sub-B spec, these transitions are guaranteed by the engine. The UI never tries to override them — it reads `bout.status` from the server snapshot and routes by it.

### 4.2. Focus-mode UI per state

| State | Screen contents |
|---|---|
| `pending` | Header `Бой N · {hand}`. `<Scoreboard>` showing `0 : 0`. `<LegHistoryStrip>` with 5 empty slots. Two player buttons (open `LegInputPanel`). Secondary `<Forfeit>` button (red outline). Back link top-left. |
| `in_progress` | Same as `pending` + filled `<LegHistoryStrip>` slots. When `scoreA === 2 \|\| scoreB === 2`, leg buttons gain a small `match leg` hint above them. |
| `completed` | `<WinnerCard>` with winner name, final score, last leg's `winType`. CTA `← Назад к карточке`. No input, no forfeit button. |
| `walkover` | Same as `completed` + `Walkover` badge and `walkoverReason` (if present). |

### 4.3. Leg input flow (two-step)

```
1. ref taps "Иванов"
   ↓
2. <LegInputPanel> opens (modal, mobile = bottom-sheet):
     Title: "Иванов выиграл leg 4"
     [Pin]  [Foul]  [DQ]                ← Pin selected by default
     [Отмена]              [Подтвердить]
   ↓
3. ref optionally taps Foul/DQ to override default
   ↓
4. ref taps Подтвердить
   → useRecordLeg.mutate({
       boutId, legIndex: legs.length + 1, winnerId, winType
     })
   → engine validates next-in-sequence + winner-in-pair + bout-open
   → 400 (engine `recordLeg:` prefix) → red banner in panel; panel stays open
   → 200 → panel closes; mutation onSuccess invalidates bouts query
   → React Query refetch → BoutFocusView re-renders with new score/history
   → if scoreA or scoreB became 3 → status='completed' → screen transitions to WinnerCard
```

`LegInputPanel` owns local `selectedWinType` state, the mutation call, and error display. It does NOT own which player won — that comes in as a prop set by `BoutFocusView` when the player button was tapped.

### 4.4. Forfeit flow

```
1. ref taps "Снять бой (walkover)"
   ↓
2. <ForfeitDialog> opens:
     Title: "Снять бой N"
     Label: "Кто остаётся (победитель)"
       ( ) Иванов
       ( ) Петров
     Label: "Причина (опционально, для аудит-лога)"
       [_________________________________]
     [Отмена]                       [Подтвердить]
   ↓
3. ref selects winner (required) + optionally types reason
   ↓
4. ref taps Подтвердить
   → useForfeitBout.mutate({ boutId, winnerId, walkoverReason? })
   → 400 (engine `forfeitBout:` prefix) → red banner in dialog; dialog stays open
   → 200 → dialog closes; bouts invalidate → focus view transitions to walkover WinnerCard
```

`Подтвердить` is disabled until a winner radio is selected. `walkoverReason` is `null`-or-trimmed-string (no empty-string commits).

### 4.5. List-view "next pending" highlight

```
once at least one bout in `bouts` has status ∈ {completed, walkover}:
  find first bout with status === 'pending', by `order` ascending
  → render it with accent border + `Следующий` badge
```

Pure visual hint; nothing auto-runs.

---

## 5. Component contracts

### 5.1. `<ArmfightFightCard>` — `apps/web/src/components/operator/armfight/ArmfightFightCard.tsx`

```ts
interface Props {
  tournamentId: string;
  bracket: Bracket;   // already loaded by /operator/tournaments/[id]/page.tsx
}
```

Behaviour:
- Calls `useArmfightBouts(bracket.id)`.
- Calls `useBracketSocket(tournamentId)` once at mount.
- Loading: 3-row skeleton.
- Empty (no bouts in card — defensive, shouldn't happen post-generation): empty-state panel pointing back to `/operator`.
- `bracket.isLocked === true`: persistent yellow banner at top; bout rows still tappable (focus mode renders read-only — see §5.3 for the locked-mode contract).
- Otherwise: `<BoutListItem>` per bout (sorted by `bout.order` ascending).
- Computes `nextPendingId` only when at least one bout has terminated; passes `isNextPending: bout.boutId === nextPendingId` to each item.

### 5.2. `<BoutListItem>` — `BoutListItem.tsx`

```ts
interface Props {
  bout: BoutSnapshot;
  tournamentId: string;
  isNextPending: boolean;
  locked: boolean;
}
```

Renders a card with:
- Order number `Бой {bout.order}`
- Hand badge (`L` / `R` styled chip)
- Player names `{playerA.firstName} {playerA.lastName} · {playerB.firstName} {playerB.lastName}`
- Status sub-line: `Ожидает` / `Идёт · {scoreA}:{scoreB}` / `✓ {winnerName} {scoreA}:{scoreB}` / `Walkover · {winnerName}`
- Accent border + `Следующий` badge when `isNextPending`
- Locked: dimmed but still wrapped in `<Link>` (read-only focus mode is the right surface for a viewer)
- Wrapped in `<Link href={\`/operator/tournaments/\${tournamentId}/bouts/\${bout.boutId}\`}>`

Pure presentational + one `<Link>`. No hooks.

### 5.3. `<BoutFocusView>` — `BoutFocusView.tsx`

```ts
interface Props {
  tournamentId: string;
  bracketId: string;
  boutId: string;
  isLocked: boolean;      // sourced from the bracket (loaded by the page component, see §5.9)
}
```

Orchestrator. Behaviour:
- `useArmfightBouts(bracketId)` to load all bouts; finds `bout = bouts.find(b => b.boutId === boutId)`.
- `useBracketSocket(tournamentId)`.
- Loading: full-screen skeleton.
- Defensive guards:
  - If bracket data is malformed or `format !== 'armfight'` → `<NotArmfightPanel />` + back link.
  - If `bout` is undefined → `<BoutNotFoundPanel />` + back link.
- Renders:
  - Top bar: back link `← Назад к карточке` + bout label.
  - Sub-state switch:
    - `pending` / `in_progress` → `<Scoreboard>` + `<LegHistoryStrip>` + 2× player buttons + `<Forfeit>` button. Owns the `selectedWinner: Player | null` state that opens `<LegInputPanel>` modal. Owns `isForfeitOpen: boolean` for the `<ForfeitDialog>` modal.
    - `completed` / `walkover` → `<WinnerCard>`.

Does NOT own mutations directly — those live in `LegInputPanel` and `ForfeitDialog` (they call `useRecordLeg` / `useForfeitBout`).

**Locked-mode behaviour** (when the parent passed a bracket with `isLocked === true`): the same per-state content renders, but every interactive control is disabled. Player buttons get `disabled=true` (don't open `LegInputPanel`); the `Forfeit` button gets `disabled=true` (doesn't open `ForfeitDialog`). The view becomes essentially read-only: scoreboard, leg history, and back link still visible. Locked banner is owned by `ArmfightFightCard`; the focus view shows a compact lock chip in its header.

### 5.4. `<Scoreboard>` — pure

```ts
interface Props {
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  hand: 'left' | 'right';
}
```

Big `{scoreA} : {scoreB}` typography. Hand chip. Player names on either side.

### 5.5. `<LegHistoryStrip>` — pure

```ts
interface Props {
  legs: Array<{ index: number; winnerId: string; winType: LegWinType }>;
  playerA: { id: string; firstName: string };
  playerB: { id: string; firstName: string };
}
```

Horizontal strip of 5 slots. Filled slots show `{index}` + `{winnerInitial}` + `winType` icon (✊ pin / ⛔ foul / ❌ dq). Empty slots dimmed. Below the strip — inline grey hint with the `leg_history_correction_hint` translation.

### 5.6. `<LegInputPanel>` — modal/bottom-sheet

```ts
interface Props {
  bracketId: string;
  boutId: string;
  legIndex: number;             // legs.length + 1
  winner: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCommitted: () => void;
}
```

- Local state: `winType: LegWinType` (default `'pin'`).
- Calls `useRecordLeg(bracketId)` on confirm.
- 400 from engine (`recordLeg:` prefix) → red banner inside the panel; panel stays open; user can adjust & retry.
- Non-engine 400 / 403 / 5xx → toast + close (parent handles the cache refetch through invalidation).
- On 200 → call `onCommitted()` (parent closes the panel and clears `selectedWinner`).

### 5.7. `<ForfeitDialog>` — modal

```ts
interface Props {
  bracketId: string;
  boutId: string;
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCommitted: () => void;
}
```

- Local state: `winnerId: string | null`, `reason: string`.
- `Подтвердить` disabled until `winnerId !== null`.
- Calls `useForfeitBout(bracketId)`.
- Errors handled same way as `<LegInputPanel>`.

### 5.8. `<WinnerCard>` — pure

```ts
interface Props {
  winner: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  status: 'completed' | 'walkover';
  walkoverReason: string | null;
  backHref: string;
}
```

Large winner name, final score, `Walkover` badge and `Причина: …` row when status is `walkover` and `walkoverReason` is non-null. Single CTA — Link to `backHref`.

### 5.9. `<BoutFocusView>` page entry — `apps/web/src/app/operator/tournaments/[tournamentId]/bouts/[boutId]/page.tsx`

Thin client component that owns the bracket-lookup and prop-pass:

```ts
'use client';
import { use } from 'react';
import { useOperatorBrackets } from '@/hooks/useOperator';
import { BoutFocusView } from '@/components/operator/armfight/BoutFocusView';
import { Skeleton } from '@/components/ui/Skeleton';

export default function BoutFocusPage({
  params,
}: {
  params: Promise<{ tournamentId: string; boutId: string }>;
}) {
  const { tournamentId, boutId } = use(params);
  const { data: brackets, isLoading } = useOperatorBrackets(tournamentId);
  if (isLoading) return <Skeleton className="h-screen w-full" />;
  const bracket = (brackets ?? []).find(
    (b) => (b.bracketData as any)?.format === 'armfight',
  );
  if (!bracket) return <NotArmfightPanel tournamentId={tournamentId} />;
  return (
    <BoutFocusView
      tournamentId={tournamentId}
      bracketId={bracket.id}
      boutId={boutId}
      isLocked={bracket.isLocked}
    />
  );
}
```

Uses the same `useOperatorBrackets` cache that the list page already populates — no extra network round-trip when navigating from the list. The bracket lookup mirrors sub-C's `useArmfightBracket(tournamentId)` filter pattern.

### 5.10. Local types — `apps/web/src/components/operator/armfight/types.ts`

```ts
import type { LegWinType, ArmfightBoutStatus } from '@gsm/shared-types';
// (Both are re-exported from packages/bracket-engine via shared-types.)

export interface BoutSnapshot {
  boutId: string;
  order: number;
  hand: 'left' | 'right';
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  status: ArmfightBoutStatus;
  leadingId: string | null;
  legs: Array<{ index: number; winnerId: string; winType: LegWinType }>;
  walkoverReason: string | null;
}
```

This is the response shape of `GET /v1/brackets/:id/bouts` (`brackets.service.ts:1075-1130`). Defined locally to keep frontend / API decoupled; promote to `@gsm/shared-types` only if a second consumer (spectator UI in sub-E) appears.

---

## 6. Hooks contracts — `apps/web/src/hooks/useArmfight.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BoutSnapshot } from '@/components/operator/armfight/types';
import type { LegWinType } from '@gsm/shared-types';

export function useArmfightBouts(bracketId: string | undefined) {
  return useQuery<BoutSnapshot[]>({
    queryKey: ['brackets', bracketId, 'bouts'],
    queryFn: () => api.get(`/v1/brackets/${bracketId}/bouts`).then((r) => r.data),
    enabled: !!bracketId,
  });
}

export function useRecordLeg(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      boutId: string;
      legIndex: number;
      winnerId: string;
      winType: LegWinType;
    }) =>
      api.post(`/v1/brackets/${bracketId}/legs`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', bracketId, 'bouts'] });
    },
  });
}

export function useForfeitBout(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      boutId: string;
      winnerId: string;
      walkoverReason?: string;
    }) =>
      api.post(`/v1/brackets/${bracketId}/forfeit`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', bracketId, 'bouts'] });
    },
  });
}
```

**Why only the `bouts` key is invalidated by the mutations:** both mutations also trigger a server-side `eventsGateway.emitBracketUpdate(...)` (`brackets.service.ts:1016`, `:1066`). The existing `useBracketSocket(tournamentId)` handler — mounted by the parent operator page — already invalidates `['brackets', tournamentId]` and `['operator', 'brackets', tournamentId]` on that event. Duplicating those invalidations in the mutation `onSuccess` would only race against the socket. The mutation owns just the immediate, locally-visible refresh: the bouts list for this bracket.

### 6.1. Socket extension — `useBracketSocket.ts`

Existing handler already invalidates `['brackets', tournamentId]` and `['operator', 'brackets', tournamentId]` on `bracket_updated`. Add one line: also invalidate `['brackets', payload.bracketId, 'bouts']` so that a second device's commit refreshes the focus screen immediately. The mutation's own invalidation handles the same-device refresh.

---

## 7. Error handling

| Source | Trigger | UI reaction |
|---|---|---|
| `400 'recordLeg: …'` | engine validation (bout closed / wrong sequence / winner not in pair / leg > 5 / wrong format) | red banner inside `LegInputPanel`, panel stays open; user adjusts or cancels |
| `400 'forfeitBout: …'` | winner not in pair / bout closed | red banner inside `ForfeitDialog`, dialog stays open |
| `400 'Bracket has no data'` / `'… is only valid on armfight brackets'` | bracket malformed or wrong format | toast `error_not_armfight`, render not-armfight panel + back link |
| `403 'Bracket is locked. Only admin can modify results.'` | bracket locked | persistent yellow banner; all inputs disabled; view becomes read-only |
| `403 'Only the organizer, admin, or assigned operator…'` | operator not in `tournament_operators` | toast `error_no_access`; redirect to `/operator` |
| `404` | invalid `boutId` in URL | not-found panel + back link |
| Network / timeout | connection lost mid-mutation | toast `error_network`; mutation button re-enables for retry; cache untouched |

**Engine error messages** (the `recordLeg:` / `forfeitBout:` prefixed strings) are surfaced verbatim, prefixed with the translated `error_recordleg_prefix` / `error_forfeit_prefix`. Same pattern sub-C uses for pair-builder server errors (PR #108).

**Known race condition** — `TODO(armfight-concurrency)` in `brackets.service.ts:988` and `:1043`. Two operators committing leg #1 concurrently — second is rejected by the engine's "next-in-sequence" guard; user sees the banner; the other operator's commit already arrived via websocket so the score is correct. **Documented, not hardened.** Lifting it to an optimistic-lock transaction is a follow-up if a real event surfaces concurrent operators.

---

## 8. i18n — namespace `operator_armfight`

Added to `apps/web/src/messages/{ru,en,hy}.json`. Approximate key set (final list during impl):

```json
{
  "operator_armfight": {
    "card_title": "Карточка боёв",
    "card_subtitle": "{n, plural, one {# бой} few {# боя} other {# боёв}}",
    "bracket_locked": "🔒 Сетка заблокирована — изменения недоступны",

    "bout_label": "Бой {n}",
    "hand_left": "левая",
    "hand_right": "правая",

    "status_pending": "Ожидает",
    "status_in_progress": "Идёт",
    "status_completed": "Завершён",
    "status_walkover": "Walkover",

    "next_pending_badge": "Следующий",
    "back_to_card": "← Назад к карточке",

    "leg_n_of_5": "Leg {n} из 5",
    "leg_input_title": "{name} выиграл leg {n}",
    "wintype_pin": "Pin",
    "wintype_foul": "Foul",
    "wintype_dq": "DQ",
    "confirm": "Подтвердить",
    "cancel": "Отмена",

    "leg_history_title": "История leg-ов",
    "leg_history_correction_hint": "Ошибка в записи? Обратись к организатору — изменить leg можно только сбросом боя.",

    "forfeit_button": "Снять бой (walkover)",
    "forfeit_dialog_title": "Снять бой {n}",
    "forfeit_dialog_winner_label": "Кто остаётся (победитель)",
    "forfeit_dialog_reason_label": "Причина (опционально, для аудит-лога)",
    "forfeit_dialog_reason_placeholder": "Например: не явился, травма…",

    "winner_card_title": "{name} победил",
    "winner_card_score": "Финальный счёт {scoreA}:{scoreB}",
    "winner_card_walkover_badge": "Walkover",
    "winner_card_walkover_reason": "Причина: {reason}",

    "error_recordleg_prefix": "Не удалось записать leg",
    "error_forfeit_prefix": "Не удалось снять бой",
    "error_network": "Не удалось сохранить — проверь сеть",
    "error_no_access": "У вас нет доступа к этому турниру",
    "error_bout_not_found": "Бой не найден",
    "error_not_armfight": "Эта сетка не armfight"
  }
}
```

Principles:
- Engine error suffixes (`recordLeg: legIndex must be …`) are surfaced verbatim after the translated prefix — same pattern as sub-C.
- ICU MessageFormat plurals throughout; matches `armfight_pairs.roster_count` precedent.
- All three locales (`ru`, `en`, `hy`) updated in the same task; no gaps.

---

## 9. Testing

Vitest is already wired in `apps/web` (`apps/web/vitest.config.ts`, ~165 passing tests). New spec files:

| File | ~Cases |
|---|---|
| `useArmfight.spec.ts` | all three hooks: mock `api.get/post`, verify URL + payload + invalidation keys |
| `ArmfightFightCard.spec.tsx` | empty / 1 / N bouts; next-pending highlight; lock banner; loading skeleton |
| `BoutListItem.spec.tsx` | status badges (4 statuses); Link href correct; locked still navigable |
| `BoutFocusView.spec.tsx` | switch by status (4 cases); 404 panel for missing bout; not-armfight panel |
| `Scoreboard.spec.tsx` | score render + hand badge |
| `LegHistoryStrip.spec.tsx` | empty slots; filled with pin/foul/dq icons; correction hint visible |
| `LegInputPanel.spec.tsx` | Pin pre-selected; switch winType; confirm calls mutation with correct payload; engine 400 → banner; cancel closes |
| `ForfeitDialog.spec.tsx` | confirm disabled until winner selected; reason optional; confirm calls mutation; 400 → banner |
| `WinnerCard.spec.tsx` | completed vs walkover badge; reason render only when present; back link href |

Approximate count: **30–35 new test cases**. No coverage gate on `apps/web` (per `CLAUDE.md` roadmap — coverage gates apply only to `bracket-engine` for now); requirement is `npx turbo test` green.

**Out of test scope for D:**

- Websocket sync — `useBracketSocket` already has its own tests; sub-D's modification (one extra invalidate key) is covered by a focused unit test on the modified hook.
- API / engine — already covered by sub-B (`brackets.service.spec.ts`, `bracket-logic.spec.ts` ≥90% on the bracket-logic file).
- E2E Playwright — explicit out of scope per `CLAUDE.md` Testing Roadmap (step 3, E2E is step 5).

**Manual QA checklist** (for PR description):

- [ ] Create armfight tournament via admin wizard → registration → confirm → pair-builder → bracket generated.
- [ ] Open `/operator/tournaments/[id]` as an assigned operator — see `<ArmfightFightCard>` instead of `<MatchList>`.
- [ ] Tap a pending bout → focus mode → record three pin legs → 3:0 → `<WinnerCard>` shows.
- [ ] Back to list → next pending highlighted with `Следующий` badge.
- [ ] Open another bout → record one leg → tap Forfeit → pick winner → confirm → walkover card.
- [ ] Lock bracket as admin → operator UI becomes read-only with yellow banner.
- [ ] Open the same focus screen in a second browser tab → record a leg in tab 1 → tab 2 updates within ~1s via socket.

---

## 10. Out of scope (YAGNI guardrails)

- **No API / engine / DB / shared-types changes.** All deps from sub-B + sub-C; sub-D is pure frontend.
- **No admin armfight UX rework.** `competitionType: 'armfight'` selection in wizard (sub-A) + pair-builder (sub-C) stays. Improvements are a potential future sub-G, not part of D.
- **No spectator UI.** That's sub-E and is blocked on D stabilising.
- **No leg-level correction.** API doesn't allow it; only `resetMatch` (full bout reset) under organizer/admin. Operator sees history read-only with an inline hint pointing to the organizer.
- **No concurrency hardening.** Documented in §7 as known limitation; rely on engine guard.
- **No auto-advance to next bout.** Decision §2.5; manual back via CTA.
- **No drag-to-reorder bouts.** Order set by admin in pair-builder.
- **No push notifications / toasts** for "next bout ready". Socket invalidates the cache; visual highlight in the list is enough.
- **No `replacePlayerInSlot` in operator UI.** Engine allows it only for `pending` bouts and only for organizer/admin (`allowOperator: false`). Operator escalates.
- **No draft persistence.** `selectedWinType` state in `LegInputPanel` resets if the modal is closed.
- **No sound / haptics** on confirm.
- **No round timer.** Engine doesn't store leg time; not modelled.
- **No multi-table parallel scoring.** Decision §2.1 — single ring, sequential bouts.

**Known limitations documented in code comments + this spec:**

1. `TODO(armfight-concurrency)` race — two concurrent operators on the same bout; second commit rejected by engine guard.
2. Operator-side mis-recorded leg requires escalation to organizer (full bout reset).
3. Bracket lock → all armfight UI becomes read-only; unlock only by admin.

---

## 11. Conventions Compliance Checklist

- [ ] Frontend uses React Query for all data fetching (no direct `fetch`/`axios` in components).
- [ ] All user-facing strings via `next-intl` (`t('operator_armfight.…')`); no hardcoded text in JSX.
- [ ] Uses Combat Energy CSS tokens / primitives from `docs/design/00-DESIGN-SYSTEM.md`.
- [ ] No business logic in components — mutation logic in hooks; state machine driven by server `bout.status`.
- [ ] No backend / DTO / migration changes; sub-B's endpoints + DTOs reused as-is.
- [ ] Loading + error + empty states for every async surface.
- [ ] Skeleton component used for loading (no empty screens).
- [ ] Mobile-first responsive layout; works on phone, tablet, desktop.
- [ ] Engine error messages surfaced verbatim with translated prefix (consistent with sub-C).
- [ ] Conventional commits: `feat(web)` for new components, `test(web)` for tests, `chore(web)` for i18n.
- [ ] Branch name: `feature/armfight-operator-ui`.

---

## 12. Implementation order (preview for writing-plans)

1. Local types + hooks (`useArmfight.ts`) + their unit tests.
2. `useBracketSocket.ts` — add the extra invalidation key + update its test.
3. Pure presentational components + specs (`Scoreboard`, `LegHistoryStrip`, `WinnerCard`).
4. `LegInputPanel` + spec (calls `useRecordLeg`, owns winType state).
5. `ForfeitDialog` + spec (calls `useForfeitBout`).
6. `BoutFocusView` orchestrator + spec (status switch, guards).
7. `BoutListItem` + spec.
8. `ArmfightFightCard` + spec (data fetching + next-pending highlight + lock banner).
9. New route `apps/web/src/app/operator/tournaments/[tournamentId]/bouts/[boutId]/page.tsx` thin client component wrapping `<BoutFocusView>`.
10. Branch existing `apps/web/src/app/operator/tournaments/[tournamentId]/page.tsx` to render `<ArmfightFightCard>` when `bracketData.format === 'armfight'`.
11. i18n entries in all three locales (`ru`, `en`, `hy`).
12. Manual QA pass per §9 checklist.
13. Final gate: `npx turbo lint && npx turbo test`.

Single PR. Branch `feature/armfight-operator-ui`. Approximate size: ~1500–1900 LOC, ~30–35 new test cases.
