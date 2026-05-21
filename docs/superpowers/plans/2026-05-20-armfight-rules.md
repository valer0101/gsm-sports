# Armfight Rules Engine (Sub-Project B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `packages/bracket-engine` from 1v1 armfight to an N-pair best-of-5 fight card, wire `apps/api` to accept admin-curated pairs and score legs/walkovers, and lift bracket-engine coverage to ≥ 90%.

**Architecture:** A `format: 'armfight'` bracket holds one synthetic round with N matches in `winnersBracket[0]`. Bo5-specific data lives in the existing opaque `Match.result` field (Phase 3.2 extension point) — no new top-level `BracketData` fields, no DB migration. Three new engine functions (`recordLeg`, `forfeitBout`, `getBoutScore`) own all scoring logic; the API delegates. Per `champion = null` rule, an armfight card has no event-level winner.

**Tech Stack:** TypeScript, Vitest (with `@vitest/coverage-v8`), NestJS, `class-validator`, TypeORM (read-only — no schema changes).

**Spec:** `docs/superpowers/specs/2026-05-20-armfight-rules-design.md` (commit `77dd52f`). Treat the spec as authoritative when this plan is silent; treat this plan as authoritative when the two conflict on implementation detail.

---

## File Structure

**Created:**
- `packages/bracket-engine/vitest.config.ts` — coverage thresholds for `bracket-logic.ts`.
- `apps/api/src/brackets/dto/armfight-pair.dto.ts` — pair sub-DTO used by `GenerateBracketDto.pairs`.
- `apps/api/src/brackets/dto/record-leg.dto.ts` — `POST /:id/legs` body.
- `apps/api/src/brackets/dto/forfeit-bout.dto.ts` — `POST /:id/forfeit` body.

**Modified:**
- `packages/bracket-engine/src/types.ts` — new types (`ArmfightHand`, `LegWinType`, `ArmfightBoutStatus`, `ArmfightLeg`, `ArmfightBoutResult`, `ArmfightPairSpec`, `RecordLegOptions`); widen `Match.result` to permit `ArmfightBoutResult`.
- `packages/bracket-engine/src/bracket-logic.ts` — rewrite `generateArmfight`; add `recordLeg`, `forfeitBout`, `getBoutScore`, `isArmfightBoutResult`; update `finalizeArmfight`, `propagateResults`, `selectWinner`, `isPlayableMatch`, `canRecordResult`, `validateResult`, `resetMatch`, `replacePlayerInSlot`, `withdrawPlayerFromSlot`, `getFinalPlacements` armfight branches.
- `packages/bracket-engine/src/index.ts` — export new symbols.
- `packages/bracket-engine/src/bracket-logic.spec.ts` — rewrite + expand the `describe('generateArmfight', …)` block.
- `packages/shared-types/src/index.ts` — add `'armfight_bo5'` to `MatchResultSchema` union (line 24-29).
- `apps/api/src/brackets/dto/generate-bracket.dto.ts` — add `pairs?: ArmfightPairDto[]`.
- `apps/api/src/brackets/brackets.service.ts` — `buildBracket` armfight branch (use `pairs`), reject armfight via `generateForGroup`, resolve `matchResultSchema = 'armfight_bo5'` for armfight, new service methods `recordLegResult`, `forfeitBoutById`, `listBouts`.
- `apps/api/src/brackets/match-result.validator.ts` — add `'armfight_bo5'` case delegating to engine.
- `apps/api/src/brackets/brackets.controller.ts` — three new endpoints: `POST /:id/legs`, `POST /:id/forfeit`, `GET /:id/bouts`.
- `apps/api/src/brackets/brackets.service.spec.ts` — rewrite existing armfight cases, add new ones.
- `apps/api/src/brackets/match-result.validator.spec.ts` — add `armfight_bo5` cases.

**Not modified (intentionally):**
- TypeORM entities — `Bracket.bracketData` is JSONB; new shape nests inside `Match.result`.
- Admin wizard — pair-builder UI is a follow-up sub-project, not in B.
- `apps/api/src/sports/sport-config.ts` — resolution change goes in `brackets.service.ts` (where format-driven schema override already lives, line 273-).

---

## Task 0: Pre-flight checks (no code; report findings)

**Files:** none modified — produces a Markdown report posted back to the orchestrator.

- [ ] **Step 1: Check for existing production-shape armfight bracket rows**

Run (against any reachable dev/staging DB; skip if no DB credentials present):
```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS armfight_bracket_rows FROM brackets WHERE \"bracketData\"->>'format' = 'armfight';"
```
If no DB is reachable, record this fact in the report and continue. Output: a single integer.

- [ ] **Step 2: Grep for breaking-change consumers of `generateArmfight` and armfight champion logic**

Run each, record the file:line list:
```bash
grep -rn "generateArmfight" packages apps --include='*.ts' --include='*.tsx'
grep -rn "format === 'armfight'\|format == 'armfight'" packages apps --include='*.ts' --include='*.tsx'
grep -rn "armfight.*champion\|champion.*armfight" apps/web/src --include='*.ts' --include='*.tsx'
find apps/web/src/components -type d -name 'bracket*'
```

- [ ] **Step 3: Write the pre-flight report**

Report format (post back to orchestrator, do not commit):
```
# Pre-flight findings

DB armfight rows: N  (or "no DB available")

Consumers of generateArmfight (expected: brackets.service.ts:18 + 345; brackets.service.spec.ts:78,641):
  <file:line list>

Consumers branching on format === 'armfight':
  <file:line list>

Web consumers of armfight champion: none expected
  <file:line list — should be empty>

Web bracket components dir present: yes / no
```
If anything **other than** the expected consumers shows up, **STOP** and surface the surprise to the orchestrator before proceeding to Task 1. The plan is built on the assumption that the consumer surface is what the spec §8.2 lists.

- [ ] **Step 4: No commit** — Task 0 produces no code.

---

## Task 1: Add new armfight types to `types.ts`

**Files:**
- Modify: `packages/bracket-engine/src/types.ts`

- [ ] **Step 1: Append the new types at the end of `types.ts`** (after the existing `BYE_PLAYER` const, line 173)

```ts
// ─── Armfight fight-card (sub-project B) ────────────────────

export type ArmfightHand = 'left' | 'right';
export type LegWinType = 'pin' | 'foul' | 'dq';
export type ArmfightBoutStatus = 'pending' | 'in_progress' | 'completed' | 'walkover';

export interface ArmfightLeg {
  /** 1..5, strictly monotonic. */
  index: number;
  /** Must equal Match.player1.id or Match.player2.id. Never 'bye'/'tbd'. */
  winnerId: string;
  winType: LegWinType;
  enteredBy?: string | null;
  enteredAt?: string | null;
}

export interface ArmfightBoutResult {
  hand: ArmfightHand;
  /** 0..5, append-only until the bout closes. */
  legs: ArmfightLeg[];
  /** Cached count of legs won by Match.player1. Always === legs.filter(l => l.winnerId === player1.id).length. */
  scoreA: number;
  /** Cached count of legs won by Match.player2. */
  scoreB: number;
  status: ArmfightBoutStatus;
  /** Only set when status === 'walkover'. */
  walkoverReason?: string | null;
}

export interface ArmfightPairSpec {
  playerA: Player;
  playerB: Player;
  hand: ArmfightHand;
  /** Optional display order; defaults to array index + 1 during generation. */
  order?: number;
}

export interface RecordLegOptions {
  enteredBy?: string | null;
  enteredAt?: string | null;
}
```

- [ ] **Step 2: Widen `Match.result` to permit the typed armfight payload** — edit `Match.result` declaration (current line 33):

Replace:
```ts
  result?: Record<string, unknown> | null;
```
With:
```ts
  result?: Record<string, unknown> | ArmfightBoutResult | null;
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/bracket-engine && npx tsc --noEmit`
Expected: no errors. (`ArmfightBoutResult` is defined further down in the same file; TypeScript hoists interface declarations.)

- [ ] **Step 4: Commit**

```bash
git add packages/bracket-engine/src/types.ts
git commit -m "$(cat <<'EOF'
feat(bracket): armfight bo5 types — leg / bout / pair specs

Adds ArmfightHand, LegWinType, ArmfightBoutStatus, ArmfightLeg,
ArmfightBoutResult, ArmfightPairSpec, RecordLegOptions. Widens
Match.result to allow ArmfightBoutResult alongside the existing
opaque sport-result shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Coverage thresholds for bracket-engine

**Files:**
- Create: `packages/bracket-engine/vitest.config.ts`

- [ ] **Step 1: Verify no config exists today** (it shouldn't)

Run: `ls packages/bracket-engine/vitest.config.* 2>/dev/null`
Expected: empty.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/bracket-logic.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
```

- [ ] **Step 3: Run baseline coverage to confirm the wiring works**

Run: `cd packages/bracket-engine && npm run test:coverage`
Expected: tests pass; either the gate is already met (the file is heavily tested) — in which case great — or coverage fails with a clear number near 90 that we'll lift in Task 16. **Record the baseline number** in the commit message so we can tell if later changes regress it.

- [ ] **Step 4: Commit**

```bash
git add packages/bracket-engine/vitest.config.ts
git commit -m "$(cat <<'EOF'
chore(bracket): wire 90% coverage thresholds for bracket-logic.ts

Pre-existing test suite already exercises bracket-logic.ts heavily;
this enforces the floor moving forward. Baseline before sub-project
B changes: <fill from step 3 output>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rewrite `generateArmfight` (signature + validations + structure)

The current function (`bracket-logic.ts:485-534`) takes `Player[]` length=2. We replace it with `pairs: ArmfightPairSpec[]`. The existing `describe('generateArmfight', …)` block in the spec (line 2723-2845) is **fully rewritten** under the new shape.

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (lines 485-534)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts` (lines 2723-2845)

- [ ] **Step 1: Write the failing tests — replace the entire `describe('generateArmfight', …)` block**

Open `packages/bracket-engine/src/bracket-logic.spec.ts`, delete lines 2723-2845 (the whole `describe('generateArmfight', …)` block plus its closing `});`), and insert in its place:

```ts
import type { ArmfightPairSpec } from './types';

function makePair(
  a: string,
  b: string,
  hand: 'left' | 'right' = 'right',
  order?: number,
): ArmfightPairSpec {
  return {
    playerA: { id: a, firstName: 'A', lastName: a, number: a },
    playerB: { id: b, firstName: 'B', lastName: b, number: b },
    hand,
    order,
  };
}

describe('generateArmfight — validations', () => {
  it('rejects empty pairs', () => {
    expect(() => generateArmfight([])).toThrow(/at least one pair/i);
  });

  it('rejects a pair where playerA.id === playerB.id', () => {
    expect(() => generateArmfight([makePair('p1', 'p1')])).toThrow(/same player/i);
  });

  it('rejects a pair containing the BYE id', () => {
    expect(() => generateArmfight([makePair('bye', 'p1')])).toThrow(/bye|tbd/i);
    expect(() => generateArmfight([makePair('p1', 'bye')])).toThrow(/bye|tbd/i);
  });

  it('rejects a pair containing the TBD id', () => {
    expect(() => generateArmfight([makePair('tbd', 'p1')])).toThrow(/bye|tbd/i);
  });

  it('rejects the same playerId appearing in two pairs', () => {
    expect(() =>
      generateArmfight([makePair('p1', 'p2'), makePair('p1', 'p3')]),
    ).toThrow(/twice|duplicate/i);
  });

  it('rejects invalid hand', () => {
    const bad = makePair('p1', 'p2');
    (bad as unknown as { hand: string }).hand = 'middle';
    expect(() => generateArmfight([bad])).toThrow(/hand/i);
  });
});

describe('generateArmfight — structure', () => {
  it('single pair → bracketSize=2, wbRounds=1, one match', () => {
    const data = generateArmfight([makePair('p1', 'p2', 'right')]);
    expect(data.format).toBe('armfight');
    expect(data.bracketSize).toBe(2);
    expect(data.wbRounds).toBe(1);
    expect(data.winnersBracket).toHaveLength(1);
    expect(data.winnersBracket[0]).toHaveLength(1);
    expect(data.losersBracket).toEqual([]);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
  });

  it('N pairs → bracketSize=N*2, single round of N matches', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
      makePair('p5', 'p6', 'left'),
    ]);
    expect(data.bracketSize).toBe(6);
    expect(data.wbRounds).toBe(1);
    expect(data.winnersBracket[0]).toHaveLength(3);
  });

  it('match ids follow wb_1_{i} convention', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
    ]);
    expect(data.winnersBracket[0][0].id).toBe('wb_1_0');
    expect(data.winnersBracket[0][1].id).toBe('wb_1_1');
  });

  it('seeds are stable across pairs', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
    ]);
    expect(data.winnersBracket[0][0].player1.seed).toBe(1);
    expect(data.winnersBracket[0][0].player2.seed).toBe(2);
    expect(data.winnersBracket[0][1].player1.seed).toBe(3);
    expect(data.winnersBracket[0][1].player2.seed).toBe(4);
  });

  it('champion is always null (no event-level champion)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(data.champion).toBeNull();
  });

  it('grand_final and super_final are TBD stubs (never played)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(data.grandFinal.player1.id).toBe('tbd');
    expect(data.grandFinal.player2.id).toBe('tbd');
    expect(data.superFinal.needed).toBe(false);
  });

  it('players are de-duplicated in order of first appearance', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
    ]);
    expect(data.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('each Match.result is initialised to a fresh pending ArmfightBoutResult', () => {
    const data = generateArmfight([makePair('p1', 'p2', 'left')]);
    expect(data.winnersBracket[0][0].result).toEqual({
      hand: 'left',
      legs: [],
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    });
  });

  it('preserves player metadata (firstName, lastName, photoUrl)', () => {
    const data = generateArmfight([{
      playerA: { id: 'a', firstName: 'Levon', lastName: 'Hakobyan', number: 7, photoUrl: 'https://x/y.jpg' },
      playerB: { id: 'b', firstName: 'Garik', lastName: 'Petrosyan', number: 12 },
      hand: 'right',
    }]);
    const m = data.winnersBracket[0][0];
    expect(m.player1.firstName).toBe('Levon');
    expect(m.player1.photoUrl).toBe('https://x/y.jpg');
    expect(m.player2.lastName).toBe('Petrosyan');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/bracket-engine && npx vitest run -t "generateArmfight"`
