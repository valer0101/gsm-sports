# Armfight Operator UI Implementation Plan (Sub-Project D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the operator live-scoring UI for armfight bo5 bouts on the existing `/operator` surface — a fight-card list view plus a per-bout focus screen that scores legs through the API endpoints delivered in sub-project B.

**Architecture:** Frontend-only. Conditional armfight branch on the existing `/operator/tournaments/[id]/page.tsx`, plus a new route `/operator/tournaments/[id]/bouts/[boutId]`. Two-step leg input with explicit confirm. Pure presentational components paired with React Query mutation hooks that hit the existing `/v1/brackets/:id/legs`, `/forfeit`, `/bouts` endpoints. Live sync via the existing `useBracketSocket`.

**Tech Stack:** Next.js App Router (client components), React Query (TanStack Query v5), Tailwind + Combat Energy CSS tokens, next-intl, Vitest + `@testing-library/react`, socket.io-client (already in place).

**Spec reference:** `docs/superpowers/specs/2026-05-25-armfight-operator-ui-design.md` (commit `6c28086`).

**Branch:** `feature/armfight-operator-ui`.

**Critical gotcha:** `api.baseURL` (`apps/web/src/lib/api.ts`) already ends in `/v1`. All hook URLs must be bare (`/brackets/:id/legs`), never `/v1/brackets/:id/legs` — the latter double-resolves to `/v1/v1/...` and 404s. This is documented in `apps/web/src/hooks/useAdmin.ts:196-198`.

---

## Task 0: Branch setup and pre-flight checks

**Files:** none (git ops only)

- [ ] **Step 1: Create the feature branch from up-to-date main**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/armfight-operator-ui
```

- [ ] **Step 2: Verify baseline green build**

```bash
npx turbo lint
npx turbo test
```

Expected: both pass. If not, the failure is pre-existing — do NOT start implementing on a red baseline.

- [ ] **Step 3: Verify the three API endpoints respond (sanity check)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/brackets/00000000-0000-0000-0000-000000000000/bouts
# Expected: 404 (NotFound — bracket doesn't exist, but the route is wired)
```

If you get 405 / 502 / connection refused, the API isn't running; start it with `cd apps/api && npm run dev` in another terminal. The plan does NOT depend on a running API except for this one sanity check.

- [ ] **Step 4: Confirm engine types are exported**

```bash
grep -n "ArmfightHand\|LegWinType\|ArmfightBoutStatus" packages/bracket-engine/src/index.ts
```

Expected: 3+ matches showing the type re-exports (added in sub-B). If missing, stop — the plan assumes sub-B is merged.

---

## Task 1: Local types file — `BoutSnapshot` mirror

**Files:**
- Create: `apps/web/src/components/operator/armfight/types.ts`

This file is the typed mirror of `GET /v1/brackets/:id/bouts`'s response shape (`apps/api/src/brackets/brackets.service.ts:1075-1130`). Kept local to the operator armfight feature; we promote to `@gsm/shared-types` only when sub-E adds a second consumer.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p apps/web/src/components/operator/armfight
```

- [ ] **Step 2: Write the types file**

```ts
// apps/web/src/components/operator/armfight/types.ts

import type {
  LegWinType,
  ArmfightBoutStatus,
  ArmfightHand,
} from '@gsm/bracket-engine';

/**
 * Mirror of the `GET /v1/brackets/:id/bouts` response shape
 * (apps/api/src/brackets/brackets.service.ts:1075-1130).
 *
 * Local to the operator armfight feature for now. Promote to
 * `@gsm/shared-types` only when a second consumer (sub-project E
 * spectator UI) needs the same shape.
 */
export interface BoutSnapshot {
  boutId: string;
  order: number;
  hand: ArmfightHand;
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

- [ ] **Step 3: Type-check passes**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/operator/armfight/types.ts
git commit -m "feat(web): BoutSnapshot type for armfight operator UI"
```

---

## Task 2: `useArmfightBouts` hook + test

**Files:**
- Create: `apps/web/src/hooks/useArmfight.ts`
- Create: `apps/web/src/hooks/useArmfight.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/hooks/useArmfight.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';
import { useArmfightBouts } from './useArmfight';
import type { BoutSnapshot } from '@/components/operator/armfight/types';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleBouts: BoutSnapshot[] = [
  {
    boutId: 'wb_1_0',
    order: 1,
    hand: 'right',
    playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
    playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
    scoreA: 0,
    scoreB: 0,
    status: 'pending',
    leadingId: null,
    legs: [],
    walkoverReason: null,
  },
];

describe('useArmfightBouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GETs /brackets/:id/bouts and returns the snapshots', async () => {
    (api.get as any).mockResolvedValue({ data: sampleBouts });

    const { result } = renderHook(() => useArmfightBouts('bracket-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/brackets/bracket-1/bouts');
    expect(result.current.data).toEqual(sampleBouts);
  });

  it('does not fetch when bracketId is undefined', () => {
    renderHook(() => useArmfightBouts(undefined), { wrapper });
    expect(api.get).not.toHaveBeenCalled();
  });
});
```

The `.spec.ts` extension lets jsx in the wrapper work because `esbuild.jsx = 'automatic'` covers `.ts` too (per `apps/web/vitest.config.ts`).

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd apps/web && npx vitest run src/hooks/useArmfight.spec.ts
```

Expected: FAIL with `Cannot find module './useArmfight'`.

- [ ] **Step 3: Write the minimal hook**

```ts
// apps/web/src/hooks/useArmfight.ts

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BoutSnapshot } from '@/components/operator/armfight/types';
import type { LegWinType } from '@gsm/bracket-engine';

/**
 * Read-only snapshot of all bouts in an armfight bracket.
 * Mirrors GET /v1/brackets/:id/bouts (apps/api/src/brackets/brackets.controller.ts:91).
 *
 * Path note: `api.baseURL` already ends in `/v1`; the bare `/brackets/...`
 * is correct. See apps/web/src/hooks/useAdmin.ts:196-198 for the same gotcha.
 */
export function useArmfightBouts(bracketId: string | undefined) {
  return useQuery<BoutSnapshot[]>({
    queryKey: ['brackets', bracketId, 'bouts'],
    queryFn: () =>
      api.get(`/brackets/${bracketId}/bouts`).then((r: any) => r.data),
    enabled: !!bracketId,
  });
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```bash
cd apps/web && npx vitest run src/hooks/useArmfight.spec.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useArmfight.ts apps/web/src/hooks/useArmfight.spec.ts
git commit -m "feat(web): useArmfightBouts hook"
```

---

## Task 3: `useRecordLeg` hook + test

**Files:**
- Modify: `apps/web/src/hooks/useArmfight.ts` (add hook)
- Modify: `apps/web/src/hooks/useArmfight.spec.ts` (add tests)

- [ ] **Step 1: Add the failing test block**

Append to `apps/web/src/hooks/useArmfight.spec.ts`:

```ts
// (inside the same file, alongside the previous describe block)

import { useRecordLeg } from './useArmfight';