Expected: tests fail — the existing `generateArmfight(players)` signature throws on length≠2 and rejects empty arrays, so most new tests get type errors at the call site (`makePair` is `ArmfightPairSpec`, not `Player`). That's the expected red.

- [ ] **Step 3: Rewrite `generateArmfight` in `bracket-logic.ts`**

Replace lines 469-534 of `bracket-logic.ts` (the `// ─── Armfight ───` comment, the `generateArmfight` function, and the `finalizeArmfight` function — `finalizeArmfight` will be rewritten in Task 8, leave a stub) with:

```ts
// ─── Armfight (fight card — sub-project B) ──────────────────

import type { ArmfightPairSpec, ArmfightBoutResult, ArmfightHand } from './types';

const FRESH_BOUT_RESULT = (hand: ArmfightHand): ArmfightBoutResult => ({
  hand,
  legs: [],
  scoreA: 0,
  scoreB: 0,
  status: 'pending',
});

/**
 * Build an armfight fight card — 1..N independent bouts, each best-of-5 on a
 * single hand. Admin curates the pair list (no auto-pairing). Each bout is a
 * regular `Match` in `winnersBracket[0]`; bo5 score lives in `Match.result`
 * as an `ArmfightBoutResult`. `champion` is always null — a fight card has
 * no event-level winner (decisions §2.1 of the spec).
 *
 * Throws on: empty pairs; self-pair; BYE/TBD in a pair; a player appearing
 * in two pairs; invalid hand.
 */
export function generateArmfight(pairs: ArmfightPairSpec[]): BracketData {
  if (!pairs || pairs.length === 0) {
    throw new Error('generateArmfight: at least one pair is required');
  }

  const seenPlayerIds = new Set<string>();
  pairs.forEach((p, idx) => {
    if (!p.playerA?.id || !p.playerB?.id) {
      throw new Error(`generateArmfight: pair[${idx}] is missing a player`);
    }
    if (p.playerA.id === p.playerB.id) {
      throw new Error(`generateArmfight: pair[${idx}] has the same player on both sides`);
    }
    if (isBye(p.playerA.id) || isTbd(p.playerA.id) || isBye(p.playerB.id) || isTbd(p.playerB.id)) {
      throw new Error(`generateArmfight: pair[${idx}] contains a BYE/TBD slot`);
    }
    if (p.hand !== 'left' && p.hand !== 'right') {
      throw new Error(`generateArmfight: pair[${idx}] has invalid hand '${String(p.hand)}'`);
    }
    if (seenPlayerIds.has(p.playerA.id)) {
      throw new Error(`generateArmfight: player '${p.playerA.id}' appears in two pairs (duplicate)`);
    }
    if (seenPlayerIds.has(p.playerB.id)) {
      throw new Error(`generateArmfight: player '${p.playerB.id}' appears in two pairs (duplicate)`);
    }
    seenPlayerIds.add(p.playerA.id);
    seenPlayerIds.add(p.playerB.id);
  });

  // Build matches in pair order; ids follow the engine-wide wb_{round}_{idx} scheme.
  const matches: Match[] = pairs.map((p, i) => ({
    id: `wb_1_${i}`,
    round: 1,
    matchIndex: i,
    player1: { ...p.playerA, seed: i * 2 + 1 },
    player2: { ...p.playerB, seed: i * 2 + 2 },
    winner: null,
    loser: null,
    result: FRESH_BOUT_RESULT(p.hand),
  }));

  const grandFinal: GrandFinalMatch = {
    id: 'grand_final',
    player1: makeTbd(),
    player2: makeTbd(),
    winner: null,
    loser: null,
  };
  const superFinal: SuperFinalMatch = {
    id: 'super_final',
    player1: makeTbd(),
    player2: makeTbd(),
    winner: null,
    loser: null,
    needed: false,
  };

  // Dedup players preserving order of first appearance.
  const players: Player[] = [];
  const seenInOutput = new Set<string>();
  for (const p of pairs) {
    for (const pl of [p.playerA, p.playerB]) {
      if (!seenInOutput.has(pl.id)) {
        seenInOutput.add(pl.id);
        players.push({ id: pl.id, firstName: pl.firstName, lastName: pl.lastName, number: pl.number });
      }
    }
  }

  return {
    format: 'armfight',
    players,
    bracketSize: pairs.length * 2,
    wbRounds: 1,
    winnersBracket: [matches],
    losersBracket: [],
    grandFinal,
    superFinal,
    champion: null,
    status: 'active',
  };
}

/**
 * Finalize an armfight card — bracket completes when every bout is
 * `completed` or `walkover`. `champion` always stays null.
 * Detailed multi-pair implementation lands in Task 8; this stub keeps the
 * single-pair case passing until then.
 */
function finalizeArmfight(data: BracketData): void {
  if (data.format !== 'armfight') return;
  const round = data.winnersBracket[0] ?? [];
  const allDone = round.every((m) => {
    const r = m.result as ArmfightBoutResult | null | undefined;
    return r?.status === 'completed' || r?.status === 'walkover';
  });
  if (allDone && round.length > 0) data.status = 'completed';
  // champion intentionally not set — fight card has no event-level champion.
}
```

(Note: this Task 3 implementation **does** finalize the bracket when bouts close. Task 8 will keep the same logic — separating "score reached 3" propagation from finalization. No further `finalizeArmfight` rewrite is needed.)

- [ ] **Step 4: Update `brackets.service.ts` call site so the package still type-checks**

The current `brackets.service.ts:340-345` calls `generateArmfight(players)`. That signature is gone. Temporarily, until Task 19 wires the new shape end-to-end, change the call to throw:

```ts
    if (format === 'armfight') {
      // The 2-player path is removed in sub-project B. Wizard must POST
      // pairs explicitly via the dedicated path (Task 19 wires this).
      throw new BadRequestException(
        'Armfight bracket requires explicit pairs[]; use POST /v1/brackets with pairs[].',
      );
    }
```

Keep the `generateArmfight` import for now — Task 19 will use it.

- [ ] **Step 5: Run engine tests to verify generator-block goes green**

Run: `cd packages/bracket-engine && npx vitest run -t "generateArmfight —"`
Expected: PASS for both `generateArmfight — validations` and `generateArmfight — structure` blocks. Some legacy armfight tests outside this block (in the old `describe('generateArmfight', …)` that we deleted) are gone, so no other armfight failures.

Also run the full engine suite: `cd packages/bracket-engine && npx vitest run`
Expected: PASS. Other formats' tests untouched.

- [ ] **Step 6: API typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS — we replaced the only `generateArmfight(players)` call site with a throw.

- [ ] **Step 7: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts apps/api/src/brackets/brackets.service.ts
git commit -m "$(cat <<'EOF'
feat(bracket): generateArmfight accepts N admin-curated pairs (BREAKING)

Replaces the 2-player-only signature with `ArmfightPairSpec[]`. Each pair
becomes one Match in winnersBracket[0]; Match.result is initialised to a
fresh ArmfightBoutResult per pair. champion always null (fight card has no
event-level winner). Rejects empty pairs, self-pair, BYE/TBD slots,
duplicate players, invalid hand.

API: armfight via generateForGroup / 2-player path now throws — Task 19
wires the new pairs[] DTO path end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `isArmfightBoutResult` type guard

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts`
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `bracket-logic.spec.ts` (at the end of the file, before the final closing — keep it together with other armfight blocks):

```ts
describe('isArmfightBoutResult', () => {
  it('true for a freshly-initialised bout result', () => {
    expect(
      isArmfightBoutResult({ hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' }),
    ).toBe(true);
  });

  it('true for a bout with legs', () => {
    expect(
      isArmfightBoutResult({
        hand: 'left',
        legs: [{ index: 1, winnerId: 'p1', winType: 'pin' }],
        scoreA: 1,
        scoreB: 0,
        status: 'in_progress',
      }),
    ).toBe(true);
  });

  it('false for null / undefined / primitives', () => {
    expect(isArmfightBoutResult(null)).toBe(false);
    expect(isArmfightBoutResult(undefined)).toBe(false);
    expect(isArmfightBoutResult(42)).toBe(false);
    expect(isArmfightBoutResult('armfight')).toBe(false);
  });

  it('false for an unrelated sport-result blob (no hand / wrong shape)', () => {
    expect(isArmfightBoutResult({ schema: 'armwrestling', victoryType: 'pin' })).toBe(false);
    expect(isArmfightBoutResult({ hand: 'right' })).toBe(false); // missing legs/score/status
    expect(isArmfightBoutResult({ hand: 'middle', legs: [], scoreA: 0, scoreB: 0, status: 'pending' })).toBe(false);
    expect(isArmfightBoutResult({ hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'wat' })).toBe(false);
  });
});
```

Add `isArmfightBoutResult` to the import list at the top of the spec file.

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/bracket-engine && npx vitest run -t "isArmfightBoutResult"`
Expected: FAIL — `isArmfightBoutResult` not exported.

- [ ] **Step 3: Implement**

In `bracket-logic.ts`, in the armfight section (after the new `generateArmfight` and before `finalizeArmfight`):

```ts
const HANDS = new Set<string>(['left', 'right']);
const STATUSES = new Set<string>(['pending', 'in_progress', 'completed', 'walkover']);

/** Narrows an unknown blob to an `ArmfightBoutResult`. Pure / no mutation. */
export function isArmfightBoutResult(x: unknown): x is ArmfightBoutResult {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (typeof r.hand !== 'string' || !HANDS.has(r.hand)) return false;
  if (!Array.isArray(r.legs)) return false;
  if (typeof r.scoreA !== 'number' || typeof r.scoreB !== 'number') return false;
  if (typeof r.status !== 'string' || !STATUSES.has(r.status)) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/bracket-engine && npx vitest run -t "isArmfightBoutResult"`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): isArmfightBoutResult type guard

Narrows unknown blobs to ArmfightBoutResult by checking hand / legs / score
/ status shape. Used by validateResult, the API match-result validator,
and engine guards in subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `recordLeg`

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts`
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to the armfight section of `bracket-logic.spec.ts`:

```ts
describe('recordLeg — validations', () => {
  it('throws when bout not found', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => recordLeg(data, 'wb_1_99', 1, 'p1', 'pin')).toThrow(/not found/i);
  });

  it('throws when data.format !== "armfight"', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p1', 'pin')).toThrow(/armfight/i);
  });

  it('throws when winnerId is not one of the two players in the bout', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p99', 'pin')).toThrow(/winner/i);
  });

  it('throws when legIndex is out of order', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => recordLeg(data, 'wb_1_0', 2, 'p1', 'pin')).toThrow(/legIndex/i);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p1', 'pin')).toThrow(/legIndex/i);
    expect(() => recordLeg(data, 'wb_1_0', 3, 'p1', 'pin')).toThrow(/legIndex/i);
  });

  it('throws when winType is invalid', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() =>
      recordLeg(data, 'wb_1_0', 1, 'p1', 'sneeze' as unknown as 'pin'),
    ).toThrow(/winType/i);
  });

  it('rejects appending a leg to a completed bout', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin'); // 3-0 → completed
    expect(() => recordLeg(data, 'wb_1_0', 4, 'p1', 'pin')).toThrow(/closed|completed/i);
  });
});