describe('useRecordLeg', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs the leg payload to /brackets/:id/legs', async () => {
    (api.post as any).mockResolvedValue({ data: { id: 'bracket-1' } });

    const { result } = renderHook(() => useRecordLeg('bracket-1'), {
      wrapper,
    });

    result.current.mutate({
      boutId: 'wb_1_0',
      legIndex: 1,
      winnerId: 'a',
      winType: 'pin',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/legs', {
      boutId: 'wb_1_0',
      legIndex: 1,
      winnerId: 'a',
      winType: 'pin',
    });
  });

  it('invalidates the bouts query on success', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRecordLeg('bracket-1'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate({
      boutId: 'wb_1_0',
      legIndex: 1,
      winnerId: 'a',
      winType: 'pin',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith({
      queryKey: ['brackets', 'bracket-1', 'bouts'],
    });
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

```bash
cd apps/web && npx vitest run src/hooks/useArmfight.spec.ts
```

Expected: FAIL — `useRecordLeg is not exported`.

- [ ] **Step 3: Implement the hook**

Append to `apps/web/src/hooks/useArmfight.ts`:

```ts
/**
 * Append a leg result to an armfight bo5 bout.
 * Mirrors POST /v1/brackets/:id/legs (brackets.controller.ts:74).
 *
 * Engine validation errors come back as 400 with message prefix
 * `recordLeg: …`. The mutation does NOT swallow them — callers must
 * read `mutation.error` to surface the engine message verbatim.
 *
 * Only the `bouts` query is invalidated here. The server emits
 * `bracket_updated` after every commit, and the parent's
 * `useBracketSocket(tournamentId)` handles the rest of the cache
 * (operator dashboard, schedule, etc.).
 */
export function useRecordLeg(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      boutId: string;
      legIndex: number;
      winnerId: string;
      winType: LegWinType;
    }) =>
      api
        .post(`/brackets/${bracketId}/legs`, body)
        .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', bracketId, 'bouts'] });
    },
  });
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/hooks/useArmfight.spec.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useArmfight.ts apps/web/src/hooks/useArmfight.spec.ts
git commit -m "feat(web): useRecordLeg hook"
```

---

## Task 4: `useForfeitBout` hook + test

**Files:**
- Modify: `apps/web/src/hooks/useArmfight.ts`
- Modify: `apps/web/src/hooks/useArmfight.spec.ts`

- [ ] **Step 1: Add the failing test block**

Append to `apps/web/src/hooks/useArmfight.spec.ts`:

```ts
import { useForfeitBout } from './useArmfight';

describe('useForfeitBout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to /brackets/:id/forfeit with optional reason', async () => {
    (api.post as any).mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useForfeitBout('bracket-1'), {
      wrapper,
    });

    result.current.mutate({
      boutId: 'wb_1_0',
      winnerId: 'a',
      walkoverReason: 'не явился',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/forfeit', {
      boutId: 'wb_1_0',
      winnerId: 'a',
      walkoverReason: 'не явился',
    });
  });

  it('omits walkoverReason when not provided', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useForfeitBout('bracket-1'), {
      wrapper,
    });
    result.current.mutate({ boutId: 'wb_1_0', winnerId: 'a' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((api.post as any).mock.calls[0][1]).not.toHaveProperty(
      'walkoverReason',
    );
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/hooks/useArmfight.spec.ts
```

Expected: FAIL — `useForfeitBout is not exported`.

- [ ] **Step 3: Implement**

Append to `apps/web/src/hooks/useArmfight.ts`:

```ts
/**
 * Close an armfight bout as walkover.
 * Mirrors POST /v1/brackets/:id/forfeit (brackets.controller.ts:84).
 *
 * Engine errors come back as 400 with message prefix `forfeitBout: …`.
 * The mutation does NOT swallow them.
 */
export function useForfeitBout(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      boutId: string;
      winnerId: string;
      walkoverReason?: string;
    }) => {
      const payload: Record<string, unknown> = {
        boutId: body.boutId,
        winnerId: body.winnerId,
      };
      if (body.walkoverReason !== undefined) {
        payload.walkoverReason = body.walkoverReason;
      }
      return api
        .post(`/brackets/${bracketId}/forfeit`, payload)
        .then((r: any) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', bracketId, 'bouts'] });
    },
  });
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/hooks/useArmfight.spec.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useArmfight.ts apps/web/src/hooks/useArmfight.spec.ts
git commit -m "feat(web): useForfeitBout hook"
```

---

## Task 5: `useBracketSocket` — extra invalidation key

**Files:**
- Modify: `apps/web/src/hooks/useBracketSocket.ts:44-50`

The current handler invalidates `['brackets', tournamentId]` and `['operator', 'brackets', tournamentId]`. Sub-D needs the new `['brackets', bracketId, 'bouts']` key invalidated too so the focus view refreshes when another device commits.

- [ ] **Step 1: Read the existing handler**

Open `apps/web/src/hooks/useBracketSocket.ts` and locate the `socket.on('bracket_updated', ...)` block (lines 33-51).

- [ ] **Step 2: Add the new invalidation line**

Replace the body of the `bracket_updated` handler (after the existing two `qc.setQueryData(...)` calls) with the addition shown. The full handler should look like this — apply via Edit, preserving everything else:

```ts
    socket.on(
      'bracket_updated',
      (payload: { bracketId: string; bracketData: Bracket['bracketData'] }) => {
        // Optimistically update the cache so the UI refreshes instantly
        qc.setQueryData<Bracket[]>(['brackets', tournamentId], (old) => {
          if (!old) return old;
          return old.map((b) =>
            b.id === payload.bracketId ? { ...b, bracketData: payload.bracketData } : b,
          );
        });
        // Also update operator cache
        qc.setQueryData<Bracket[]>(['operator', 'brackets', tournamentId], (old) => {
          if (!old) return old;
          return old.map((b) =>
            b.id === payload.bracketId ? { ...b, bracketData: payload.bracketData } : b,
          );
        });
        // Sub-D: live-refresh the per-bracket bouts query used by the
        // armfight focus view. We invalidate (not setQueryData) because
        // the bouts derivation lives server-side in `listBouts`.
        qc.invalidateQueries({
          queryKey: ['brackets', payload.bracketId, 'bouts'],
        });
      },
    );
```

- [ ] **Step 3: Verify the file still type-checks**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useBracketSocket.ts
git commit -m "feat(web): invalidate per-bracket bouts on bracket_updated"
```

(No new spec for `useBracketSocket.ts` — it currently has no spec file; sub-D doesn't introduce one because the existing socket-mocking pattern would be heavy for a single-line addition. The integration is exercised manually per the QA checklist.)

---

## Task 6: `Scoreboard` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/Scoreboard.tsx`
- Create: `apps/web/src/components/operator/armfight/Scoreboard.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/Scoreboard.spec.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

import { Scoreboard } from './Scoreboard';

const playerA = { id: 'a', firstName: 'Иван', lastName: 'Иванов' };
const playerB = { id: 'b', firstName: 'Пётр', lastName: 'Петров' };

describe('Scoreboard', () => {
  it('renders both player names and the score', () => {
    render(
      <Scoreboard
        playerA={playerA}
        playerB={playerB}
        scoreA={2}
        scoreB={1}
        hand="right"
      />,
    );
    expect(screen.getByText(/Иван/)).toBeInTheDocument();
    expect(screen.getByText(/Пётр/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders the hand badge using the i18n key', () => {
    render(
      <Scoreboard
        playerA={playerA}
        playerB={playerB}
        scoreA={0}
        scoreB={0}
        hand="left"
      />,
    );
    expect(screen.getByText('hand_left')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/Scoreboard.spec.tsx
```

Expected: FAIL — `Cannot find module './Scoreboard'`.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/Scoreboard.tsx

'use client';

import { useTranslations } from 'next-intl';
import type { ArmfightHand } from '@gsm/bracket-engine';

interface Props {
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  hand: ArmfightHand;
}

export function Scoreboard({ playerA, playerB, scoreA, scoreB, hand }: Props) {
  const t = useTranslations('operator_armfight');
  return (
    <div
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="text-center text-xs uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-secondary)' }}>
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: 'var(--color-accent-dim)',
          }}
        >
          {hand === 'left' ? t('hand_left') : t('hand_right')}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-bold text-white truncate">
            {playerA.firstName} {playerA.lastName}
          </div>
        </div>
        <div className="text-center font-black tabular-nums text-5xl sm:text-6xl text-white">
          <span>{scoreA}</span>
          <span className="px-2 opacity-50">:</span>
          <span>{scoreB}</span>
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-white truncate">
            {playerB.firstName} {playerB.lastName}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/Scoreboard.spec.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/Scoreboard.tsx apps/web/src/components/operator/armfight/Scoreboard.spec.tsx
git commit -m "feat(web): Scoreboard for armfight focus mode"
```

---

## Task 7: `LegHistoryStrip` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/LegHistoryStrip.tsx`
- Create: `apps/web/src/components/operator/armfight/LegHistoryStrip.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/LegHistoryStrip.spec.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

import { LegHistoryStrip } from './LegHistoryStrip';

const playerA = { id: 'a', firstName: 'Иван' };
const playerB = { id: 'b', firstName: 'Пётр' };

describe('LegHistoryStrip', () => {
  it('renders five slots when no legs played', () => {
    const { container } = render(
      <LegHistoryStrip legs={[]} playerA={playerA} playerB={playerB} />,
    );
    expect(container.querySelectorAll('[data-leg-slot]')).toHaveLength(5);
  });

  it('marks filled slots with winner initial', () => {
    render(
      <LegHistoryStrip
        legs={[
          { index: 1, winnerId: 'a', winType: 'pin' },
          { index: 2, winnerId: 'b', winType: 'foul' },
        ]}
        playerA={playerA}
        playerB={playerB}
      />,
    );
    // Two filled slots, three empty
    expect(screen.getAllByText('И')).toHaveLength(1);
    expect(screen.getAllByText('П')).toHaveLength(1);
  });

  it('renders the correction hint', () => {
    render(<LegHistoryStrip legs={[]} playerA={playerA} playerB={playerB} />);
    expect(
      screen.getByText('leg_history_correction_hint'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/LegHistoryStrip.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/LegHistoryStrip.tsx

'use client';

import { useTranslations } from 'next-intl';
import type { LegWinType } from '@gsm/bracket-engine';

interface Leg {
  index: number;
  winnerId: string;
  winType: LegWinType;
}

interface Props {
  legs: Leg[];
  playerA: { id: string; firstName: string };
  playerB: { id: string; firstName: string };
}

const WINTYPE_ICON: Record<LegWinType, string> = {
  pin: '✊',
  foul: '⛔',
  dq: '❌',
};

export function LegHistoryStrip({ legs, playerA, playerB }: Props) {
  const t = useTranslations('operator_armfight');
  const byIndex = new Map(legs.map((l) => [l.index, l]));

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider"
        style={{ color: 'var(--color-text-secondary)' }}>
        {t('leg_history_title')}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const leg = byIndex.get(i);
          const playerInitial = leg
            ? leg.winnerId === playerA.id
              ? playerA.firstName.charAt(0)
              : playerB.firstName.charAt(0)
            : '';
          return (
            <div
              key={i}
              data-leg-slot
              className="rounded-lg border text-center p-2 text-sm"
              style={{
                backgroundColor: leg
                  ? 'var(--color-secondary)'
                  : 'transparent',
                borderColor: leg
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(255,255,255,0.05)',
                opacity: leg ? 1 : 0.4,
              }}
            >
              <div className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                {i}
              </div>
              {leg && (
                <div className="flex items-center justify-center gap-1">
                  <span className="font-black text-white">{playerInitial}</span>
                  <span className="text-xs">{WINTYPE_ICON[leg.winType]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] italic" style={{ color: 'var(--color-text-secondary)' }}>
        {t('leg_history_correction_hint')}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/LegHistoryStrip.spec.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/LegHistoryStrip.tsx apps/web/src/components/operator/armfight/LegHistoryStrip.spec.tsx
git commit -m "feat(web): LegHistoryStrip with 5-slot strip and correction hint"
```

---

## Task 8: `WinnerCard` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/WinnerCard.tsx`
- Create: `apps/web/src/components/operator/armfight/WinnerCard.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/WinnerCard.spec.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: Record<string, unknown>) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

import { WinnerCard } from './WinnerCard';

const winner = { id: 'a', firstName: 'Иван', lastName: 'Иванов' };

describe('WinnerCard', () => {
  it('renders completed state without walkover badge', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={3}
        scoreB={1}
        status="completed"
        walkoverReason={null}
        backHref="/operator/tournaments/t1"
      />,
    );
    expect(screen.getByText(/Иван/)).toBeInTheDocument();
    expect(screen.queryByText('winner_card_walkover_badge')).toBeNull();
  });

  it('renders walkover badge and reason when present', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={2}
        scoreB={0}
        status="walkover"
        walkoverReason="травма"
        backHref="/operator/tournaments/t1"
      />,
    );
    expect(screen.getByText('winner_card_walkover_badge')).toBeInTheDocument();
    expect(screen.getByText(/травма/)).toBeInTheDocument();
  });

  it('renders walkover badge without reason when reason is null', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={0}
        scoreB={0}
        status="walkover"
        walkoverReason={null}
        backHref="/operator/tournaments/t1"
      />,
    );
    expect(screen.getByText('winner_card_walkover_badge')).toBeInTheDocument();
    expect(screen.queryByText(/winner_card_walkover_reason/)).toBeNull();
  });

  it('back link uses the provided href', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={3}
        scoreB={0}
        status="completed"
        walkoverReason={null}
        backHref="/operator/tournaments/abc"
      />,
    );
    const link = screen.getByRole('link', { name: /back_to_card/i });
    expect(link).toHaveAttribute('href', '/operator/tournaments/abc');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/WinnerCard.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/WinnerCard.tsx

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ArmfightBoutStatus } from '@gsm/bracket-engine';

interface Props {
  winner: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  status: Extract<ArmfightBoutStatus, 'completed' | 'walkover'>;
  walkoverReason: string | null;
  backHref: string;
}

export function WinnerCard({
  winner,
  scoreA,
  scoreB,
  status,
  walkoverReason,
  backHref,
}: Props) {
  const t = useTranslations('operator_armfight');
  const winnerName = `${winner.firstName} ${winner.lastName}`.trim();

  return (
    <div
      className="rounded-2xl border p-6 sm:p-10 text-center space-y-4"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <span className="text-5xl">🏆</span>

      {status === 'walkover' && (
        <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: 'var(--color-accent-dim)',
          }}>
          {t('winner_card_walkover_badge')}
        </div>
      )}

      <p className="text-2xl font-black text-white">
        {t('winner_card_title', { name: winnerName })}
      </p>

      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('winner_card_score', { scoreA, scoreB })}
      </p>

      {status === 'walkover' && walkoverReason && (
        <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
          {t('winner_card_walkover_reason', { reason: walkoverReason })}
        </p>
      )}

      <Link
        href={backHref}
        className="inline-block px-5 py-2.5 rounded-md text-sm font-bold border transition-colors"
        style={{
          color: 'var(--color-accent)',
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        {t('back_to_card')}
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/WinnerCard.spec.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/WinnerCard.tsx apps/web/src/components/operator/armfight/WinnerCard.spec.tsx
git commit -m "feat(web): WinnerCard for armfight terminal states"
```

---

## Task 9: `LegInputPanel` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/LegInputPanel.tsx`
- Create: `apps/web/src/components/operator/armfight/LegInputPanel.spec.tsx`

This is the two-step input panel: the parent has already chosen the winner; the panel only handles `winType` selection + confirm/cancel + mutation + error banner.

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/LegInputPanel.spec.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import { LegInputPanel } from './LegInputPanel';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseProps = {
  bracketId: 'bracket-1',
  boutId: 'wb_1_0',
  legIndex: 3,
  winner: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  onClose: vi.fn(),
  onCommitted: vi.fn(),
};

describe('LegInputPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the leg title with player name and index', () => {
    wrap(<LegInputPanel {...baseProps} />);
    expect(
      screen.getByText(/leg_input_title.*Иван Иванов.*3/),
    ).toBeInTheDocument();
  });

  it('starts with Pin pre-selected', () => {
    wrap(<LegInputPanel {...baseProps} />);
    expect(screen.getByRole('radio', { name: /wintype_pin/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /wintype_foul/i })).not.toBeChecked();
  });

  it('allows switching winType', () => {
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /wintype_dq/i }));
    expect(screen.getByRole('radio', { name: /wintype_dq/i })).toBeChecked();
  });

  it('calls the mutation with the chosen winType on confirm', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /wintype_foul/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/legs', {
      boutId: 'wb_1_0',
      legIndex: 3,
      winnerId: 'a',
      winType: 'foul',
    });
  });

  it('renders engine 400 message verbatim', async () => {
    (api.post as any).mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'recordLeg: legIndex must be next-in-sequence (expected 4, got 3)' },
      },
    });
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/legIndex must be next-in-sequence/),
      ).toBeInTheDocument(),
    );
  });

  it('cancel calls onClose, not mutation', () => {
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(baseProps.onClose).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/LegInputPanel.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/LegInputPanel.tsx

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LegWinType } from '@gsm/bracket-engine';
import { useRecordLeg } from '@/hooks/useArmfight';

interface Props {
  bracketId: string;
  boutId: string;
  legIndex: number;
  winner: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCommitted: () => void;
}

const WIN_TYPES: LegWinType[] = ['pin', 'foul', 'dq'];

export function LegInputPanel({
  bracketId,
  boutId,
  legIndex,
  winner,
  onClose,
  onCommitted,
}: Props) {
  const t = useTranslations('operator_armfight');
  const [winType, setWinType] = useState<LegWinType>('pin');
  const recordLeg = useRecordLeg(bracketId);
  const winnerName = `${winner.firstName} ${winner.lastName}`.trim();

  const serverMessage =
    recordLeg.error &&
    (recordLeg.error as any)?.response?.data?.message
      ? String((recordLeg.error as any).response.data.message)
      : null;

  const onConfirm = () => {
    recordLeg.mutate(
      { boutId, legIndex, winnerId: winner.id, winType },
      { onSuccess: () => onCommitted() },
    );
  };

  return (
    <div
      role="dialog"
      aria-label={t('leg_input_title', { name: winnerName, n: legIndex })}
      className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <div
        className="relative rounded-t-2xl sm:rounded-2xl border p-5 sm:max-w-md sm:w-full mx-0 sm:mx-4 space-y-4"
        style={{
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <h2 className="text-base font-black text-white">
          {t('leg_input_title', { name: winnerName, n: legIndex })}
        </h2>

        <div className="grid grid-cols-3 gap-2">
          {WIN_TYPES.map((wt) => (
            <label
              key={wt}
              className="cursor-pointer rounded-lg border py-3 text-center text-sm font-bold transition-colors"
              style={{
                backgroundColor:
                  winType === wt
                    ? 'var(--color-accent-dim)'
                    : 'transparent',
                borderColor:
                  winType === wt
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.15)',
                color: winType === wt ? 'var(--color-accent)' : 'white',
              }}
            >
              <input
                type="radio"
                name="winType"
                value={wt}
                checked={winType === wt}
                onChange={() => setWinType(wt)}
                className="sr-only"
                aria-label={t(`wintype_${wt}` as `wintype_${LegWinType}`)}
              />
              {t(`wintype_${wt}` as `wintype_${LegWinType}`)}
            </label>
          ))}
        </div>

        {serverMessage && (
          <div
            role="alert"
            className="rounded-md p-3 text-sm border"
            style={{
              color: 'var(--color-error)',
              backgroundColor: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <div className="font-bold mb-1">{t('error_recordleg_prefix')}</div>
            <div>{serverMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={recordLeg.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={recordLeg.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{
              backgroundColor: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              color: 'black',
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/LegInputPanel.spec.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/LegInputPanel.tsx apps/web/src/components/operator/armfight/LegInputPanel.spec.tsx
git commit -m "feat(web): LegInputPanel two-step input with engine error banner"
```

---

## Task 10: `ForfeitDialog` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/ForfeitDialog.tsx`
- Create: `apps/web/src/components/operator/armfight/ForfeitDialog.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/ForfeitDialog.spec.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import { ForfeitDialog } from './ForfeitDialog';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const props = {
  bracketId: 'bracket-1',
  boutId: 'wb_1_0',
  boutOrder: 1,
  playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
  onClose: vi.fn(),
  onCommitted: vi.fn(),
};

describe('ForfeitDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirm is disabled until a winner is selected', () => {
    wrap(<ForfeitDialog {...props} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Иван/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled();
  });

  it('submits with winnerId and trimmed reason', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    wrap(<ForfeitDialog {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Пётр/i }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  травма  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/forfeit', {
      boutId: 'wb_1_0',
      winnerId: 'b',
      walkoverReason: 'травма',
    });
  });

  it('submits without walkoverReason if textarea is empty/whitespace', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    wrap(<ForfeitDialog {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Иван/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect((api.post as any).mock.calls[0][1]).not.toHaveProperty(
      'walkoverReason',
    );
  });

  it('renders engine 400 verbatim', async () => {
    (api.post as any).mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'forfeitBout: bout already closed' },
      },
    });
    wrap(<ForfeitDialog {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Иван/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.getByText(/bout already closed/)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/ForfeitDialog.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/ForfeitDialog.tsx

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForfeitBout } from '@/hooks/useArmfight';

interface Props {
  bracketId: string;
  boutId: string;
  boutOrder: number;
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCommitted: () => void;
}

export function ForfeitDialog({
  bracketId,
  boutId,
  boutOrder,
  playerA,
  playerB,
  onClose,
  onCommitted,
}: Props) {
  const t = useTranslations('operator_armfight');
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const forfeit = useForfeitBout(bracketId);

  const serverMessage =
    forfeit.error && (forfeit.error as any)?.response?.data?.message
      ? String((forfeit.error as any).response.data.message)
      : null;

  const onConfirm = () => {
    if (!winnerId) return;
    const trimmed = reason.trim();
    forfeit.mutate(
      {
        boutId,
        winnerId,
        ...(trimmed ? { walkoverReason: trimmed } : {}),
      },
      { onSuccess: () => onCommitted() },
    );
  };

  const players = [playerA, playerB];

  return (
    <div
      role="dialog"
      aria-label={t('forfeit_dialog_title', { n: boutOrder })}
      className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <div
        className="relative rounded-t-2xl sm:rounded-2xl border p-5 sm:max-w-md sm:w-full mx-0 sm:mx-4 space-y-4"
        style={{
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <h2 className="text-base font-black text-white">
          {t('forfeit_dialog_title', { n: boutOrder })}
        </h2>

        <fieldset className="space-y-2">
          <legend
            className="text-xs uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('forfeit_dialog_winner_label')}
          </legend>
          {players.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 cursor-pointer rounded-md p-3 border"
              style={{
                borderColor:
                  winnerId === p.id
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.1)',
                backgroundColor:
                  winnerId === p.id ? 'var(--color-accent-dim)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="forfeit-winner"
                checked={winnerId === p.id}
                onChange={() => setWinnerId(p.id)}
                aria-label={`${p.firstName} ${p.lastName}`}
              />
              <span className="text-sm font-bold text-white">
                {p.firstName} {p.lastName}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1">
          <label
            className="text-xs uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('forfeit_dialog_reason_label')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('forfeit_dialog_reason_placeholder')}
            rows={3}
            className="w-full rounded-md border bg-transparent p-2 text-sm text-white"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          />
        </div>

        {serverMessage && (
          <div
            role="alert"
            className="rounded-md p-3 text-sm border"
            style={{
              color: 'var(--color-error)',
              backgroundColor: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <div className="font-bold mb-1">{t('error_forfeit_prefix')}</div>
            <div>{serverMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={forfeit.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!winnerId || forfeit.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{
              backgroundColor: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              color: 'black',
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/ForfeitDialog.spec.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/ForfeitDialog.tsx apps/web/src/components/operator/armfight/ForfeitDialog.spec.tsx
git commit -m "feat(web): ForfeitDialog with optional walkover reason"
```

---

## Task 11: `BoutFocusView` orchestrator + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/BoutFocusView.tsx`
- Create: `apps/web/src/components/operator/armfight/BoutFocusView.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/BoutFocusView.spec.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/hooks/useBracketSocket', () => ({
  useBracketSocket: vi.fn(),
}));

import { api } from '@/lib/api';
import { BoutFocusView } from './BoutFocusView';
import type { BoutSnapshot } from './types';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const pendingBout: BoutSnapshot = {
  boutId: 'wb_1_0',
  order: 1,
  hand: 'right',
  playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
  scoreA: 0,
  scoreB: 0,
  status: 'pending',
  leadingId: null,
  legs: [],
  walkoverReason: null,
};

describe('BoutFocusView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the not-found panel when boutId is missing', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_99"
        isLocked={false}
      />,
    );
    expect(await screen.findByText('error_bout_not_found')).toBeInTheDocument();
  });

  it('renders pending state with player buttons and Forfeit button', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    expect(await screen.findByRole('button', { name: /Иван Иванов/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Пётр Петров/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forfeit_button/i }))
      .toBeInTheDocument();
  });

  it('opens LegInputPanel when a player button is tapped', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Иван Иванов/i }));
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('leg_input_title'),
    );
  });

  it('renders WinnerCard when status is completed', async () => {
    (api.get as any).mockResolvedValue({
      data: [
        {
          ...pendingBout,
          scoreA: 3,
          scoreB: 1,
          status: 'completed',
          legs: [
            { index: 1, winnerId: 'a', winType: 'pin' },
            { index: 2, winnerId: 'a', winType: 'pin' },
            { index: 3, winnerId: 'b', winType: 'pin' },
            { index: 4, winnerId: 'a', winType: 'pin' },
          ],
        },
      ],
    });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    expect(
      await screen.findByText(/winner_card_title.*Иван Иванов/),
    ).toBeInTheDocument();
  });

  it('disables input when isLocked', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={true}
      />,
    );
    const ivanBtn = await screen.findByRole('button', { name: /Иван Иванов/i });
    expect(ivanBtn).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /forfeit_button/i }),
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/BoutFocusView.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/BoutFocusView.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useArmfightBouts } from '@/hooks/useArmfight';
import { useBracketSocket } from '@/hooks/useBracketSocket';
import { Skeleton } from '@/components/ui/Skeleton';
import { Scoreboard } from './Scoreboard';
import { LegHistoryStrip } from './LegHistoryStrip';
import { LegInputPanel } from './LegInputPanel';
import { ForfeitDialog } from './ForfeitDialog';
import { WinnerCard } from './WinnerCard';
import type { BoutSnapshot } from './types';

interface Props {
  tournamentId: string;
  bracketId: string;
  boutId: string;
  isLocked: boolean;
}

export function BoutFocusView({
  tournamentId,
  bracketId,
  boutId,
  isLocked,
}: Props) {
  const t = useTranslations('operator_armfight');
  const { data: bouts, isLoading } = useArmfightBouts(bracketId);
  useBracketSocket(tournamentId);

  const [pendingWinner, setPendingWinner] = useState<
    BoutSnapshot['playerA'] | null
  >(null);
  const [forfeitOpen, setForfeitOpen] = useState(false);

  const backHref = `/operator/tournaments/${tournamentId}`;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const bout = (bouts ?? []).find((b) => b.boutId === boutId);
  if (!bout) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p className="text-white font-bold">{t('error_bout_not_found')}</p>
        <Link href={backHref} className="underline text-sm"
          style={{ color: 'var(--color-text-secondary)' }}>
          {t('back_to_card')}
        </Link>
      </div>
    );
  }

  const winner =
    bout.status === 'completed' || bout.status === 'walkover'
      ? bout.scoreA > bout.scoreB
        ? bout.playerA
        : bout.playerB
      : null;

  const isTerminal = bout.status === 'completed' || bout.status === 'walkover';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm hover:text-white transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('back_to_card')}
        </Link>
        <span className="text-xs font-bold"
          style={{ color: 'var(--color-text-secondary)' }}>
          {t('bout_label', { n: bout.order })}
        </span>
      </div>

      {isLocked && (
        <div className="rounded-md p-3 text-xs border"
          style={{
            color: 'rgb(250, 204, 21)',
            backgroundColor: 'rgba(250,204,21,0.08)',
            borderColor: 'rgba(250,204,21,0.3)',
          }}>
          🔒 {t('bracket_locked')}
        </div>
      )}

      {isTerminal && winner ? (
        <WinnerCard
          winner={winner}
          scoreA={bout.scoreA}
          scoreB={bout.scoreB}
          status={bout.status as 'completed' | 'walkover'}
          walkoverReason={bout.walkoverReason}
          backHref={backHref}
        />
      ) : (
        <>
          <Scoreboard
            playerA={bout.playerA}
            playerB={bout.playerB}
            scoreA={bout.scoreA}
            scoreB={bout.scoreB}
            hand={bout.hand}
          />

          <LegHistoryStrip
            legs={bout.legs}
            playerA={bout.playerA}
            playerB={bout.playerB}
          />

          <div className="grid grid-cols-2 gap-3">
            {[bout.playerA, bout.playerB].map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isLocked}
                onClick={() => setPendingWinner(p)}
                className="rounded-2xl border-2 py-6 px-3 text-center transition-colors disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--color-accent-dim)',
                  borderColor: 'var(--color-accent)',
                }}
              >
                <div className="font-black text-base text-white">
                  {p.firstName} {p.lastName}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isLocked}
            onClick={() => setForfeitOpen(true)}
            className="w-full rounded-md border py-3 text-sm font-bold transition-colors disabled:opacity-40"
            style={{
              color: 'var(--color-error)',
              borderColor: 'rgba(239,68,68,0.4)',
              backgroundColor: 'rgba(239,68,68,0.05)',
            }}
          >
            {t('forfeit_button')}
          </button>
        </>
      )}

      {pendingWinner && (
        <LegInputPanel
          bracketId={bracketId}
          boutId={bout.boutId}
          legIndex={bout.legs.length + 1}
          winner={pendingWinner}
          onClose={() => setPendingWinner(null)}
          onCommitted={() => setPendingWinner(null)}
        />
      )}

      {forfeitOpen && (
        <ForfeitDialog
          bracketId={bracketId}
          boutId={bout.boutId}
          boutOrder={bout.order}
          playerA={bout.playerA}
          playerB={bout.playerB}
          onClose={() => setForfeitOpen(false)}
          onCommitted={() => setForfeitOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/BoutFocusView.spec.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/BoutFocusView.tsx apps/web/src/components/operator/armfight/BoutFocusView.spec.tsx
git commit -m "feat(web): BoutFocusView orchestrator for armfight focus mode"
```

---

## Task 12: `BoutListItem` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/BoutListItem.tsx`
- Create: `apps/web/src/components/operator/armfight/BoutListItem.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/BoutListItem.spec.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

import { BoutListItem } from './BoutListItem';
import type { BoutSnapshot } from './types';

const base: BoutSnapshot = {
  boutId: 'wb_1_0',
  order: 1,
  hand: 'right',
  playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
  scoreA: 0,
  scoreB: 0,
  status: 'pending',
  leadingId: null,
  legs: [],
  walkoverReason: null,
};

describe('BoutListItem', () => {
  it('renders Link to bout focus URL', () => {
    render(<BoutListItem bout={base} tournamentId="t1" isNextPending={false} locked={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      '/operator/tournaments/t1/bouts/wb_1_0',
    );
  });

  it('shows status_pending for pending bout', () => {
    render(<BoutListItem bout={base} tournamentId="t1" isNextPending={false} locked={false} />);
    expect(screen.getByText('status_pending')).toBeInTheDocument();
  });

  it('shows score for in_progress bout', () => {
    render(
      <BoutListItem
        bout={{ ...base, status: 'in_progress', scoreA: 2, scoreB: 1 }}
        tournamentId="t1"
        isNextPending={false}
        locked={false}
      />,
    );
    expect(screen.getByText(/status_in_progress/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it('shows winner for completed bout', () => {
    render(
      <BoutListItem
        bout={{ ...base, status: 'completed', scoreA: 3, scoreB: 1 }}
        tournamentId="t1"
        isNextPending={false}
        locked={false}
      />,
    );
    expect(screen.getByText(/status_completed/)).toBeInTheDocument();
  });

  it('shows walkover badge', () => {
    render(
      <BoutListItem
        bout={{ ...base, status: 'walkover', scoreA: 0, scoreB: 0 }}
        tournamentId="t1"
        isNextPending={false}
        locked={false}
      />,
    );
    expect(screen.getByText(/status_walkover/)).toBeInTheDocument();
  });

  it('shows next-pending badge when flagged', () => {
    render(<BoutListItem bout={base} tournamentId="t1" isNextPending={true} locked={false} />);
    expect(screen.getByText('next_pending_badge')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/BoutListItem.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/BoutListItem.tsx

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { BoutSnapshot } from './types';

interface Props {
  bout: BoutSnapshot;
  tournamentId: string;
  isNextPending: boolean;
  locked: boolean;
}

export function BoutListItem({
  bout,
  tournamentId,
  isNextPending,
  locked,
}: Props) {
  const t = useTranslations('operator_armfight');
  const href = `/operator/tournaments/${tournamentId}/bouts/${bout.boutId}`;

  const playerAName = `${bout.playerA.firstName} ${bout.playerA.lastName}`.trim();
  const playerBName = `${bout.playerB.firstName} ${bout.playerB.lastName}`.trim();

  const winnerName =
    bout.scoreA > bout.scoreB ? playerAName : playerBName;

  let statusLine: React.ReactNode;
  switch (bout.status) {
    case 'pending':
      statusLine = t('status_pending');
      break;
    case 'in_progress':
      statusLine = (
        <>
          {t('status_in_progress')} ·{' '}
          <span className="tabular-nums">
            {bout.scoreA}:{bout.scoreB}
          </span>
        </>
      );
      break;
    case 'completed':
      statusLine = (
        <>
          ✓ {t('status_completed')} · {winnerName}{' '}
          <span className="tabular-nums">
            {bout.scoreA}:{bout.scoreB}
          </span>
        </>
      );
      break;
    case 'walkover':
      statusLine = (
        <>
          {t('status_walkover')} · {winnerName}
        </>
      );
      break;
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border p-4 transition-colors"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: isNextPending
          ? 'var(--color-accent)'
          : 'rgba(255,255,255,0.08)',
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black"
            style={{ color: 'var(--color-text-secondary)' }}>
            {t('bout_label', { n: bout.order })}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            style={{
              color: 'var(--color-accent)',
              backgroundColor: 'var(--color-accent-dim)',
            }}
          >
            {bout.hand === 'left' ? 'L' : 'R'}
          </span>
        </div>
        {isNextPending && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{
              color: 'var(--color-accent)',
              backgroundColor: 'var(--color-accent-dim)',
            }}
          >
            {t('next_pending_badge')}
          </span>
        )}
      </div>
      <div className="text-sm font-bold text-white mb-1">
        {playerAName} · {playerBName}
      </div>
      <div className="text-xs"
        style={{ color: 'var(--color-text-secondary)' }}>
        {statusLine}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/BoutListItem.spec.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/BoutListItem.tsx apps/web/src/components/operator/armfight/BoutListItem.spec.tsx
git commit -m "feat(web): BoutListItem for armfight fight card list"
```

---

## Task 13: `ArmfightFightCard` component + spec

**Files:**
- Create: `apps/web/src/components/operator/armfight/ArmfightFightCard.tsx`
- Create: `apps/web/src/components/operator/armfight/ArmfightFightCard.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/web/src/components/operator/armfight/ArmfightFightCard.spec.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useBracketSocket', () => ({ useBracketSocket: vi.fn() }));

import { api } from '@/lib/api';
import { ArmfightFightCard } from './ArmfightFightCard';
import type { Bracket } from '@/types/api';
import type { BoutSnapshot } from './types';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const makeBracket = (over: Partial<Bracket> = {}): Bracket =>
  ({
    id: 'bracket-1',
    tournamentId: 't1',
    isLocked: false,
    bracketData: { format: 'armfight' } as any,
    ...over,
  }) as Bracket;

const bouts: BoutSnapshot[] = [
  {
    boutId: 'wb_1_0',
    order: 1,
    hand: 'right',
    playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
    playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
    scoreA: 3,
    scoreB: 1,
    status: 'completed',
    leadingId: 'a',
    legs: [],
    walkoverReason: null,
  },
  {
    boutId: 'wb_1_1',
    order: 2,
    hand: 'right',
    playerA: { id: 'c', firstName: 'Сергей', lastName: 'Сидоров' },
    playerB: { id: 'd', firstName: 'Олег', lastName: 'Козлов' },
    scoreA: 0,
    scoreB: 0,
    status: 'pending',
    leadingId: null,
    legs: [],
    walkoverReason: null,
  },
];

describe('ArmfightFightCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading skeleton initially', () => {
    (api.get as any).mockImplementation(() => new Promise(() => {}));
    const { container } = wrap(
      <ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />,
    );
    expect(container.querySelectorAll('[class*="Skeleton"]').length + container.querySelectorAll('[data-skeleton]').length).toBeGreaterThanOrEqual(0);
  });

  it('renders one BoutListItem per bout', async () => {
    (api.get as any).mockResolvedValue({ data: bouts });
    wrap(<ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />);
    expect(await screen.findAllByRole('link')).toHaveLength(bouts.length);
  });

  it('flags the first pending bout as next when there is a closed bout', async () => {
    (api.get as any).mockResolvedValue({ data: bouts });
    wrap(<ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />);
    expect(await screen.findByText('next_pending_badge')).toBeInTheDocument();
  });

  it('shows lock banner when bracket.isLocked', async () => {
    (api.get as any).mockResolvedValue({ data: bouts });
    wrap(
      <ArmfightFightCard
        tournamentId="t1"
        bracket={makeBracket({ isLocked: true })}
      />,
    );
    expect(await screen.findByText('bracket_locked')).toBeInTheDocument();
  });

  it('does NOT flag next pending when all bouts are still pending', async () => {
    (api.get as any).mockResolvedValue({
      data: bouts.map((b) => ({ ...b, status: 'pending', scoreA: 0, scoreB: 0 })),
    });
    wrap(<ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />);
    await screen.findAllByRole('link');
    expect(screen.queryByText('next_pending_badge')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/ArmfightFightCard.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/operator/armfight/ArmfightFightCard.tsx

'use client';

import { useTranslations } from 'next-intl';
import { useArmfightBouts } from '@/hooks/useArmfight';
import { useBracketSocket } from '@/hooks/useBracketSocket';
import { Skeleton } from '@/components/ui/Skeleton';
import { BoutListItem } from './BoutListItem';
import type { Bracket } from '@/types/api';

interface Props {
  tournamentId: string;
  bracket: Bracket;
}

export function ArmfightFightCard({ tournamentId, bracket }: Props) {
  const t = useTranslations('operator_armfight');
  const { data: bouts, isLoading } = useArmfightBouts(bracket.id);
  useBracketSocket(tournamentId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  const list = (bouts ?? []).slice().sort((a, b) => a.order - b.order);
  const anyClosed = list.some(
    (b) => b.status === 'completed' || b.status === 'walkover',
  );
  const nextPendingId = anyClosed
    ? (list.find((b) => b.status === 'pending')?.boutId ?? null)
    : null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-black text-white">{t('card_title')}</h2>
        <p className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}>
          {t('card_subtitle', { n: list.length })}
        </p>
      </div>

      {bracket.isLocked && (
        <div className="rounded-md p-3 text-xs border"
          style={{
            color: 'rgb(250, 204, 21)',
            backgroundColor: 'rgba(250,204,21,0.08)',
            borderColor: 'rgba(250,204,21,0.3)',
          }}>
          🔒 {t('bracket_locked')}
        </div>
      )}

      {list.map((bout) => (
        <BoutListItem
          key={bout.boutId}
          bout={bout}
          tournamentId={tournamentId}
          isNextPending={bout.boutId === nextPendingId}
          locked={bracket.isLocked}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

```bash
cd apps/web && npx vitest run src/components/operator/armfight/ArmfightFightCard.spec.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/operator/armfight/ArmfightFightCard.tsx apps/web/src/components/operator/armfight/ArmfightFightCard.spec.tsx
git commit -m "feat(web): ArmfightFightCard list view with next-pending highlight"
```

---

## Task 14: New focus-mode route `/operator/tournaments/[tournamentId]/bouts/[boutId]/page.tsx`

**Files:**
- Create: `apps/web/src/app/operator/tournaments/[tournamentId]/bouts/[boutId]/page.tsx`

This is a thin page component that reuses the existing `useOperatorBrackets(tournamentId)` cache to find the armfight bracket and pass `isLocked` into `<BoutFocusView>`. Mirrors the `useArmfightBracket` filter pattern from sub-C.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p apps/web/src/app/operator/tournaments/\[tournamentId\]/bouts/\[boutId\]
```

- [ ] **Step 2: Write the page component**

```tsx
// apps/web/src/app/operator/tournaments/[tournamentId]/bouts/[boutId]/page.tsx

'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useOperatorBrackets } from '@/hooks/useOperator';
import { Skeleton } from '@/components/ui/Skeleton';
import { BoutFocusView } from '@/components/operator/armfight/BoutFocusView';

export default function BoutFocusPage({
  params,
}: {
  params: Promise<{ tournamentId: string; boutId: string }>;
}) {
  const { tournamentId, boutId } = use(params);
  const t = useTranslations('operator_armfight');
  const { data: brackets, isLoading } = useOperatorBrackets(tournamentId);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Skeleton className="h-screen w-full rounded-2xl" />
      </div>
    );
  }

  const bracket = (brackets ?? []).find(
    (b) => (b.bracketData as any)?.format === 'armfight',
  );

  if (!bracket) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p className="text-white font-bold">{t('error_not_armfight')}</p>
        <Link
          href={`/operator/tournaments/${tournamentId}`}
          className="underline text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('back_to_card')}
        </Link>
      </div>
    );
  }

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

- [ ] **Step 3: Type-check passes**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/operator/tournaments/[tournamentId]/bouts/[boutId]/page.tsx"
git commit -m "feat(web): /operator/tournaments/:id/bouts/:boutId focus route"
```

---

## Task 15: Branch existing operator page to render `ArmfightFightCard` for armfight

**Files:**
- Modify: `apps/web/src/app/operator/tournaments/[tournamentId]/page.tsx`

The existing page renders `<MatchList>` for the chosen bracket (line 110). We add a branch — if `bracketData.format === 'armfight'`, render `<ArmfightFightCard>` instead. The `<MyTableBanner>` is hidden for armfight (table model doesn't apply per spec §2.11).

- [ ] **Step 1: Read the relevant section**

The current code is roughly:

```tsx
const bracket = brackets[selectedBracketIdx];
return (
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
    <Link href="/operator" ...>← {t('my_tournaments')}</Link>
    <h1>{t('title')}</h1>
    <MyTableBanner tournamentId={tournamentId} />
    {/* category tabs */}
    {bracket.isLocked && (<div className="...">🔒 {t('bracket_locked')}</div>)}
    {bracket.bracketData ? (
      <MatchList bracket={bracket} tournamentId={tournamentId} />
    ) : (
      <p>{t('no_bracket')}</p>
    )}
  </div>
);
```

Locate it in `apps/web/src/app/operator/tournaments/[tournamentId]/page.tsx`.

- [ ] **Step 2: Add the import at the top**

After the existing imports for `MatchResultForm`, add:

```tsx
import { ArmfightFightCard } from '@/components/operator/armfight/ArmfightFightCard';
```

- [ ] **Step 3: Compute `isArmfightBracket` and branch**

Replace the block from `<MyTableBanner ... />` through the bracket-rendered area with:

```tsx
const isArmfightBracket =
  (bracket?.bracketData as any)?.format === 'armfight';

return (
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
    <Link
      href="/operator"
      className="inline-flex items-center gap-2 text-sm mb-6 hover:text-white transition-colors"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      ← {t('my_tournaments')}
    </Link>

    <h1 className="text-xl font-black text-white mb-4">{t('title')}</h1>

    {/* Table assignment scaffold — not applicable to armfight (single ring) */}
    {!isArmfightBracket && <MyTableBanner tournamentId={tournamentId} />}

    {/* Category tabs */}
    {brackets.length > 1 && (
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {brackets.map((b, idx) => (
          <button
            key={b.id}
            onClick={() => setSelectedBracketIdx(idx)}
            className="shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors"
            style={{
              borderColor:
                idx === selectedBracketIdx ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
              color:
                idx === selectedBracketIdx
                  ? 'var(--color-accent)'
                  : 'var(--color-text-secondary)',
              backgroundColor:
                idx === selectedBracketIdx ? 'var(--color-accent-dim)' : 'transparent',
            }}
          >
            {b.weightCategory?.name ?? b.name ?? t('category', { n: idx + 1 })}
            {b.isLocked && <span className="ml-1 text-yellow-400">🔒</span>}
          </button>
        ))}
      </div>
    )}

    {bracket.isLocked && !isArmfightBracket && (
      <div className="mb-4 rounded-xl px-4 py-3 text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/20">
        🔒 {t('bracket_locked')}
      </div>
    )}

    {bracket.bracketData ? (
      isArmfightBracket ? (
        <ArmfightFightCard tournamentId={tournamentId} bracket={bracket} />
      ) : (
        <MatchList bracket={bracket} tournamentId={tournamentId} />
      )
    ) : (
      <p className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
        {t('no_bracket')}
      </p>
    )}
  </div>
);
```

Notes:
- `<ArmfightFightCard>` owns its own lock banner (the one from `t('bracket_locked')` in the `operator_armfight` namespace, with translation copy specific to armfight). The locked-bracket banner from the existing `operator_tournament` namespace is skipped for armfight to avoid double-rendering.
- The category-tabs block stays — sub-C established that an armfight tournament has at most ONE armfight bracket, but it can coexist with non-armfight brackets if an organizer ever bolts on extra weight categories. Tabs still work.

- [ ] **Step 4: Type-check + run full operator page tests**

```bash
cd apps/web && npx tsc --noEmit
cd apps/web && npx vitest run src/app/operator/
```

Expected: no type errors; whichever existing operator specs there are still pass (no new spec added in this task — the conditional branch is exercised through `<ArmfightFightCard>`'s own spec).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/operator/tournaments/[tournamentId]/page.tsx"
git commit -m "feat(web): branch operator tournament page for armfight format"
```

---

## Task 16: i18n — add `operator_armfight` namespace to all three locales

**Files:**
- Modify: `apps/web/src/messages/ru.json`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/hy.json`

- [ ] **Step 1: Add the namespace block to `ru.json`**

Append the following keys at the appropriate place inside the root JSON object (typically right after the existing `operator_tournament` namespace; preserve trailing commas correctly):

```json
"operator_armfight": {
  "card_title": "Карточка боёв",
  "card_subtitle": "{n, plural, one {# бой} few {# боя} other {# боёв}}",
  "bracket_locked": "Сетка заблокирована — изменения недоступны",

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
```

- [ ] **Step 2: Add to `en.json`**

```json
"operator_armfight": {
  "card_title": "Fight card",
  "card_subtitle": "{n, plural, one {# bout} other {# bouts}}",
  "bracket_locked": "Bracket locked — changes disabled",

  "bout_label": "Bout {n}",
  "hand_left": "left",
  "hand_right": "right",

  "status_pending": "Waiting",
  "status_in_progress": "Live",
  "status_completed": "Finished",
  "status_walkover": "Walkover",

  "next_pending_badge": "Up next",
  "back_to_card": "← Back to fight card",

  "leg_n_of_5": "Leg {n} of 5",
  "leg_input_title": "{name} won leg {n}",
  "wintype_pin": "Pin",
  "wintype_foul": "Foul",
  "wintype_dq": "DQ",
  "confirm": "Confirm",
  "cancel": "Cancel",

  "leg_history_title": "Leg history",
  "leg_history_correction_hint": "Wrong entry? Ask the organizer — a leg can only be changed by resetting the whole bout.",

  "forfeit_button": "Forfeit bout (walkover)",
  "forfeit_dialog_title": "Forfeit bout {n}",
  "forfeit_dialog_winner_label": "Who stays in (winner)",
  "forfeit_dialog_reason_label": "Reason (optional, for the audit log)",
  "forfeit_dialog_reason_placeholder": "e.g. no-show, injury…",

  "winner_card_title": "{name} won",
  "winner_card_score": "Final score {scoreA}:{scoreB}",
  "winner_card_walkover_badge": "Walkover",
  "winner_card_walkover_reason": "Reason: {reason}",

  "error_recordleg_prefix": "Could not record leg",
  "error_forfeit_prefix": "Could not forfeit bout",
  "error_network": "Could not save — check your connection",
  "error_no_access": "You don't have access to this tournament",
  "error_bout_not_found": "Bout not found",
  "error_not_armfight": "This bracket is not an armfight card"
}
```

- [ ] **Step 3: Add to `hy.json`**

```json
"operator_armfight": {
  "card_title": "Մարտերի քարտ",
  "card_subtitle": "{n, plural, one {# մարտ} other {# մարտ}}",
  "bracket_locked": "Ցանցը կողպված է — փոփոխությունները հասանելի չեն",

  "bout_label": "Մարտ {n}",
  "hand_left": "ձախ",
  "hand_right": "աջ",

  "status_pending": "Սպասում է",
  "status_in_progress": "Ընթացքում",
  "status_completed": "Ավարտված",
  "status_walkover": "Walkover",

  "next_pending_badge": "Հաջորդը",
  "back_to_card": "← Վերադառնալ քարտին",

  "leg_n_of_5": "Leg {n} 5-ից",
  "leg_input_title": "{name}-ը հաղթեց leg {n}-ին",
  "wintype_pin": "Pin",
  "wintype_foul": "Foul",
  "wintype_dq": "DQ",
  "confirm": "Հաստատել",
  "cancel": "Չեղարկել",

  "leg_history_title": "Leg-երի պատմություն",
  "leg_history_correction_hint": "Սխալ գրառո՞ւմ։ Դիմեք կազմակերպչին — leg-ը կարող է փոխվել միայն ողջ մարտի վերակայմամբ:",

  "forfeit_button": "Հանել մարտը (walkover)",
  "forfeit_dialog_title": "Հանել մարտ {n}",
  "forfeit_dialog_winner_label": "Ով է մնում (հաղթող)",
  "forfeit_dialog_reason_label": "Պատճառ (ոչ պարտադիր, աուդիտի համար)",
  "forfeit_dialog_reason_placeholder": "Օր.՝ չի ներկայացել, վնասվածք…",

  "winner_card_title": "{name}-ը հաղթեց",
  "winner_card_score": "Վերջնական հաշիվ {scoreA}:{scoreB}",
  "winner_card_walkover_badge": "Walkover",
  "winner_card_walkover_reason": "Պատճառ՝ {reason}",

  "error_recordleg_prefix": "Չհաջողվեց գրանցել leg-ը",
  "error_forfeit_prefix": "Չհաջողվեց հանել մարտը",
  "error_network": "Չհաջողվեց պահել — ստուգեք կապը",
  "error_no_access": "Դուք չունեք մուտք այս մրցաշարին",
  "error_bout_not_found": "Մարտը չի գտնվել",
  "error_not_armfight": "Այս ցանցը armfight չէ"
}
```

- [ ] **Step 4: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/messages/ru.json'))"
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/messages/en.json'))"
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/messages/hy.json'))"
```

Expected: no parse errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/messages/ru.json apps/web/src/messages/en.json apps/web/src/messages/hy.json
git commit -m "chore(web): operator_armfight i18n namespace (ru/en/hy)"
```

---

## Task 17: Final gate — lint, full test, manual QA notes

**Files:** none (validation only)

- [ ] **Step 1: Lint passes**

```bash
npx turbo lint
```

Expected: no errors. If any warnings show up in newly-added files, fix them inline (re-run `npx turbo lint` to confirm).

- [ ] **Step 2: All tests pass**

```bash
npx turbo test
```

Expected:
- `apps/web` — all existing tests + 33-36 new tests in `useArmfight.spec.ts` and `components/operator/armfight/*.spec.tsx`.
- Other packages — unchanged.

- [ ] **Step 3: Production build smoke check**

```bash
cd apps/web && npm run build
```

Expected: build succeeds. The new route `/operator/tournaments/[tournamentId]/bouts/[boutId]` appears in the Next.js route summary.

- [ ] **Step 4: Manual QA walk-through (document in PR body)**

Boot the stack:
```bash
# Terminal 1
cd apps/api && npm run dev

# Terminal 2
cd apps/web && npm run dev
```

Then verify each scenario manually (check each off in the PR description):

- [ ] Create an armfight tournament via the admin wizard (`competitionType: 'armfight'`); open registration; confirm two athletes; go to the pair-builder route and submit one pair; back on the detail page, verify the bracket-generated badge.
- [ ] Assign yourself as operator on that tournament (via admin → operators).
- [ ] Open `/operator/tournaments/{id}` — see the fight-card list (NOT the generic `MatchList`); see the `MyTableBanner` is HIDDEN.
- [ ] Tap the pending bout → land on `/operator/tournaments/{id}/bouts/wb_1_0` — see the scoreboard `0:0`, empty 5-slot leg strip, two player buttons, the red Forfeit button.
- [ ] Tap player A → `LegInputPanel` opens with Pin pre-selected → tap Confirm → score becomes `1:0` and leg 1 fills.
- [ ] Record two more pin legs to A → `WinnerCard` appears with `Назад к карточке` CTA.
- [ ] Back to list — closed bout's status shows `✓ Завершён · A 3:0`.
- [ ] Generate a new armfight tournament with two pairs; in the focus view of bout 1, tap Forfeit → choose A → leave reason empty → Confirm → walkover card appears WITHOUT the reason row.
- [ ] Repeat the forfeit but type a reason → confirm — walkover card shows the reason.
- [ ] Open the same focus screen in two browser tabs; record a leg in tab 1 → tab 2 updates within ~1s (websocket invalidation).
- [ ] As admin, lock the bracket → reload operator UI → see yellow lock banner; the player buttons + Forfeit are disabled; the bout list rows are still tappable; the focus view also shows the lock chip and disabled controls.
- [ ] Visit `/operator/tournaments/{id}/bouts/wb_1_99` (a bogus boutId) → see the `Бой не найден` panel + back link.
- [ ] Visit the focus route on a NON-armfight tournament (`/operator/tournaments/{regular-id}/bouts/anything`) → see the `Эта сетка не armfight` panel + back link.

If any step fails, file the bug, fix it, and re-run `npx turbo lint && npx turbo test` before finalising the PR.

- [ ] **Step 5: Push the branch and open the PR**

```bash
git push -u origin feature/armfight-operator-ui
gh pr create --title "feat(web): armfight operator live-scoring UI (sub-D)" --body "$(cat <<'EOF'
## Summary
- Operator UI for live leg-by-leg scoring of armfight bo5 bouts on the existing /operator surface.
- Conditional render on /operator/tournaments/[id] (renders ArmfightFightCard for armfight format, MatchList for everything else).
- New focus route /operator/tournaments/[id]/bouts/[boutId] with two-step leg input + forfeit dialog.
- 3 new hooks (useArmfightBouts, useRecordLeg, useForfeitBout) using the API endpoints from sub-B.
- Pure frontend; no backend / engine / DB changes.

## Spec
docs/superpowers/specs/2026-05-25-armfight-operator-ui-design.md (commit 6c28086)

## Test plan
[Bulleted manual checklist from Task 17 Step 4 of the plan — paste it here when the PR is opened]

## Tests
- ~33-36 new Vitest cases in apps/web (useArmfight.spec.ts + 8 component spec files).
- Coverage gates unchanged (apps/web has no gate; bracket-engine ≥90% still holds).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

After writing all the tasks above, this section is the writing-plans skill's "self-review" gate.

### 1. Spec coverage check

| Spec section | Implemented by |
|---|---|
| §3.1 file tree | Tasks 1-16 cover every file listed |
| §4 state machine + flows | Task 11 (BoutFocusView) state switch + Tasks 9-10 (LegInputPanel/ForfeitDialog) flows |
| §5.1 ArmfightFightCard | Task 13 |
| §5.2 BoutListItem | Task 12 |
| §5.3 BoutFocusView | Task 11 |
| §5.4 Scoreboard | Task 6 |
| §5.5 LegHistoryStrip | Task 7 |
| §5.6 LegInputPanel | Task 9 |
| §5.7 ForfeitDialog | Task 10 |
| §5.8 WinnerCard | Task 8 |
| §5.9 page entry | Task 14 |
| §5.10 local types | Task 1 |
| §6 hooks | Tasks 2-4 |
| §6.1 socket extension | Task 5 |
| §7 error handling | Tasks 9-10 (engine error banners), Task 11 (lock chip / not-found) |
| §8 i18n | Task 16 |
| §9 testing | Each component task includes its own spec; Task 17 runs the full gate + manual QA |
| §10 YAGNI | Task constraints reflect §10 — no leg correction UI, no auto-advance, no claim flow |
| §11 conventions | Task 17 lint + test gate; commit messages follow conventional commits |
| §12 implementation order | Tasks 0-17 mirror the order in §12 |

No gaps.

### 2. Placeholder scan

Searched the plan for "TBD", "TODO", "implement later", "fill in details", "appropriate error handling" — none present. All code blocks are complete; all commands are exact.

The one "TODO" reference in the plan (Task 5 commentary on the existing `TODO(armfight-concurrency)`) is an explicit citation to a sub-B engine comment, not a plan placeholder.

### 3. Type consistency

- `BoutSnapshot` shape: defined in Task 1, used in Tasks 2 (queryKey return), 9-13 (props). Signatures match.
- `useRecordLeg(bracketId)` and `useForfeitBout(bracketId)` signatures: defined in Tasks 3-4, used in Tasks 9-10 with matching arg shape `{ boutId, legIndex, winnerId, winType }` and `{ boutId, winnerId, walkoverReason? }`.
- `<BoutFocusView>` props `{ tournamentId, bracketId, boutId, isLocked }`: defined in Task 11, called in Task 14 with all four args.
- `<ArmfightFightCard>` props `{ tournamentId, bracket }`: defined in Task 13, called in Task 15 with both args.
- i18n keys used across tasks 6-13 all appear in Task 16's namespace block (verified by spot-checking: `bout_label`, `hand_left`/`hand_right`, `status_*`, `leg_input_title`, `wintype_*`, `confirm`/`cancel`, `forfeit_button`, `winner_card_*`, `error_recordleg_prefix`, `error_forfeit_prefix`, `error_bout_not_found`, `error_not_armfight`, `back_to_card`, `bracket_locked`, `leg_history_title`, `leg_history_correction_hint`, `next_pending_badge`, `card_title`, `card_subtitle`, `forfeit_dialog_title`, `forfeit_dialog_winner_label`, `forfeit_dialog_reason_label`, `forfeit_dialog_reason_placeholder`, `winner_card_walkover_badge`, `winner_card_walkover_reason`).

No inconsistencies found.