describe('recordLeg — behaviour', () => {
  it('leg 1 → status in_progress, scoreA = 1', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('in_progress');
    expect(r.scoreA).toBe(1);
    expect(r.scoreB).toBe(0);
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]).toMatchObject({ index: 1, winnerId: 'p1', winType: 'pin' });
  });

  it('3-0 path → status completed, match.winner = A, match.loser = B', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    const m = data.winnersBracket[0][0];
    expect((m.result as ArmfightBoutResult).status).toBe('completed');
    expect(m.winner).toBe('p1');
    expect(m.loser).toBe('p2');
  });

  it('3-1 path (4 legs)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p1', 'pin');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('completed');
    expect(r.scoreA).toBe(3);
    expect(r.scoreB).toBe(1);
    expect(r.legs).toHaveLength(4);
  });

  it('3-2 path (full 5 legs)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 5, 'p1', 'pin');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('completed');
    expect(r.legs).toHaveLength(5);
    expect(data.winnersBracket[0][0].winner).toBe('p1');
  });

  it('player B wins 2-3', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 5, 'p2', 'pin');
    expect(data.winnersBracket[0][0].winner).toBe('p2');
  });

  it('all three winType values are accepted', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'foul');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'dq');
    const types = (data.winnersBracket[0][0].result as ArmfightBoutResult).legs.map((l) => l.winType);
    expect(types).toEqual(['pin', 'foul', 'dq']);
  });

  it('writes enteredBy / enteredAt when supplied', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin', { enteredBy: 'ref-1', enteredAt: '2026-05-20T12:00:00Z' });
    const leg = (data.winnersBracket[0][0].result as ArmfightBoutResult).legs[0];
    expect(leg.enteredBy).toBe('ref-1');
    expect(leg.enteredAt).toBe('2026-05-20T12:00:00Z');
  });
});
```

Add `recordLeg` to imports.

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/bracket-engine && npx vitest run -t "recordLeg"`
Expected: FAIL — `recordLeg` not exported.

- [ ] **Step 3: Implement**

Add to `bracket-logic.ts` in the armfight section, after `isArmfightBoutResult`:

```ts
const WIN_TYPES = new Set<string>(['pin', 'foul', 'dq']);

/**
 * Append a leg result to a pending / in_progress armfight bout. Mutates
 * `data` in place. Decides the bout when a side reaches 3 leg wins —
 * sets match.winner/loser and result.status accordingly.
 *
 * Throws on:
 *   - bout not found
 *   - data.format !== 'armfight'
 *   - bout already completed or walkover
 *   - winnerId not in {player1.id, player2.id}
 *   - legIndex !== legs.length + 1
 *   - winType not in {'pin','foul','dq'}
 *   - legIndex > 5
 */
export function recordLeg(
  data: BracketData,
  boutId: string,
  legIndex: number,
  winnerId: string,
  winType: LegWinType,
  options?: RecordLegOptions,
): void {
  if (data.format !== 'armfight') {
    throw new Error('recordLeg: only valid on armfight brackets');
  }
  const match = (data.winnersBracket[0] ?? []).find((m) => m.id === boutId);
  if (!match) throw new Error(`recordLeg: bout '${boutId}' not found`);

  const r = match.result as ArmfightBoutResult | null | undefined;
  if (!isArmfightBoutResult(r)) {
    throw new Error(`recordLeg: bout '${boutId}' has no armfight result payload`);
  }
  if (r.status === 'completed' || r.status === 'walkover') {
    throw new Error(`recordLeg: bout '${boutId}' is closed (status=${r.status})`);
  }
  if (winnerId !== match.player1.id && winnerId !== match.player2.id) {
    throw new Error(`recordLeg: winnerId '${winnerId}' is not a player in this bout`);
  }
  if (!WIN_TYPES.has(winType)) {
    throw new Error(`recordLeg: invalid winType '${String(winType)}'`);
  }
  if (legIndex !== r.legs.length + 1) {
    throw new Error(`recordLeg: legIndex ${legIndex} is out of order (expected ${r.legs.length + 1})`);
  }
  if (legIndex > 5) {
    throw new Error('recordLeg: bo5 has at most 5 legs');
  }

  r.legs.push({
    index: legIndex,
    winnerId,
    winType,
    enteredBy: options?.enteredBy ?? null,
    enteredAt: options?.enteredAt ?? new Date().toISOString(),
  });
  if (winnerId === match.player1.id) r.scoreA += 1;
  else r.scoreB += 1;

  if (r.scoreA === 3 || r.scoreB === 3) {
    r.status = 'completed';
    match.winner = r.scoreA === 3 ? match.player1.id : match.player2.id;
    match.loser = r.scoreA === 3 ? match.player2.id : match.player1.id;
  } else {
    r.status = 'in_progress';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/bracket-engine && npx vitest run -t "recordLeg"`
Expected: PASS — all validation + behaviour tests.

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): recordLeg — append leg results to an armfight bout

First to 3 leg wins closes the bout; updates Match.winner/loser and
result.status. Strict validation: monotonic legIndex 1..5, winnerId in
{player1, player2}, winType ∈ {pin, foul, dq}, no recording on closed
bouts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `forfeitBout`

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts`
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to spec, in the armfight block:

```ts
describe('forfeitBout', () => {
  it('walks over a pristine bout — winner set, status walkover', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1', { walkoverReason: 'injury' });
    const m = data.winnersBracket[0][0];
    const r = m.result as ArmfightBoutResult;
    expect(r.status).toBe('walkover');
    expect(r.walkoverReason).toBe('injury');
    expect(m.winner).toBe('p1');
    expect(m.loser).toBe('p2');
    expect(r.legs).toHaveLength(0);
  });

  it('walks over a mid-bout — existing legs preserved', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    forfeitBout(data, 'wb_1_0', 'p1');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('walkover');
    expect(r.legs).toHaveLength(2);
    expect(r.scoreA).toBe(1);
    expect(r.scoreB).toBe(1);
    expect(data.winnersBracket[0][0].winner).toBe('p1');
  });

  it('throws when bout is already completed', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(() => forfeitBout(data, 'wb_1_0', 'p2')).toThrow(/closed|completed/i);
  });

  it('throws when bout is already walkover (double-forfeit)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1');
    expect(() => forfeitBout(data, 'wb_1_0', 'p2')).toThrow(/walkover|closed/i);
  });

  it('throws when winnerId is not in the pair', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => forfeitBout(data, 'wb_1_0', 'p99')).toThrow(/winner/i);
  });

  it('throws on non-armfight bracket', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(() => forfeitBout(data, 'wb_1_0', 'p1')).toThrow(/armfight/i);
  });

  it('throws when bout not found', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => forfeitBout(data, 'wb_1_99', 'p1')).toThrow(/not found/i);
  });
});
```

Add `forfeitBout` to imports.

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/bracket-engine && npx vitest run -t "forfeitBout"`
Expected: FAIL.

- [ ] **Step 3: Implement** — add after `recordLeg`:

```ts
/**
 * Close an armfight bout as walkover. Sets match.winner/loser and
 * result.status='walkover'. Existing legs are preserved; no further legs
 * can be appended. Throws on closed bouts, missing bout, non-armfight
 * brackets, or a winnerId not in the pair.
 */
export function forfeitBout(
  data: BracketData,
  boutId: string,
  winnerId: string,
  options?: { walkoverReason?: string; enteredBy?: string | null },
): void {
  if (data.format !== 'armfight') {
    throw new Error('forfeitBout: only valid on armfight brackets');
  }
  const match = (data.winnersBracket[0] ?? []).find((m) => m.id === boutId);
  if (!match) throw new Error(`forfeitBout: bout '${boutId}' not found`);

  const r = match.result as ArmfightBoutResult | null | undefined;
  if (!isArmfightBoutResult(r)) {
    throw new Error(`forfeitBout: bout '${boutId}' has no armfight result payload`);
  }
  if (r.status === 'completed' || r.status === 'walkover') {
    throw new Error(`forfeitBout: bout '${boutId}' is closed (status=${r.status})`);
  }
  if (winnerId !== match.player1.id && winnerId !== match.player2.id) {
    throw new Error(`forfeitBout: winnerId '${winnerId}' is not a player in this bout`);
  }

  r.status = 'walkover';
  if (options?.walkoverReason !== undefined) r.walkoverReason = options.walkoverReason;
  match.winner = winnerId;
  match.loser = winnerId === match.player1.id ? match.player2.id : match.player1.id;
  if (options?.enteredBy) {
    match.enteredBy = options.enteredBy;
    match.enteredAt = new Date().toISOString();
  }
}
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "forfeitBout"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): forfeitBout — close armfight bout as walkover

Sets match.winner/loser, result.status='walkover', preserves existing
legs. Rejects closed bouts, missing bouts, non-armfight brackets, and
winnerIds outside the pair.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `getBoutScore`

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts`
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('getBoutScore', () => {
  it('pending bout → 0-0, no leader', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(getBoutScore(data, 'wb_1_0')).toEqual({ a: 0, b: 0, status: 'pending', leadingId: null });
  });

  it('in_progress 2-1 → leadingId=p1', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(getBoutScore(data, 'wb_1_0')).toEqual({ a: 2, b: 1, status: 'in_progress', leadingId: 'p1' });
  });

  it('tied 2-2 → leadingId=null', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p2', 'pin');
    expect(getBoutScore(data, 'wb_1_0')).toEqual({ a: 2, b: 2, status: 'in_progress', leadingId: null });
  });

  it('completed 3-0 → leadingId=winner', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(getBoutScore(data, 'wb_1_0')).toEqual({ a: 3, b: 0, status: 'completed', leadingId: 'p1' });
  });

  it('walkover mid-bout → leadingId=walkover winner regardless of leg score', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    forfeitBout(data, 'wb_1_0', 'p2');
    expect(getBoutScore(data, 'wb_1_0')).toEqual({ a: 1, b: 1, status: 'walkover', leadingId: 'p2' });
  });

  it('throws on non-armfight bracket', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(() => getBoutScore(data, 'wb_1_0')).toThrow(/armfight/i);
  });

  it('throws when bout not found', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => getBoutScore(data, 'wb_1_99')).toThrow(/not found/i);
  });
});
```

Add `getBoutScore` to imports.

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "getBoutScore"`
Expected: FAIL.

- [ ] **Step 3: Implement** — append:

```ts
/**
 * Pure helper: read derived state of an armfight bout. Does not mutate.
 * `leadingId` is the winning side (the player with the higher score) for
 * pending/in_progress, the bout winner for completed/walkover, and null
 * when the scores are tied and the bout is not yet closed.
 */
export function getBoutScore(
  data: BracketData,
  boutId: string,
): { a: number; b: number; status: ArmfightBoutStatus; leadingId: string | null } {
  if (data.format !== 'armfight') {
    throw new Error('getBoutScore: only valid on armfight brackets');
  }
  const match = (data.winnersBracket[0] ?? []).find((m) => m.id === boutId);
  if (!match) throw new Error(`getBoutScore: bout '${boutId}' not found`);
  const r = match.result as ArmfightBoutResult | null | undefined;
  if (!isArmfightBoutResult(r)) {
    throw new Error(`getBoutScore: bout '${boutId}' has no armfight result payload`);
  }
  let leadingId: string | null = null;
  if (r.status === 'completed' || r.status === 'walkover') {
    leadingId = match.winner;
  } else if (r.scoreA > r.scoreB) {
    leadingId = match.player1.id;
  } else if (r.scoreB > r.scoreA) {
    leadingId = match.player2.id;
  }
  return { a: r.scoreA, b: r.scoreB, status: r.status, leadingId };
}
```

(`ArmfightBoutStatus` is imported at the top of bracket-logic.ts via `import type { … }`. If TypeScript flags it as missing, add it to the existing `import type` line that already brings in `ArmfightPairSpec` etc. — see Task 3 Step 3.)

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "getBoutScore"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): getBoutScore — derive bout score / status / leader

Pure helper that reads a bout's result without mutation. Drives the
GET /v1/brackets/:id/bouts response shape (Task 23).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `propagateResults` armfight branch + `finalizeArmfight` (multi-pair)

The Task 3 `finalizeArmfight` stub already iterates all bouts. This task adds tests proving the **multi-pair** finalize behaviour and tightens `propagateResults`. (`recordLeg` already sets `match.winner` inline; `propagateResults` is mostly defensive — it covers brackets persisted with a `completed` result.status but a null `match.winner` after an external rehydrate.)

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (lines 1888-1892 — armfight branch in `propagateResults`)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('finalizeArmfight (via propagateResults)', () => {
  it('multi-pair: bracket stays active while any bout is pending/in_progress', () => {
    const data = generateArmfight([makePair('p1','p2'), makePair('p3','p4'), makePair('p5','p6')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin'); // bout 0 done
    propagateResults(data);
    expect(data.status).toBe('active');
    expect(data.champion).toBeNull();
  });

  it('multi-pair: bracket completes only when every bout is completed or walkover', () => {
    const data = generateArmfight([makePair('p1','p2'), makePair('p3','p4'), makePair('p5','p6')]);
    // bout 0: 3-0
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    // bout 1: walkover
    forfeitBout(data, 'wb_1_1', 'p3');
    // bout 2: 3-2
    recordLeg(data, 'wb_1_2', 1, 'p5', 'pin');
    recordLeg(data, 'wb_1_2', 2, 'p6', 'pin');
    recordLeg(data, 'wb_1_2', 3, 'p5', 'pin');
    recordLeg(data, 'wb_1_2', 4, 'p6', 'pin');
    recordLeg(data, 'wb_1_2', 5, 'p5', 'pin');
    propagateResults(data);
    expect(data.status).toBe('completed');
    expect(data.champion).toBeNull(); // no event-level champion
  });

  it('propagate is defensive: completed result.status with null match.winner gets reconciled', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    // Simulate an externally-rehydrated bout: result completed but
    // winner not yet propagated to match.winner.
    const m = data.winnersBracket[0][0];
    m.result = { hand: 'right', legs: [
      { index: 1, winnerId: 'p1', winType: 'pin' },
      { index: 2, winnerId: 'p1', winType: 'pin' },
      { index: 3, winnerId: 'p1', winType: 'pin' },
    ], scoreA: 3, scoreB: 0, status: 'completed' };
    m.winner = null;
    m.loser = null;
    propagateResults(data);
    expect(m.winner).toBe('p1');
    expect(m.loser).toBe('p2');
    expect(data.status).toBe('completed');
  });
});
```

Add `propagateResults` to imports.

- [ ] **Step 2: Run to verify fail / pass mix**

Run: `cd packages/bracket-engine && npx vitest run -t "finalizeArmfight"`
Expected: the multi-pair test and walkover-mix test PASS already (Task 3 stub covers them). The "defensive propagate" test **FAILS** — the current armfight branch in `propagateResults` just calls `finalizeArmfight`, which doesn't reconcile winner from result.

- [ ] **Step 3: Tighten `propagateResults` armfight branch**

Find lines 1888-1892 in `bracket-logic.ts`:
```ts
  // Armfight: a single match decides everything. No bracket propagation.
  if (data.format === 'armfight') {
    finalizeArmfight(data);
    return;
  }
```
Replace with:
```ts
  // Armfight (fight card): each bout is independent. Reconcile any bout
  // whose result is closed but whose match.winner is still null (e.g.
  // after rehydration from persisted JSONB), then finalize.
  if (data.format === 'armfight') {
    const round = data.winnersBracket[0] ?? [];
    for (const m of round) {
      const r = m.result as ArmfightBoutResult | null | undefined;
      if (!isArmfightBoutResult(r)) continue;
      if ((r.status === 'completed' || r.status === 'walkover') && m.winner == null) {
        if (r.scoreA > r.scoreB) {
          m.winner = m.player1.id;
          m.loser = m.player2.id;
        } else if (r.scoreB > r.scoreA) {
          m.winner = m.player2.id;
          m.loser = m.player1.id;
        }
        // Tied score + status === 'walkover' would need an explicit
        // winnerId persisted somewhere; not produced by recordLeg/
        // forfeitBout so we leave it untouched.
      }
    }
    finalizeArmfight(data);
    return;
  }
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "finalizeArmfight"`
Expected: PASS — all three cases.

Also run: `cd packages/bracket-engine && npx vitest run`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): propagateResults reconciles armfight bouts post-rehydrate

When a persisted bout has result.status closed but match.winner null
(e.g. after JSONB rehydration before any new operation), propagate
sets winner/loser from result. finalizeArmfight then closes the
bracket once every bout is completed or walkover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `getFinalPlacements` for armfight returns `[]`

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (lines 1391-1403)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('getFinalPlacements — armfight', () => {
  it('returns [] for an active armfight (no bouts decided)', () => {
    const data = generateArmfight([makePair('p1', 'p2'), makePair('p3', 'p4')]);
    expect(getFinalPlacements(data)).toEqual([]);
  });

  it('returns [] for a fully completed armfight card (no event-level ranking)', () => {
    // Deliberate change from the legacy behaviour where a 1-pair armfight
    // returned champion=1 / runner-up=2. A fight card has no ranking —
    // bouts are independent (decision §2.1).
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    propagateResults(data);
    expect(data.status).toBe('completed');
    expect(getFinalPlacements(data)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "getFinalPlacements — armfight"`
Expected: FAIL — the current branch (line 1391-1403) returns 1st + 2nd for a completed single-pair armfight.

- [ ] **Step 3: Replace the armfight case in `getFinalPlacements`**

Find lines 1391-1403 in `bracket-logic.ts`:
```ts
    case 'armfight': {
      // One match: champion = winner, runner-up = loser. Either or both
      // may be null while the bout is still pending.
      const out: FinalPlacement[] = [];
      const match = data.winnersBracket[0]?.[0];
      if (data.champion && isReal(data.champion)) {
        out.push({ playerId: data.champion, position: 1 });
      }
      if (match?.loser && isReal(match.loser)) {
        out.push({ playerId: match.loser, position: out.length + 1 });
      }
      return out;
    }
```
Replace with:
```ts
    case 'armfight': {
      // Fight card has no event-level ranking — bouts are independent
      // (sub-project B decision §2.1). Per-pair winners live on each
      // Match.winner; consumers that want them iterate winnersBracket[0]
      // directly.
      return [];
    }
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "getFinalPlacements"`
Expected: PASS — armfight returns [], all other format placement tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket)!: getFinalPlacements returns [] for armfight (BREAKING)

A fight card has no event-level ranking — bouts are independent. The
legacy single-pair behaviour (1st = winner, 2nd = loser) is removed.
Per-pair winners remain on each Match.winner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `isPlayableMatch` + `canRecordResult` armfight branches

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (`isPlayableMatch` line 135, `canRecordResult` line 2064)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
describe('isPlayableMatch — armfight', () => {
  it('pending bout is playable', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(isPlayableMatch(data.winnersBracket[0][0])).toBe(true);
  });

  it('in_progress bout is still playable (more legs to record)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    expect(isPlayableMatch(data.winnersBracket[0][0])).toBe(true);
  });

  it('completed bout is not playable', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(isPlayableMatch(data.winnersBracket[0][0])).toBe(false);
  });

  it('walkover bout is not playable', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1');
    expect(isPlayableMatch(data.winnersBracket[0][0])).toBe(false);
  });
});

describe('canRecordResult — armfight', () => {
  it('valid for pending and in_progress', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(canRecordResult(data, 'wb_1_0').valid).toBe(true);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    expect(canRecordResult(data, 'wb_1_0').valid).toBe(true);
  });

  it('invalid for completed', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(canRecordResult(data, 'wb_1_0').valid).toBe(false);
  });

  it('invalid for walkover', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1');
    expect(canRecordResult(data, 'wb_1_0').valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "isPlayableMatch — armfight|canRecordResult — armfight"`
Expected: at least the "in_progress is still playable" and "completed/walkover invalid for canRecordResult" cases FAIL — the current implementations gate on `match.winner` only / don't know about armfight statuses.

- [ ] **Step 3: Add an armfight branch at the top of `isPlayableMatch` (line 135-142)**

Replace:
```ts
export function isPlayableMatch(
  match: Match | GrandFinalMatch | SuperFinalMatch,
): boolean {
  if (match.winner) return false;
  const p1 = match.player1?.id;
  const p2 = match.player2?.id;
  return !!(p1 && p2 && isReal(p1) && isReal(p2));
}
```
With:
```ts
export function isPlayableMatch(
  match: Match | GrandFinalMatch | SuperFinalMatch,
): boolean {
  // Armfight bouts: gate on result.status, not on match.winner — a bout
  // with 1-2 legs already recorded has no winner yet but is still in
  // progress and accepts more legs.
  const maybeArmfight = (match as Match).result;
  if (isArmfightBoutResult(maybeArmfight)) {
    return maybeArmfight.status === 'pending' || maybeArmfight.status === 'in_progress';
  }
  if (match.winner) return false;
  const p1 = match.player1?.id;
  const p2 = match.player2?.id;
  return !!(p1 && p2 && isReal(p1) && isReal(p2));
}
```

- [ ] **Step 4: Add an armfight branch at the top of `canRecordResult` (line 2064)**

Replace:
```ts
export function canRecordResult(data: BracketData, matchId: string): ValidationResult {
  const errors: string[] = [];
  const match = findMatch(data, matchId);

  if (!match) {
    return { valid: false, errors: ['Match not found'] };
  }

  if (isTbd(match.player1.id) || isTbd(match.player2.id)) {
    errors.push('Previous matches have not been completed yet');
  }
  if (isBye(match.player1.id) && isBye(match.player2.id)) {
    errors.push('Both players are BYE — match auto-resolved');
  }

  return { valid: errors.length === 0, errors };
}
```
With:
```ts
export function canRecordResult(data: BracketData, matchId: string): ValidationResult {
  const errors: string[] = [];
  const match = findMatch(data, matchId);

  if (!match) {
    return { valid: false, errors: ['Match not found'] };
  }

  // Armfight: status-driven, not winner-driven.
  if (data.format === 'armfight') {
    const r = (match as Match).result;
    if (!isArmfightBoutResult(r)) {
      return { valid: false, errors: ['Match has no armfight result payload'] };
    }
    if (r.status === 'completed' || r.status === 'walkover') {
      return { valid: false, errors: [`Bout is closed (status=${r.status})`] };
    }
    return { valid: true, errors: [] };
  }

  if (isTbd(match.player1.id) || isTbd(match.player2.id)) {
    errors.push('Previous matches have not been completed yet');
  }
  if (isBye(match.player1.id) && isBye(match.player2.id)) {
    errors.push('Both players are BYE — match auto-resolved');
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 5: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "isPlayableMatch|canRecordResult"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): armfight branches for isPlayableMatch and canRecordResult

Both functions now drive off result.status for armfight bouts: in_progress
bouts (with legs but no winner yet) are playable; completed/walkover are
not.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `selectWinner` armfight guard

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (`selectWinner` at line 2378)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('selectWinner — armfight guard', () => {
  it('throws: armfight bouts must be decided via recordLeg/forfeitBout', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => selectWinner(data, 'wb_1_0', 'p1')).toThrow(/recordLeg|forfeitBout/i);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "selectWinner — armfight"`
Expected: FAIL — `selectWinner` happily sets winner on any match.

- [ ] **Step 3: Add the guard at the top of `selectWinner` (right after the `findMatch` call, line 2393-2394)**

In `bracket-logic.ts`, just after:
```ts
  const match = findMatch(data, matchId);
  if (!match) return data;
```
Insert:
```ts
  if (data.format === 'armfight') {
    throw new Error(
      'selectWinner: armfight bouts must be decided via recordLeg / forfeitBout',
    );
  }
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "selectWinner"`
Expected: PASS (the new armfight-guard test, and all existing selectWinner tests for other formats).

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket)!: selectWinner refuses armfight bouts

Forces all armfight scoring through recordLeg / forfeitBout — the only
APIs that produce a valid ArmfightBoutResult. Direct selectWinner calls
on an armfight match throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `validateResult` armfight branch

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (`validateResult` at line 2037)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('validateResult — armfight', () => {
  it('valid for an in_progress bout with consistent score', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    expect(validateResult(data, 'wb_1_0', 'p1').valid).toBe(true);
  });

  it('rejects score/leg inconsistency', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    // Hand-corrupt result.
    const m = data.winnersBracket[0][0];
    (m.result as ArmfightBoutResult).scoreA = 5;
    const result = validateResult(data, 'wb_1_0', 'p1');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/score/i);
  });

  it('rejects status mismatch (status completed but no side at 3)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    const m = data.winnersBracket[0][0];
    (m.result as ArmfightBoutResult).status = 'completed';
    const result = validateResult(data, 'wb_1_0', 'p1');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/status|completed/i);
  });

  it('rejects when result is not an ArmfightBoutResult', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    const m = data.winnersBracket[0][0];
    m.result = null;
    const result = validateResult(data, 'wb_1_0', 'p1');
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "validateResult — armfight"`
Expected: FAIL — the current `validateResult` doesn't know about armfight result invariants.

- [ ] **Step 3: Add an armfight branch at the top of `validateResult`**

Find lines 2037-2060 in `bracket-logic.ts`. Replace the body with:
```ts
export function validateResult(
  data: BracketData,
  matchId: string,
  winnerId: string,
): ValidationResult {
  const errors: string[] = [];
  const match = findMatch(data, matchId);

  if (!match) {
    return { valid: false, errors: ['Match not found'] };
  }

  // Armfight: tighter shape rules — payload must be an ArmfightBoutResult
  // and its derived counts must agree with `legs`.
  if (data.format === 'armfight') {
    const r = (match as Match).result;
    if (!isArmfightBoutResult(r)) {
      return { valid: false, errors: ['Armfight result payload missing or malformed'] };
    }
    if (r.scoreA + r.scoreB !== r.legs.length) {
      errors.push('Armfight score does not match legs.length');
    }
    const decided = r.scoreA === 3 || r.scoreB === 3;
    if (decided && r.status !== 'completed' && r.status !== 'walkover') {
      errors.push('Armfight bout reached 3 legs but status is not completed');
    }
    if (!decided && r.status === 'completed') {
      errors.push('Armfight status is completed but neither side has 3 legs');
    }
    return { valid: errors.length === 0, errors };
  }

  if (isTbd(match.player1.id) || isTbd(match.player2.id)) {
    errors.push('Cannot record result: match is not ready yet (TBD players)');
  }
  if (isBye(match.player1.id) || isBye(match.player2.id)) {
    errors.push('Cannot record result: match contains BYE slot');
  }
  if (match.player1.id !== winnerId && match.player2.id !== winnerId) {
    errors.push('Winner must be one of the two players in this match');
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "validateResult"`
Expected: PASS (armfight cases + the existing non-armfight cases unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): validateResult — armfight shape and score invariants

Requires Match.result to be an ArmfightBoutResult, that scoreA + scoreB
equals legs.length, and that the bout's status reflects whether either
side reached 3 legs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `resetMatch` armfight branch

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (`resetMatch` body starts at line 2088)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
describe('resetMatch — armfight', () => {
  it('clears legs, score, and status; preserves hand', () => {
    const data = generateArmfight([makePair('p1', 'p2', 'left')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(data.status).toBe('completed');
    const out = resetMatch(data, 'wb_1_0');
    const m = out.winnersBracket[0][0];
    const r = m.result as ArmfightBoutResult;
    expect(r.hand).toBe('left');
    expect(r.legs).toEqual([]);
    expect(r.scoreA).toBe(0);
    expect(r.scoreB).toBe(0);
    expect(r.status).toBe('pending');
    expect(m.winner).toBeNull();
    expect(m.loser).toBeNull();
    expect(out.status).toBe('active');
  });

  it('reset of one bout leaves other bouts on the card untouched', () => {
    const data = generateArmfight([makePair('p1','p2'), makePair('p3','p4')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_1', 1, 'p3', 'pin');
    resetMatch(data, 'wb_1_0');
    expect((data.winnersBracket[0][1].result as ArmfightBoutResult).legs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "resetMatch — armfight"`
Expected: FAIL — the current `resetMatch` calls `_clearDownstream` for unknown formats, which doesn't restore the fresh `ArmfightBoutResult`.

- [ ] **Step 3: Add an armfight branch in `resetMatch`** — right after the `findMatch` lookup + bye check (line 2097), before the `data.format === 'round_robin'` branch (line 2119):

```ts
  if (data.format === 'armfight') {
    const m = (match as Match);
    const r = m.result as ArmfightBoutResult | null | undefined;
    const hand: ArmfightHand =
      isArmfightBoutResult(r) ? r.hand : 'right';
    m.winner = null;
    m.loser = null;
    m.enteredBy = null;
    m.enteredAt = null;
    m.correctedBy = null;
    m.correctedAt = null;
    m.result = { hand, legs: [], scoreA: 0, scoreB: 0, status: 'pending' };
    // Card may have been completed; reopen.
    data.status = 'active';
    // champion is always null for armfight — no further work.
    return data;
  }
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "resetMatch"`
Expected: PASS (armfight cases + the existing resetMatch tests for other formats).

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): resetMatch reopens an armfight bout

Clears legs/score/status to pending, preserves the configured hand,
reopens the bracket if it was completed. Other bouts on the card are
untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `replacePlayerInSlot` / `withdrawPlayerFromSlot` armfight checks

Both functions currently gate only on `match.winner`. For armfight we additionally refuse once at least one leg is recorded.

**Files:**
- Modify: `packages/bracket-engine/src/bracket-logic.ts` (lines 2288, 2354)
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('replacePlayerInSlot — armfight', () => {
  it('allowed on a pending bout (no legs yet)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    const res = replacePlayerInSlot(data, 'wb_1_0', 2, {
      id: 'p9', firstName: 'New', lastName: 'Comer', number: 9,
    });
    expect(res.ok).toBe(true);
  });

  it('rejected once a leg has been recorded', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    const res = replacePlayerInSlot(data, 'wb_1_0', 2, {
      id: 'p9', firstName: 'New', lastName: 'Comer', number: 9,
    });
    expect(res.ok).toBe(false);
    expect(res.error || '').toMatch(/leg/i);
  });
});

describe('withdrawPlayerFromSlot — armfight', () => {
  it('allowed on a pending bout', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    const res = withdrawPlayerFromSlot(data, 'wb_1_0', 1);
    expect(res.ok).toBe(true);
    expect(res.forfeitTo).toBe('p2');
  });

  it('rejected once a leg has been recorded', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    const res = withdrawPlayerFromSlot(data, 'wb_1_0', 1);
    expect(res.ok).toBe(false);
    expect(res.error || '').toMatch(/leg/i);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd packages/bracket-engine && npx vitest run -t "replacePlayerInSlot — armfight|withdrawPlayerFromSlot — armfight"`
Expected: FAIL — the post-leg cases return `ok: true` today.

- [ ] **Step 3: Add an armfight guard to both functions**

In `replacePlayerInSlot` (after line 2296 — right after the `match.winner` guard):
```ts
  if (data.format === 'armfight') {
    const r = (match as Match).result;
    if (isArmfightBoutResult(r) && r.legs.length > 0) {
      return { ok: false, error: 'Cannot replace player after a leg has been recorded' };
    }
  }
```

In `withdrawPlayerFromSlot` (after line 2361 — right after the `match.winner` guard):
```ts
  if (data.format === 'armfight') {
    const r = (match as Match).result;
    if (isArmfightBoutResult(r) && r.legs.length > 0) {
      return { ok: false, error: 'Cannot withdraw player after a leg has been recorded' };
    }
  }
```

- [ ] **Step 4: Run to verify**

Run: `cd packages/bracket-engine && npx vitest run -t "replacePlayerInSlot|withdrawPlayerFromSlot"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bracket-engine/src/bracket-logic.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): block player swap/withdraw after first armfight leg

replacePlayerInSlot and withdrawPlayerFromSlot now refuse armfight bouts
that already have at least one recorded leg — the leg history references
specific player ids and would become inconsistent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Update `index.ts` exports + index-coverage test

**Files:**
- Modify: `packages/bracket-engine/src/index.ts`
- Modify: `packages/bracket-engine/src/bracket-logic.spec.ts` (the `coverage — index.ts re-exports` block at line 2847)

- [ ] **Step 1: Update `index.ts`**

Replace the file with:
```ts
export {
  generateDoubleElimination,
  generateSingleElimination,
  generateRoundRobin,
  generateSwiss,
  generateGroupsPlayoff,
  generateArmfight,
  getRoundRobinStandings,
  getSwissStandings,
  getGroupStandings,
  getFinalPlacements,
  selectWinner,
  propagateResults,
  findMatch,
  walkBracketMatches,
  isPlayableMatch,
  getPlayerObj,
  resetMatch,
  canRecordResult,
  validateResult,
  replacePlayerInSlot,
  withdrawPlayerFromSlot,
  // Armfight (sub-project B)
  recordLeg,
  forfeitBout,
  getBoutScore,
  isArmfightBoutResult,
} from './bracket-logic';
export type {
  Player,
  Match,
  GrandFinalMatch,
  SuperFinalMatch,
  BracketData,
  ValidationResult,
  Standing,
  FinalPlacement,
  GroupStage,
  // Armfight (sub-project B)
  ArmfightHand,
  LegWinType,
  ArmfightBoutStatus,
  ArmfightLeg,
  ArmfightBoutResult,
  ArmfightPairSpec,
  RecordLegOptions,
} from './types';
export type { BracketSection, BracketMatchVisitor } from './bracket-logic';
export { TBD_PLAYER, BYE_PLAYER } from './types';
```

- [ ] **Step 2: Extend the index re-exports test**

Open `bracket-logic.spec.ts`, find the `describe('coverage — index.ts re-exports', …)` block (line 2847). Replace its body with:
```ts
  it('exports the public API surface', async () => {
    const mod = await import('./index');
    expect(typeof mod.generateDoubleElimination).toBe('function');
    expect(typeof mod.selectWinner).toBe('function');
    expect(typeof mod.recordLeg).toBe('function');
    expect(typeof mod.forfeitBout).toBe('function');
    expect(typeof mod.getBoutScore).toBe('function');
    expect(typeof mod.isArmfightBoutResult).toBe('function');
    expect(mod.TBD_PLAYER.id).toBe('tbd');
    expect(mod.BYE_PLAYER.id).toBe('bye');
  });
```

- [ ] **Step 3: Run the suite**

Run: `cd packages/bracket-engine && npx vitest run`
Expected: PASS — full suite green.

- [ ] **Step 4: Commit**

```bash
git add packages/bracket-engine/src/index.ts packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "$(cat <<'EOF'
feat(bracket): export armfight scoring API from index

recordLeg, forfeitBout, getBoutScore, isArmfightBoutResult + their
types are now part of the public surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Coverage gate ≥ 90% on `bracket-logic.ts`

**Files:**
- (may modify) `packages/bracket-engine/src/bracket-logic.spec.ts` — add fill-in tests if the gate fails

- [ ] **Step 1: Run coverage**

Run: `cd packages/bracket-engine && npm run test:coverage`
Expected: all 4 thresholds (statements / branches / functions / lines) ≥ 90% on `bracket-logic.ts`.

- [ ] **Step 2: If coverage fails — read the per-file uncovered-lines report and add targeted tests**

The coverage tool prints uncovered lines. For each uncovered line in `bracket-logic.ts`, add one or two tests that exercise the missing branch — most likely candidates are:
- error branches in armfight functions that none of the happy-path tests hit
- the propagation reconciliation branch for ties (status === 'walkover' with tied scores)
- isPlayableMatch's `match.winner` early-return for non-armfight formats — covered by existing tests; if not, add a one-liner.

Iterate: add tests → re-run `npm run test:coverage` → repeat until thresholds pass.

- [ ] **Step 3: Commit (if any tests were added)**

```bash
git add packages/bracket-engine/src/bracket-logic.spec.ts
git commit -m "test(bracket): lift coverage of bracket-logic.ts to >=90%"
```

(Skip commit if Step 1 already passed.)

---

## Task 17: Add `'armfight_bo5'` to `MatchResultSchema`

**Files:**
- Modify: `packages/shared-types/src/index.ts` (line 24-29)

- [ ] **Step 1: Edit the union**

Find line 24-29:
```ts
export type MatchResultSchema =
  | 'simple_winner' // just winnerId (default fallback)
  | 'armwrestling' // winnerId + victoryType + fouls + round durations
  | 'score' // winnerId + team scores per period (football, basketball…)
  | 'time' // no winner per match — ranked by fastest time (swimming, running)
  | 'points'; // winnerId + judge point totals (boxing, MMA by decision)
```
Replace with:
```ts
export type MatchResultSchema =
  | 'simple_winner' // just winnerId (default fallback)
  | 'armwrestling' // winnerId + victoryType + fouls + round durations
  | 'score' // winnerId + team scores per period (football, basketball…)
  | 'time' // no winner per match — ranked by fastest time (swimming, running)
  | 'points' // winnerId + judge point totals (boxing, MMA by decision)
  | 'armfight_bo5'; // best-of-5 fight card bout — legs[], hand, scoreA/B, status
```

- [ ] **Step 2: Typecheck the workspace**

Run: `cd packages/shared-types && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit && cd ../../packages/bracket-engine && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared-types): add 'armfight_bo5' to MatchResultSchema

Used by Tournament.matchResultSchema resolution for armfight brackets
and by the API match-result validator.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: `ArmfightPairDto` + `GenerateBracketDto.pairs`

**Files:**
- Create: `apps/api/src/brackets/dto/armfight-pair.dto.ts`
- Modify: `apps/api/src/brackets/dto/generate-bracket.dto.ts`

- [ ] **Step 1: Create the pair sub-DTO**

`apps/api/src/brackets/dto/armfight-pair.dto.ts`:
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsIn, IsOptional, IsInt, Min } from 'class-validator';

/**
 * One pair in an admin-curated armfight fight card. Matches the engine's
 * `ArmfightPairSpec` (which uses `Player` objects); the API receives ids
 * and resolves them to players in `BracketsService.buildBracket`.
 */
export class ArmfightPairDto {
  @ApiProperty() @IsUUID() playerAId!: string;
  @ApiProperty() @IsUUID() playerBId!: string;

  @ApiProperty({ enum: ['left', 'right'] })
  @IsIn(['left', 'right'])
  hand!: 'left' | 'right';

  @ApiProperty({ required: false, description: 'Optional display order; defaults to position in pairs[]' })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
```

- [ ] **Step 2: Extend `GenerateBracketDto`** — add the `pairs` field

Open `apps/api/src/brackets/dto/generate-bracket.dto.ts`. Update the imports at top:
```ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  IsIn,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { BracketFormat } from '@gsm/shared-types';
import { ArmfightPairDto } from './armfight-pair.dto';
```

Append inside `GenerateBracketDto` (after the `bracketFormat` field, before the closing `}`):
```ts
  @ApiProperty({
    required: false,
    type: [ArmfightPairDto],
    description: 'Required when bracketFormat === "armfight". Admin-curated bout list.',
  })
  @IsOptional()
  @ValidateIf((o: GenerateBracketDto) => o.bracketFormat === 'armfight')
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArmfightPairDto)
  pairs?: ArmfightPairDto[];
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/brackets/dto/armfight-pair.dto.ts apps/api/src/brackets/dto/generate-bracket.dto.ts
git commit -m "$(cat <<'EOF'
feat(api): ArmfightPairDto + pairs[] field on GenerateBracketDto

Validated only when bracketFormat === 'armfight'. Class-validator
rejects empty pairs[], non-UUID player ids, and hand outside
{'left','right'}.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: `BracketsService.buildBracket` armfight branch (the real one)

**Files:**
- Modify: `apps/api/src/brackets/brackets.service.ts`
- Modify: `apps/api/src/brackets/brackets.service.spec.ts`

- [ ] **Step 1: Update `buildBracket` signature to pass through pairs**

In `brackets.service.ts`, change the signature (line 332):
```ts
  private buildBracket(
    format: BracketFormat,
    players: Player[],
    armfightPairs?: ArmfightPairSpec[],
  ): BracketData {
```

Import the type at top:
```ts
import type { Player, BracketData, ArmfightPairSpec } from '@gsm/bracket-engine';
```

Replace the temporary `throw` we added in Task 3 with:
```ts
    if (format === 'armfight') {
      if (!armfightPairs || armfightPairs.length === 0) {
        throw new BadRequestException(
          'Armfight bracket requires explicit pairs[]; use POST /v1/brackets with pairs[].',
        );
      }
      return generateArmfight(armfightPairs);
    }
```

- [ ] **Step 2: Resolve pair player-ids → `Player` objects in the public `generate` method**

The public method that calls `buildBracket(format, players)` is `generate` (look near `generate(dto: GenerateBracketDto, organizerId: string)`; search for `buildBracket(format, players)` — there are 2-3 call sites). For each site, add — right above the `buildBracket(format, players)` line — an `armfightPairs?: ArmfightPairSpec[]` resolution block:

```ts
    let armfightPairs: ArmfightPairSpec[] | undefined;
    if (format === 'armfight' && dto.pairs && dto.pairs.length > 0) {
      // Resolve each pair's player ids against `players` (already loaded
      // from tournament entries by the caller). Each player must appear
      // in `players` — otherwise the pair references someone who isn't
      // registered for this tournament.
      armfightPairs = dto.pairs.map((p, idx) => {
        const a = players.find((pl) => pl.id === p.playerAId);
        const b = players.find((pl) => pl.id === p.playerBId);
        if (!a || !b) {
          throw new BadRequestException(
            `pairs[${idx}] references player ids not in tournament entries`,
          );
        }
        return { playerA: a, playerB: b, hand: p.hand, order: p.order };
      });
    }
    const bracketData = this.buildBracket(format, players, armfightPairs);
```

Apply this resolution at every call site of `this.buildBracket(format, players)` in `brackets.service.ts` (`grep -n "this.buildBracket(format, players)" brackets.service.ts` to enumerate). For sites that come from `generateForGroup` (no DTO with `pairs`), the resolution block is unreachable — Task 20 makes `generateForGroup` reject armfight outright, so `pairs` will never be needed there.

- [ ] **Step 3: Write the failing tests**

In `brackets.service.spec.ts`, find the existing armfight test at line 637-658 (`it('uses armfight when tournament.sportConfig.competitionType is armfight', …)`) and **delete** it. In its place, add a new `describe('armfight generation', …)` block:

```ts
describe('armfight generation', () => {
  beforeEach(() => {
    // Re-prime the engine mock so generateArmfight is observable.
    (generateArmfight as unknown as ReturnType<typeof vi.fn>).mockClear?.();
  });

  it('happy path: pairs[] resolved to Player objects and forwarded to generateArmfight', async () => {
    const { generateArmfight } = await import('@gsm/bracket-engine');
    // Tournament + entries fixtures specific to this test; mirror the
    // helper patterns already in this spec file (look near line 78-82
    // for the engine mock harness and reuse the tournament/entries
    // factories used by other generate tests).
    const tournament = makeTournament({ sportConfig: { competitionType: 'armfight' } });
    const entries = [
      makeEntry({ id: 'p1' }),
      makeEntry({ id: 'p2' }),
      makeEntry({ id: 'p3' }),
      makeEntry({ id: 'p4' }),
    ];
    primeTournamentAndEntries(tournament, entries);

    await service.generate(
      {
        tournamentId: tournament.id,
        bracketFormat: 'armfight',
        pairs: [
          { playerAId: 'p1', playerBId: 'p2', hand: 'right' },
          { playerAId: 'p3', playerBId: 'p4', hand: 'left' },
        ],
      } as any,
      tournament.organizerId,
    );

    expect(generateArmfight).toHaveBeenCalledTimes(1);
    const callArg = (generateArmfight as any).mock.calls[0][0];
    expect(callArg).toHaveLength(2);
    expect(callArg[0]).toMatchObject({ hand: 'right' });
    expect(callArg[0].playerA.id).toBe('p1');
    expect(callArg[0].playerB.id).toBe('p2');
    expect(callArg[1]).toMatchObject({ hand: 'left' });
  });

  it('rejects when pairs[] is missing for armfight', async () => {
    const tournament = makeTournament({ sportConfig: { competitionType: 'armfight' } });
    primeTournamentAndEntries(tournament, [makeEntry({ id: 'p1' }), makeEntry({ id: 'p2' })]);
    await expect(
      service.generate(
        { tournamentId: tournament.id, bracketFormat: 'armfight' } as any,
        tournament.organizerId,
      ),
    ).rejects.toThrow(/pairs/i);
  });

  it('rejects when a pair references a player not in entries', async () => {
    const tournament = makeTournament({ sportConfig: { competitionType: 'armfight' } });
    primeTournamentAndEntries(tournament, [makeEntry({ id: 'p1' }), makeEntry({ id: 'p2' })]);
    await expect(
      service.generate(
        {
          tournamentId: tournament.id,
          bracketFormat: 'armfight',
          pairs: [{ playerAId: 'p1', playerBId: 'GHOST', hand: 'right' }],
        } as any,
        tournament.organizerId,
      ),
    ).rejects.toThrow(/not in tournament entries|references player/i);
  });
});
```

The helpers `makeTournament`, `makeEntry`, `primeTournamentAndEntries` already exist in `brackets.service.spec.ts` (look near the top of the file for the factory pattern; if a helper has a different name, use the actual name — the goal is a tournament with the given entries primed into the mocked repos). If a helper is missing, reuse the inline setup pattern from the existing armfight test we deleted.

- [ ] **Step 4: Run the new tests — verify they fail (or pass) as expected**

Run: `cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts -t "armfight generation"`
Expected: the "happy path" probably FAILs first time (mock not invoked) — that's expected red. Fix the resolution block in Step 2 until it goes green.

- [ ] **Step 5: Iterate until green**

Run the same vitest line. Then re-run the entire spec:
`cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts`
Expected: PASS — no other test regressions.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/brackets/brackets.service.ts apps/api/src/brackets/brackets.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): wire pairs[] DTO through buildBracket to generateArmfight

Resolves each pair's playerAId/playerBId against the tournament's
entries before invoking the engine. Rejects missing pairs, empty
pairs, and pairs that reference unregistered players.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Reject armfight via `generateForGroup`

**Files:**
- Modify: `apps/api/src/brackets/brackets.service.ts` (`generateForGroup` at line 351)
- Modify: `apps/api/src/brackets/brackets.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `brackets.service.spec.ts`:
```ts
it('generateForGroup throws for armfight (must use pairs[] path)', async () => {
  const tournament = makeTournament({ sportConfig: { competitionType: 'armfight' } });
  primeTournamentAndEntries(tournament, [makeEntry({ id: 'p1' }), makeEntry({ id: 'p2' })]);
  await expect(
    service.generateForGroup(
      {
        tournamentId: tournament.id,
        ageGroup: 'open',
        hand: 'right',
        bracketFormat: 'armfight',
      },
      tournament.organizerId,
    ),
  ).rejects.toThrow(/pairs/i);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts -t "generateForGroup throws for armfight"`
Expected: FAIL — `generateForGroup` happily resolves the format and calls `buildBracket`.

- [ ] **Step 3: Add the rejection**

In `generateForGroup`, right after the `resolveFormat` call (find `const format = this.resolveFormat(...)`):
```ts
    if (format === 'armfight') {
      throw new BadRequestException(
        'Armfight bracket requires explicit pairs[]; use POST /v1/brackets with pairs[].',
      );
    }
```

(Apply the same guard to the other code paths that call `resolveFormat` then `buildBracket` without a DTO `pairs` field — `grep -n "resolveFormat" brackets.service.ts` to enumerate; lines 381, 441, 613 in current file. Only sites where there is no `dto.pairs` available need the guard. The public `generate` method has `dto.pairs` and is the one allowed path.)

- [ ] **Step 4: Run to verify**

Run: `cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/brackets/brackets.service.ts apps/api/src/brackets/brackets.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): reject armfight from generateForGroup-style code paths

Armfight is admin-curated — only the dedicated POST /v1/brackets with
pairs[] is a valid entry point.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Resolve `matchResultSchema = 'armfight_bo5'` for armfight + validator schema

**Files:**
- Modify: `apps/api/src/brackets/brackets.service.ts` (the schema lookup in `recordResult` around line 776-777)
- Modify: `apps/api/src/brackets/match-result.validator.ts` (add `armfight_bo5` case)
- Modify: `apps/api/src/brackets/brackets.service.spec.ts`
- Modify: `apps/api/src/brackets/match-result.validator.spec.ts`

- [ ] **Step 1: Write failing test in service spec**

```ts
it('resolves matchResultSchema to "armfight_bo5" when bracketData.format === "armfight"', async () => {
  // Service-level: setup a bracket whose data.format is 'armfight';
  // call recordResult with a payload missing schema='armfight_bo5' and
  // expect the validation error to mention armfight_bo5 as the expected schema.
  const tournament = makeTournament({ sportConfig: { competitionType: 'armfight' } });
  const bracket = makeBracket({ tournament, bracketData: makeArmfightBracketData() });
  primeBracket(bracket);
  await expect(
    service.recordResult(
      bracket.id,
      { matchId: 'wb_1_0', winnerId: 'p1', result: { schema: 'armwrestling' } } as any,
      tournament.organizerId,
      ['organizer'],
    ),
  ).rejects.toThrow(/armfight_bo5/);
});
```

`makeBracket` / `makeArmfightBracketData` / `primeBracket` follow the existing factory pattern in the spec — reuse the helpers used by other `recordResult` tests in the file. If `makeArmfightBracketData` doesn't exist, define it inline at the top of the new test:
```ts
function makeArmfightBracketData() {
  return {
    format: 'armfight',
    players: [],
    bracketSize: 2,
    wbRounds: 1,
    winnersBracket: [[{
      id: 'wb_1_0',
      round: 1,
      matchIndex: 0,
      player1: { id: 'p1', firstName: 'A', lastName: '1', number: '1' },
      player2: { id: 'p2', firstName: 'B', lastName: '2', number: '2' },
      winner: null, loser: null,
      result: { hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' },
    }]],
    losersBracket: [],
    grandFinal: { id: 'gf', player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, winner: null, loser: null },
    superFinal: { id: 'sf', player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, winner: null, loser: null, needed: false },
    champion: null, status: 'active',
  };
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts -t "armfight_bo5"`
Expected: FAIL — current resolver falls back to sport's matchResultSchema (`'armwrestling'`).

- [ ] **Step 3: Add the resolver override in `recordResult`**

Find lines 772-778 in `brackets.service.ts`:
```ts
      const tOverride = (bracket.tournament.sportConfig ?? {}) as Partial<SportConfig>;
      const matchResultSchema = tOverride.matchResultSchema ?? sportCfg.matchResultSchema;
```
Replace with:
```ts
      const tOverride = (bracket.tournament.sportConfig ?? {}) as Partial<SportConfig>;
      // Bracket format overrides the per-tournament / per-sport schema:
      // an armfight bracket always uses 'armfight_bo5' regardless of what
      // the surrounding tournament's sport says.
      const isArmfight = (bracket.bracketData as any)?.format === 'armfight';
      const matchResultSchema = isArmfight
        ? 'armfight_bo5'
        : (tOverride.matchResultSchema ?? sportCfg.matchResultSchema);
```

- [ ] **Step 4: Write failing test in validator spec + add the case**

In `apps/api/src/brackets/match-result.validator.spec.ts`, add:
```ts
describe('validateMatchResult — armfight_bo5', () => {
  const match = {
    id: 'wb_1_0',
    player1: { id: 'p1', firstName: 'A', lastName: '1', number: '1' },
    player2: { id: 'p2', firstName: 'B', lastName: '2', number: '2' },
    winner: null, loser: null, round: 1, matchIndex: 0,
  } as any;

  it('accepts a valid pending payload', () => {
    expect(
      validateMatchResult(
        { schema: 'armfight_bo5', hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' },
        'armfight_bo5',
        match,
      ),
    ).toEqual([]);
  });

  it('rejects when schema discriminator does not match', () => {
    const errs = validateMatchResult(
      { schema: 'armwrestling', hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' },
      'armfight_bo5',
      match,
    );
    expect(errs.join(' ')).toMatch(/schema/);
  });

  it('rejects when shape is wrong', () => {
    const errs = validateMatchResult(
      { schema: 'armfight_bo5', hand: 'middle' },
      'armfight_bo5',
      match,
    );
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects a leg whose winnerId is not a player in this match', () => {
    const errs = validateMatchResult(
      {
        schema: 'armfight_bo5',
        hand: 'right',
        legs: [{ index: 1, winnerId: 'GHOST', winType: 'pin' }],
        scoreA: 1, scoreB: 0, status: 'in_progress',
      },
      'armfight_bo5',
      match,
    );
    expect(errs.join(' ')).toMatch(/winnerId/);
  });
});
```

Run: `cd apps/api && npx vitest run src/brackets/match-result.validator.spec.ts -t "armfight_bo5"`
Expected: FAIL — schema not handled.

- [ ] **Step 5: Add the `armfight_bo5` case to `match-result.validator.ts`**

Open `match-result.validator.ts`. After the existing `case 'armwrestling': …` block, add:
```ts
    case 'armfight_bo5': {
      // Delegate shape checking to the engine. We still validate the
      // tournament-scope rule that any winnerId inside the payload must
      // reference a real player in *this* match.
      const { isArmfightBoutResult } = await getEngine();
      if (!isArmfightBoutResult(r as unknown)) {
        errors.push('armfight_bo5: payload is not a valid ArmfightBoutResult');
        break;
      }
      const legs = (r as unknown as { legs: Array<{ winnerId: string }> }).legs;
      legs.forEach((leg, i) => {
        if (!playerIds.has(leg.winnerId)) {
          errors.push(`armfight_bo5: legs[${i}].winnerId must be one of the match players`);
        }
      });
      const { scoreA, scoreB, status } = r as unknown as { scoreA: number; scoreB: number; status: string };
      if (scoreA + scoreB !== legs.length) {
        errors.push('armfight_bo5: scoreA + scoreB must equal legs.length');
      }
      const decided = scoreA === 3 || scoreB === 3;
      if (decided && status !== 'completed' && status !== 'walkover') {
        errors.push('armfight_bo5: bout reached 3 legs but status is not completed/walkover');
      }
      break;
    }
```

`getEngine()` is the dynamic-import pattern. If the file doesn't already do dynamic imports, change the top-of-file engine import to a normal `import { isArmfightBoutResult } from '@gsm/bracket-engine'` and drop the `await getEngine()` wrapper. Whichever matches the file's existing style. **Either way, do NOT make this function async** unless the file's other case handlers are also async — the simplest path is a synchronous import.

If a synchronous import is fine, the case becomes:
```ts
    case 'armfight_bo5': {
      if (!isArmfightBoutResult(r as unknown)) {
        errors.push('armfight_bo5: payload is not a valid ArmfightBoutResult');
        break;
      }
      const legs = (r as unknown as { legs: Array<{ winnerId: string }> }).legs;
      legs.forEach((leg, i) => {
        if (!playerIds.has(leg.winnerId)) {
          errors.push(`armfight_bo5: legs[${i}].winnerId must be one of the match players`);
        }
      });
      const { scoreA, scoreB, status } = r as unknown as { scoreA: number; scoreB: number; status: string };
      if (scoreA + scoreB !== legs.length) {
        errors.push('armfight_bo5: scoreA + scoreB must equal legs.length');
      }
      const decided = scoreA === 3 || scoreB === 3;
      if (decided && status !== 'completed' && status !== 'walkover') {
        errors.push('armfight_bo5: bout reached 3 legs but status is not completed/walkover');
      }
      break;
    }
```
And add the import at the top:
```ts
import { isArmfightBoutResult } from '@gsm/bracket-engine';
```

- [ ] **Step 6: Run all touched specs**

Run: `cd apps/api && npx vitest run src/brackets/match-result.validator.spec.ts src/brackets/brackets.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/brackets/brackets.service.ts apps/api/src/brackets/match-result.validator.ts apps/api/src/brackets/brackets.service.spec.ts apps/api/src/brackets/match-result.validator.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): matchResultSchema = 'armfight_bo5' for armfight brackets

Bracket format always overrides per-sport schema for armfight. The
validator delegates shape checking to the engine's isArmfightBoutResult
and tournament-scopes any winnerId inside legs[] to the match's two
players.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Scoring DTOs

**Files:**
- Create: `apps/api/src/brackets/dto/record-leg.dto.ts`
- Create: `apps/api/src/brackets/dto/forfeit-bout.dto.ts`

- [ ] **Step 1: Create `record-leg.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, IsIn, IsOptional } from 'class-validator';

export class RecordLegDto {
  @ApiProperty({ description: 'Match id, e.g. "wb_1_3"' })
  @IsString()
  boutId!: string;

  @ApiProperty({ description: '1..5, must be next-in-sequence' })
  @IsInt() @Min(1) @Max(5)
  legIndex!: number;

  @ApiProperty()
  @IsString()
  winnerId!: string;

  @ApiProperty({ enum: ['pin', 'foul', 'dq'] })
  @IsIn(['pin', 'foul', 'dq'])
  winType!: 'pin' | 'foul' | 'dq';

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  enteredAt?: string;
}
```

- [ ] **Step 2: Create `forfeit-bout.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ForfeitBoutDto {
  @ApiProperty({ description: 'Match id, e.g. "wb_1_3"' })
  @IsString()
  boutId!: string;

  @ApiProperty({ description: 'Player id of the bout winner (the side still able to compete)' })
  @IsString()
  winnerId!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  walkoverReason?: string;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/brackets/dto/record-leg.dto.ts apps/api/src/brackets/dto/forfeit-bout.dto.ts
git commit -m "$(cat <<'EOF'
feat(api): RecordLegDto + ForfeitBoutDto for armfight scoring endpoints

Wired into the service + controller in the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: Service methods + controller endpoints — `POST /:id/legs`, `POST /:id/forfeit`, `GET /:id/bouts`

**Files:**
- Modify: `apps/api/src/brackets/brackets.service.ts` — add `recordLegResult`, `forfeitBoutById`, `listBouts`
- Modify: `apps/api/src/brackets/brackets.controller.ts` — add three endpoints
- Modify: `apps/api/src/brackets/brackets.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

In `brackets.service.spec.ts`, add a new `describe('armfight scoring', …)`:
```ts
describe('armfight scoring', () => {
  it('recordLegResult: invokes engine.recordLeg, saves, broadcasts', async () => {
    const { recordLeg } = await import('@gsm/bracket-engine');
    const tournament = makeTournament({});
    const bracket = makeBracket({ tournament, bracketData: makeArmfightBracketData() });
    primeBracket(bracket);
    await service.recordLegResult(
      bracket.id,
      { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
      tournament.organizerId,
      ['organizer'],
    );
    expect(recordLeg).toHaveBeenCalled();
  });

  it('recordLegResult: forbidden when caller is neither organizer nor operator/referee', async () => {
    const tournament = makeTournament({ organizerId: 'OWNER' });
    const bracket = makeBracket({ tournament, bracketData: makeArmfightBracketData() });
    primeBracket(bracket);
    await expect(
      service.recordLegResult(
        bracket.id,
        { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
        'SOMEONE_ELSE',
        [],
      ),
    ).rejects.toThrow(/forbidden|permission/i);
  });

  it('forfeitBoutById: invokes engine.forfeitBout', async () => {
    const { forfeitBout } = await import('@gsm/bracket-engine');
    const tournament = makeTournament({});
    const bracket = makeBracket({ tournament, bracketData: makeArmfightBracketData() });
    primeBracket(bracket);
    await service.forfeitBoutById(
      bracket.id,
      { boutId: 'wb_1_0', winnerId: 'p1', walkoverReason: 'injury' } as any,
      tournament.organizerId,
      ['organizer'],
    );
    expect(forfeitBout).toHaveBeenCalled();
  });

  it('listBouts: returns BoutSnapshot[] derived from winnersBracket[0]', async () => {
    const tournament = makeTournament({});
    const data = makeArmfightBracketData();
    const bracket = makeBracket({ tournament, bracketData: data });
    primeBracket(bracket);
    const out = await service.listBouts(bracket.id);
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].boutId).toBe('wb_1_0');
    expect(out[0].hand).toBe('right');
    expect(out[0].scoreA).toBe(0);
    expect(out[0].status).toBe('pending');
  });

  it('listBouts: throws when bracket is not armfight', async () => {
    const tournament = makeTournament({});
    const bracket = makeBracket({ tournament, bracketData: { format: 'double_elim', winnersBracket: [[]], losersBracket: [], champion: null, status: 'active', bracketSize: 2, wbRounds: 1, grandFinal: { id: 'gf', player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, winner: null, loser: null }, superFinal: { id: 'sf', player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' }, winner: null, loser: null, needed: false }, players: [] } });
    primeBracket(bracket);
    await expect(service.listBouts(bracket.id)).rejects.toThrow(/armfight/i);
  });
});
```

Note: `recordLeg`, `forfeitBout`, `getBoutScore` must be mocked alongside `generateArmfight` in the engine-mock harness at the top of the spec. Find the existing `vi.mock('@gsm/bracket-engine', …)` block (near `brackets.service.spec.ts:78-82`) and extend the mocked exports:
```ts
  recordLeg: vi.fn(),
  forfeitBout: vi.fn((data: any, boutId: string, winnerId: string) => {
    // Minimal mock: flip status so listBouts has something to show after forfeit.
    const m = data.winnersBracket[0].find((m: any) => m.id === boutId);
    if (m) { m.winner = winnerId; m.result.status = 'walkover'; }
  }),
  getBoutScore: vi.fn((_data: any, _id: string) => ({ a: 0, b: 0, status: 'pending', leadingId: null })),
  isArmfightBoutResult: vi.fn(() => true),
```

- [ ] **Step 2: Run to verify fail**

Run: `cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts -t "armfight scoring"`
Expected: FAIL — `recordLegResult`, `forfeitBoutById`, `listBouts` not defined.

- [ ] **Step 3: Add the service methods**

In `brackets.service.ts`, near the existing `recordResult` method (around line 721), add (these import `recordLeg`, `forfeitBout`, `getBoutScore` from `@gsm/bracket-engine` — extend the existing top-of-file import):

```ts
  /**
   * Record one leg of an armfight bo5 bout. Mirrors `recordResult` but
   * goes through the engine's `recordLeg` and the dedicated scoring DTO.
   */
  async recordLegResult(
    bracketId: string,
    dto: RecordLegDto,
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);
    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: true });
    if (bracket.isLocked && !userRoles.includes('admin')) {
      throw new ForbiddenException('Bracket is locked. Only admin can modify results.');
    }
    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }
    const data = bracket.bracketData as unknown as BracketData;
    if (data.format !== 'armfight') {
      throw new BadRequestException('recordLeg is only valid on armfight brackets');
    }
    recordLeg(data, dto.boutId, dto.legIndex, dto.winnerId, dto.winType, {
      enteredBy: userId,
      enteredAt: dto.enteredAt,
    });
    propagateResults(data); // covered by the engine; harmless for armfight pre-completion
    return this.persistAndBroadcast(bracket, data);
  }

  async forfeitBoutById(
    bracketId: string,
    dto: ForfeitBoutDto,
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);
    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: true });
    if (bracket.isLocked && !userRoles.includes('admin')) {
      throw new ForbiddenException('Bracket is locked. Only admin can modify results.');
    }
    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }
    const data = bracket.bracketData as unknown as BracketData;
    if (data.format !== 'armfight') {
      throw new BadRequestException('forfeitBout is only valid on armfight brackets');
    }
    forfeitBout(data, dto.boutId, dto.winnerId, {
      walkoverReason: dto.walkoverReason,
      enteredBy: userId,
    });
    propagateResults(data);
    return this.persistAndBroadcast(bracket, data);
  }

  async listBouts(bracketId: string): Promise<Array<{
    boutId: string;
    order: number;
    hand: 'left' | 'right';
    playerA: { id: string; firstName: string; lastName: string };
    playerB: { id: string; firstName: string; lastName: string };
    scoreA: number;
    scoreB: number;
    status: 'pending' | 'in_progress' | 'completed' | 'walkover';
    leadingId: string | null;
    legs: Array<{ index: number; winnerId: string; winType: 'pin' | 'foul' | 'dq' }>;
    walkoverReason: string | null;
  }>> {
    const bracket = await this.findById(bracketId);
    if (!bracket.bracketData) throw new BadRequestException('Bracket has no data');
    const data = bracket.bracketData as unknown as BracketData;
    if (data.format !== 'armfight') {
      throw new BadRequestException('listBouts is only valid on armfight brackets');
    }
    const round = data.winnersBracket[0] ?? [];
    return round.map((m, idx) => {
      const score = getBoutScore(data, m.id);
      const r = m.result as unknown as { hand: 'left' | 'right'; legs: Array<{ index: number; winnerId: string; winType: 'pin' | 'foul' | 'dq' }>; walkoverReason?: string | null };
      return {
        boutId: m.id,
        order: idx + 1,
        hand: r.hand,
        playerA: { id: m.player1.id, firstName: m.player1.firstName, lastName: m.player1.lastName },
        playerB: { id: m.player2.id, firstName: m.player2.firstName, lastName: m.player2.lastName },
        scoreA: score.a,
        scoreB: score.b,
        status: score.status,
        leadingId: score.leadingId,
        legs: r.legs,
        walkoverReason: r.walkoverReason ?? null,
      };
    });
  }
```

`persistAndBroadcast` is a helper to extract from `recordResult` (the optimistic-locked transaction + broadcast block, currently inlined around lines 808-870). If extraction is not trivial, inline the same transaction shape into `recordLegResult` and `forfeitBoutById` — but DRY by writing a private helper. (Take the minute to refactor; the saved code path is identical between `recordResult` / `recordLegResult` / `forfeitBoutById` once you compare them.)

Add imports at top of `brackets.service.ts`:
```ts
import {
  // … existing engine imports …
  recordLeg,
  forfeitBout,
  getBoutScore,
  propagateResults,
} from '@gsm/bracket-engine';
import { RecordLegDto } from './dto/record-leg.dto';
import { ForfeitBoutDto } from './dto/forfeit-bout.dto';
```

- [ ] **Step 4: Run service-level tests**

Run: `cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts -t "armfight scoring"`
Expected: PASS.

Also run the whole service spec to make sure no regressions:
`cd apps/api && npx vitest run src/brackets/brackets.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add the three controller endpoints**

In `brackets.controller.ts`, after the `@Patch(':id/result')` endpoint (line 61), add:
```ts
  @Roles('admin', 'organizer', 'referee', 'operator')
  @Post(':id/legs')
  async recordLeg(
    @Param('id') id: string,
    @Body() dto: RecordLegDto,
    @Request() req: AuthedRequest,
  ): Promise<Bracket> {
    return this.bracketsService.recordLegResult(id, dto, req.user.id, req.user.roles ?? []);
  }

  @Roles('admin', 'organizer', 'referee', 'operator')
  @Post(':id/forfeit')
  async forfeitBout(
    @Param('id') id: string,
    @Body() dto: ForfeitBoutDto,
    @Request() req: AuthedRequest,
  ): Promise<Bracket> {
    return this.bracketsService.forfeitBoutById(id, dto, req.user.id, req.user.roles ?? []);
  }

  @Public()
  @Get(':id/bouts')
  async listBouts(@Param('id') id: string) {
    return this.bracketsService.listBouts(id);
  }
```

Imports (top of controller):
```ts
import { RecordLegDto } from './dto/record-leg.dto';
import { ForfeitBoutDto } from './dto/forfeit-bout.dto';
```

(`AuthedRequest` / `@Roles` / `@Public` / `@Request` / `@Post` / `@Get` are already imported in this controller — verify with `head -30 brackets.controller.ts`.)

- [ ] **Step 6: Typecheck + run all api tests**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/brackets/brackets.service.ts apps/api/src/brackets/brackets.controller.ts apps/api/src/brackets/brackets.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): armfight scoring endpoints + service methods

POST /v1/brackets/:id/legs    → recordLegResult → engine.recordLeg
POST /v1/brackets/:id/forfeit → forfeitBoutById → engine.forfeitBout
GET  /v1/brackets/:id/bouts   → listBouts (public read-only snapshot)

Roles: admin / organizer / referee / operator can mutate. Listing is
public (matches the rest of bracket reads).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: Final gate — lint + full test suite + coverage

**Files:** none modified — pure verification.

- [ ] **Step 1: Lint**

Run: `npx turbo lint`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `npx turbo test`
Expected: PASS — every package and app.

- [ ] **Step 3: Bracket-engine coverage**

Run: `cd packages/bracket-engine && npm run test:coverage`
Expected: thresholds (statements / branches / functions / lines ≥ 90% on `bracket-logic.ts`) PASS. If not, return to Task 16.

- [ ] **Step 4: Final commit (if any tweaks made in steps 1-3)**

If steps 1-3 required fixes, commit them with `chore(bracket): final lint+coverage cleanup`. If everything was already clean, no commit needed for Task 24.

---

## Self-Review

**Spec coverage:**
- Spec §2 decisions 1-10 → all reflected: §2.1 champion=null (Task 3 + Task 9); §2.2 bo5 mechanics (Task 5); §2.3 admin pairs (Tasks 18-19); §2.4 no waves (no field added); §2.5 recordLeg (Task 5); §2.6 winType (Tasks 5-6); §2.7 forfeitBout (Task 6); §2.8 no correction API (resetMatch covers, Task 13); §2.9 storage in Match.result (Task 3); §2.10 no backward-compat (Task 3 deletes legacy tests). ✓
- Spec §3 architecture file list → Tasks 1, 3, 4-7, 8-14, 15, 17, 18, 19-23. ✓
- Spec §4 data model → Task 1 (types), Task 3 (BracketData shape), Tasks 5-6 (lifecycle invariants). ✓
- Spec §5 engine API → Tasks 3 (generate), 4 (guard), 5 (recordLeg), 6 (forfeit), 7 (score), 8-14 (existing-fn updates), 15 (exports). ✓
- Spec §6 API wiring → Tasks 18 (DTO), 19 (buildBracket), 20 (reject via generateForGroup), 21 (matchResultSchema + validator), 22 (scoring DTOs), 23 (endpoints). ✓
- Spec §7 testing → every engine task is TDD; Tasks 19, 21, 23 cover service tests; Task 21 covers validator; Task 16 enforces the coverage floor. ✓
- Spec §8 migration → Task 0 (pre-flight). ✓
- Spec §9 checklist → tracked across tasks; lint+test gate in Task 24. ✓
- Spec §10 implementation order → 1-1 mapping into Tasks 0-24. ✓

**Placeholder scan:** No "TBD/TODO". Two notes that say "the helpers `makeTournament`, `makeEntry`, `primeTournamentAndEntries` already exist — use the actual names if they differ" are precise instructions, not vague ones; they explicitly say what to look for and how to fall back. Task 21 Step 5 names two possible patterns (async-import vs sync-import) and tells the engineer how to choose — that's a real decision the engineer makes at impl time, not a placeholder.

**Type consistency:** `ArmfightHand` / `LegWinType` / `ArmfightBoutStatus` / `ArmfightLeg` / `ArmfightBoutResult` / `ArmfightPairSpec` / `RecordLegOptions` defined in Task 1; consumed by Tasks 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15. Function signatures: `recordLeg(data, boutId, legIndex, winnerId, winType, options?)` consistent across Task 5 definition and Task 23 service use. `forfeitBout(data, boutId, winnerId, options?)` consistent across Task 6 and Task 23. `getBoutScore(data, boutId)` returns `{ a, b, status, leadingId }` consistent across Task 7 and Task 23 `listBouts`. `isArmfightBoutResult` used by Tasks 4, 8, 10, 12, 13, 14, 21. Engine match id scheme `wb_1_{i}` consistent across Task 3 + tests. DTO field names (`playerAId`, `playerBId`, `hand`, `boutId`, `legIndex`, `winType`) consistent across Tasks 18, 22, 23. ✓

---

## Execution Handoff

See the chat message accompanying this plan for the two execution options.
