# Armfight Match Rules (Sub-Project B) — Design Spec

> **Status:** Draft v1
> **Date:** 2026-05-20
> **Scope:** Sub-project **B** — armfight match rules engine (multi-pair file card, bo5 scoring) + API wiring. Sibling to the merged sub-project A (`docs/design/armfight-section.md`, PR #103) which only covered public discovery / main-event promo.
> **Out of scope:** Live-scoring operator UI; spectator broadcast UI; admin wizard "pair builder" step; websocket leg-by-leg broadcast layer. Those land in a follow-up sub-project once B's engine + API are stable.

---

## 1. Goal

Extend `packages/bracket-engine`, the API, and the match-result schema to support **armfight events as a fight card**: an admin-curated list of independent best-of-5 bouts (one hand per bout, first to 3 leg wins), with referee/operator scoring of individual legs and walkover handling. No per-event aggregate champion — each pair stands alone (`evw_pro`-style fight night).

The current engine treats `format: 'armfight'` as exactly two players in a single match (`generateArmfight` at `packages/bracket-engine/src/bracket-logic.ts:485`). B generalises that to 1..N pairs while keeping the single `BracketData` shape every consumer already understands.

---

## 2. Decisions made during brainstorming

These were chosen explicitly; they are the load-bearing decisions of the design. Anything contradicting them is a bug in this spec.

1. **Event structure is a flat fight card.** N independent bouts. No event-level champion, no aggregate score, no team-vs-team. `BracketData.champion === null` for all armfight events (including 1-pair).
2. **Best-of-5 = 5 legs on one hand, first to 3 wins.** Hand (`left` | `right`) is set per pair by the admin and immutable after generation. A bout ends at leg 3, 4, or 5 — whichever is first to reach `score === 3`.
3. **Admin sets pairs manually.** API accepts an explicit `pairs[]`. The engine does no auto-pairing or seeding. Odd N is not rejected at the engine — admin's list is trusted; entries unpaired by admin are simply not in any pair.
4. **No "wave" / table model in the engine.** The "5 simultaneous bouts" constraint is a venue / operator-UI concern. Engine stores bouts flat with `status` and `order`; runtime concurrency is decided by the operator at the event.
5. **Leg-by-leg recording.** Each leg has its own `winnerId` and `winType`. Score is derived. `recordLeg` is the only way to advance a bout; the existing generic `selectWinner` is forbidden for armfight bouts (throws).
6. **DQ / foul per leg.** Each leg carries `winType: 'pin' | 'foul' | 'dq'`. Win logic is unchanged (3 leg wins = bout); `winType` is metadata for refs and post-event review.
7. **Walkover mid-bout.** `forfeitBout(boutId, winnerId)` closes a bout immediately with `status: 'walkover'`. Existing legs stay; no more legs are appended.
8. **No leg-level post-correction API in MVP.** A misrecorded leg requires `resetMatch` (full bout reset). Audit fields (`enteredBy`/`enteredAt`) are still written per leg for forensics.
9. **Storage approach: bo5 lives in `Match.result`.** `winnersBracket: [[bout_1, …, bout_N]]` — one synthetic round of N matches. Bo5-specific data goes into `Match.result` (the Phase 3.2 extension point), not into new top-level fields on `BracketData`. Walkers / finders / propagation reuse existing iterators.
10. **No backward-compatibility shim for the legacy `generateArmfight(players: Player[])` signature.** The function's parameter type changes outright. Existing armfight tests are rewritten as one-pair cases; existing armfight callers (one site in `brackets.service.ts`) are updated.

---

## 3. Architecture

### 3.1. Components touched

```
packages/bracket-engine/
  src/types.ts                 + ArmfightHand, LegWinType, ArmfightBoutStatus,
                                 ArmfightLeg, ArmfightBoutResult, ArmfightPairSpec
                                 + RecordLegOptions
  src/bracket-logic.ts         * generateArmfight (signature change + multi-pair)
                               + recordLeg, forfeitBout, getBoutScore,
                                 isArmfightBoutResult
                               * propagateResults (armfight branch updated)
                               * finalizeArmfight (multi-pair logic)
                               * selectWinner (guard against armfight calls)
                               * isPlayableMatch, canRecordResult, validateResult,
                                 resetMatch, replacePlayerInSlot,
                                 withdrawPlayerFromSlot, getFinalPlacements
                                 (armfight branches updated)
  src/index.ts                 + new exports
  src/bracket-logic.spec.ts    * armfight block rewritten + expanded (≥30 cases)
  vitest.config.ts             * coverage.thresholds floor 90% on bracket-logic.ts

apps/api/
  src/brackets/dto/generate-bracket.dto.ts   + ArmfightPairDto, pairs?
  src/brackets/dto/record-leg.dto.ts         + new
  src/brackets/dto/forfeit-bout.dto.ts       + new
  src/brackets/brackets.controller.ts        + POST /legs, POST /forfeit, GET /bouts
  src/brackets/brackets.service.ts           * buildBracket armfight branch,
                                               * forbid armfight via generateForGroup,
                                               + recordLegResult, forfeitBout, listBouts
  src/brackets/brackets.service.spec.ts      * armfight cases rewritten + expanded
  src/sports/sport-config.ts                 (no change; resolver pickup is in brackets.service)

packages/shared-types/
  src/index.ts                 + 'armfight_bo5' added to MatchResultSchema union (line 24-29)
```

### 3.2. High-level flow

```
admin wizard → POST /v1/brackets
   body: { tournamentId, format: 'armfight', pairs: [{playerAId, playerBId, hand}, …] }
   → brackets.service.buildBracket('armfight', …)
   → bracket-engine.generateArmfight(pairs)
   → BracketData { format:'armfight', winnersBracket:[[N matches]], champion:null }
   → persist

referee/operator → POST /v1/brackets/:id/legs
   body: { boutId: 'wb_1_3', legIndex: 2, winnerId: 'uuid', winType: 'pin' }
   → bracket-engine.recordLeg(...)
   → bracket-engine.propagateResults(...)   // sets match.winner if scoreX === 3
   → bracket-engine.finalizeArmfight(...)   // bracket completed when all bouts closed
   → persist + broadcast

referee → POST /v1/brackets/:id/forfeit
   body: { boutId, winnerId, walkoverReason? }
   → bracket-engine.forfeitBout(...)
   → propagate → finalize → persist + broadcast

UI/derived → GET /v1/brackets/:id/bouts
   → service iterates winnersBracket[0], calls getBoutScore for each → response array
```

---

## 4. Data model

### 4.1. `BracketData` for an armfight card

No new top-level fields. Existing fields are populated as follows for `format: 'armfight'`:

| Field | Value |
|---|---|
| `format` | `'armfight'` |
| `players` | de-duplicated union of all players from all pairs, order of first appearance |
| `bracketSize` | `pairs.length * 2` |
| `wbRounds` | `1` |
| `winnersBracket` | exactly one round of N matches: `[[bout_1, bout_2, …, bout_N]]` |
| `losersBracket` | `[]` |
| `grandFinal` | TBD stub (kept for shape compatibility, never played) |
| `superFinal` | TBD stub, `needed: false` |
| `champion` | **always `null`** (no event-level champion — decision §2.1) |
| `status` | `'active'` → `'completed'` when every bout is `'completed'` or `'walkover'` |

### 4.2. `Match` for a bo5 bout

`Match` is **not** extended with new fields. Bo5-specific data lives in the opaque `result` field (Phase 3.2 design intent — see `types.ts:31-33`), typed as `ArmfightBoutResult`:

```ts
export type ArmfightHand = 'left' | 'right';
export type LegWinType = 'pin' | 'foul' | 'dq';
export type ArmfightBoutStatus = 'pending' | 'in_progress' | 'completed' | 'walkover';

export interface ArmfightLeg {
  index: number;            // 1..5, strictly monotonic
  winnerId: string;         // must equal Match.player1.id or Match.player2.id
  winType: LegWinType;
  enteredBy?: string | null;
  enteredAt?: string | null;
}

export interface ArmfightBoutResult {
  hand: ArmfightHand;
  legs: ArmfightLeg[];      // 0..5, append-only until the bout closes
  scoreA: number;           // count of legs won by Match.player1; derived but cached
  scoreB: number;           // count of legs won by Match.player2
  status: ArmfightBoutStatus;
  walkoverReason?: string | null;  // only set when status === 'walkover'
}
```

`Match.id` follows the existing convention: `wb_1_{i}` where `i` is the 0-based pair index in `pairs[]`. `Match.player1 = pairs[i].playerA, Match.player2 = pairs[i].playerB`. `seed = i*2 + 1` and `i*2 + 2` for stable ordering.

### 4.3. Bout lifecycle

```
[pending]
  ├─ recordLeg #1     → [in_progress]  legs.length = 1
  ├─ recordLeg #2     → [in_progress]  legs.length = 2
  ├─ recordLeg #3..5  → if scoreA === 3 or scoreB === 3
  │                       → [completed], match.winner = winner, match.loser = opponent
  │                     else
  │                       → [in_progress]
  └─ forfeitBout(winnerId, [reason]) → [walkover]
                                       match.winner = winnerId, match.loser = opponent
                                       legs frozen as-is
```

Engine-enforced invariants:

1. `legs.length ≤ 5`.
2. `legs[].index` is strictly monotonic and ∈ `{1, …, 5}`.
3. `legs[].winnerId ∈ {player1.id, player2.id}`; never `'bye'` / `'tbd'`.
4. `recordLeg` rejected when `status ∈ {completed, walkover}` (throws `Error('bout closed')`).
5. The leg that produces `scoreA === 3` or `scoreB === 3` is the **last** leg — subsequent `recordLeg` for the same bout throws.
6. `hand` is set at `generateArmfight` time and never mutated.
7. `forfeitBout` rejected on `completed` and `walkover` bouts.
8. `replacePlayerInSlot` / `withdrawPlayerFromSlot` allowed only while `status === 'pending'` (i.e. no legs recorded yet).

### 4.4. Event finalisation

`finalizeArmfight` (rewrites the current implementation at `bracket-logic.ts:537`):

- iterates every bout in `winnersBracket[0]`;
- if every bout has `result.status` of `'completed'` or `'walkover'`, sets `data.status = 'completed'`;
- otherwise leaves `data.status = 'active'`;
- **never** sets `data.champion` for armfight — it stays `null` (§2.1).

### 4.5. `getFinalPlacements` for armfight

Returns `[]` for `format === 'armfight'`. A fight card has no ranking — bouts are independent. The current behaviour at `bracket-logic.ts:1391-1403` (returning 1st / 2nd from the single match) is removed; a one-pair card now also returns `[]`. This is a deliberate semantic change covered by an explicit test.

---

## 5. Engine API

### 5.1. `generateArmfight` (signature change)

```ts
export interface ArmfightPairSpec {
  playerA: Player;
  playerB: Player;
  hand: ArmfightHand;
  order?: number;             // optional display order; defaults to array index + 1
}

export function generateArmfight(pairs: ArmfightPairSpec[]): BracketData;
```

**Throws** on:

- `pairs.length === 0`
- any pair with `playerA.id === playerB.id`
- any pair containing a player whose `id` is `'bye'` or `'tbd'`
- the same `playerId` appearing in two different pairs (a player fights at most once on a card)
- `hand` not in `{'left', 'right'}`

**Returns** a fully-populated `BracketData` per §4.1 with every `Match.result` initialised to `{ hand, legs: [], scoreA: 0, scoreB: 0, status: 'pending' }`.

### 5.2. New scoring operations

```ts
export interface RecordLegOptions {
  enteredBy?: string | null;
  enteredAt?: string | null;     // ISO string; default new Date().toISOString()
}

/**
 * Append a leg result to a pending/in_progress armfight bout.
 * Mutates `data` in place.
 */
export function recordLeg(
  data: BracketData,
  boutId: string,
  legIndex: number,
  winnerId: string,
  winType: LegWinType,
  options?: RecordLegOptions,
): void;

/**
 * Close a bout as walkover. Sets match.winner/loser and status='walkover';
 * existing legs stay; no further legs may be recorded.
 */
export function forfeitBout(
  data: BracketData,
  boutId: string,
  winnerId: string,
  options?: { walkoverReason?: string; enteredBy?: string | null },
): void;

/** Pure derivation; does not mutate `data`. */
export function getBoutScore(
  data: BracketData,
  boutId: string,
): { a: number; b: number; status: ArmfightBoutStatus; leadingId: string | null };

/** Narrows `unknown` to `ArmfightBoutResult` — used by `validateResult` and API. */
export function isArmfightBoutResult(x: unknown): x is ArmfightBoutResult;
```

`recordLeg` throws on:

- bout not found by id;
- `data.format !== 'armfight'`;
- `result.status` already `'completed'` or `'walkover'`;
- `winnerId` not in `{match.player1.id, match.player2.id}`;
- `legIndex !== legs.length + 1` (must be the next leg in sequence);
- `winType` not in the enum;
- `legIndex > 5`.

`forfeitBout` throws on:

- bout not found;
- `data.format !== 'armfight'`;
- `result.status` already `'completed'` or `'walkover'`;
- `winnerId` not in pair.

### 5.3. Existing functions — armfight integration

| Function | Behaviour for `format === 'armfight'` |
|---|---|
| `propagateResults` | If `result.status` is `'completed'` or `'walkover'` and `match.winner` is null, set `match.winner` from the result and `match.loser` to the opponent. Then call `finalizeArmfight`. No cross-pair propagation. |
| `finalizeArmfight` | See §4.4. |
| `selectWinner` | Throws `Error('use recordLeg/forfeitBout for armfight bouts')`. |
| `isPlayableMatch` | Returns `result.status === 'pending' || 'in_progress'`. |
| `findMatch` | Unchanged; the `wb_1_{i}` id scheme works as-is. |
| `walkBracketMatches` | Unchanged; armfight bouts live in `winnersBracket` and are walked naturally. |
| `resetMatch` | Resets `result` to `{ hand, legs: [], scoreA: 0, scoreB: 0, status: 'pending' }` (`hand` preserved). Clears `match.winner`/`loser`/`enteredBy`/`correctedBy`. |
| `canRecordResult` | Returns `result.status === 'pending' || 'in_progress'`. |
| `validateResult` | Calls `isArmfightBoutResult`, then asserts `scoreA + scoreB === legs.length` and that `(scoreA === 3 || scoreB === 3) ↔ status === 'completed'` (or `status === 'walkover'`). |
| `replacePlayerInSlot` / `withdrawPlayerFromSlot` | Allowed only when `result.status === 'pending'`. Throws otherwise. |
| `getFinalPlacements` | Returns `[]` per §4.5. |

### 5.4. Index exports added

```ts
// from './bracket-logic'
recordLeg, forfeitBout, getBoutScore, isArmfightBoutResult,

// from './types'
type ArmfightHand, type LegWinType, type ArmfightBoutStatus,
type ArmfightLeg, type ArmfightBoutResult, type ArmfightPairSpec,
type RecordLegOptions,
```

`generateArmfight` is already exported; only its signature changes.

---

## 6. API (`apps/api`)

### 6.1. `GenerateBracketDto` extension

In `apps/api/src/brackets/dto/generate-bracket.dto.ts`, add:

```ts
class ArmfightPairDto {
  @ApiProperty() @IsUUID() playerAId!: string;
  @ApiProperty() @IsUUID() playerBId!: string;
  @ApiProperty({ enum: ['left', 'right'] }) @IsIn(['left', 'right']) hand!: 'left' | 'right';
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) order?: number;
}

// inside GenerateBracketDto:
@ApiProperty({ required: false, type: [ArmfightPairDto] })
@IsOptional()
@ValidateIf((o) => o.format === 'armfight')
@ArrayMinSize(1)
@ValidateNested({ each: true })
@Type(() => ArmfightPairDto)
pairs?: ArmfightPairDto[];
```

The controller-level pipe returns **400** for: `format === 'armfight' && !pairs`, `pairs.length === 0`, any pair with `playerAId === playerBId`.

### 6.2. `BracketsService.buildBracket` (armfight branch)

Currently at `brackets.service.ts:332-347`. Updated armfight branch:

- if `dto.pairs` is provided: resolve each `{playerAId, playerBId}` to `Player` objects (via the existing entries/players resolution path), build `ArmfightPairSpec[]`, call `generateArmfight(pairs)`;
- if `dto.pairs` is missing and the caller is the legacy 2-player path through `generateForGroup` — **reject with `BadRequestException('Armfight bracket requires explicit pairs[]; use POST /v1/brackets with pairs[].')`**. `generateForGroup`'s "all entries become participants" model does not fit a curated fight card.
- the current line 340-344 `players.length !== 2` validation is removed.

### 6.3. New scoring endpoints

In `apps/api/src/brackets/brackets.controller.ts`:

```
POST /v1/brackets/:id/legs       body: RecordLegDto { boutId, legIndex, winnerId, winType }
POST /v1/brackets/:id/forfeit    body: ForfeitBoutDto { boutId, winnerId, walkoverReason? }
GET  /v1/brackets/:id/bouts      → BoutSnapshot[]
```

All three are guarded by `JwtAuthGuard` + role check `referee` or `organizer` (existing pattern from the current `selectWinner` endpoint).

`BoutSnapshot` is the response shape of `GET /bouts`:

```ts
interface BoutSnapshot {
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

The service builds this by iterating `bracketData.winnersBracket[0]` and calling `getBoutScore` per match. The endpoint exists so the frontend doesn't have to reimplement the derivation; controllers remain thin (logic lives in service).

### 6.4. `matchResultSchema` resolution

`MatchResultSchema` in `packages/shared-types/src/index.ts:24-29` gains a new value `'armfight_bo5'` alongside `'simple_winner' | 'armwrestling' | 'score' | 'time' | 'points'`. The resolver in `BracketsService` (around `brackets.service.ts:273`) returns `'armfight_bo5'` whenever the resolved format is `'armfight'`, overriding the sport's default schema. This is independent of `competitionType` resolution — it triggers off the **resolved bracket format**.

The API-side `validateResult` for `'armfight_bo5'` delegates to the engine-exported `isArmfightBoutResult` plus `validateResult` — no duplicated logic.

### 6.5. Not changed in this sub-project

- **No DB migrations.** `brackets.bracketData` is JSONB; the new `ArmfightBoutResult` fields nest inside `Match.result` in the same column. No entity / SQL changes.
- **No new entities.** Pairs are computed and live inside `BracketData`; no `ArmfightBout` table.
- **No changes to `WeightCategory` / `Entry` / `Tournament` entities.**

---

## 7. Testing

Coverage target: **≥ 90%** for `packages/bracket-engine/src/bracket-logic.ts` (statements, branches, functions, lines) — enforced via `vitest.config.ts`:

```ts
coverage: {
  thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
  include: ['src/bracket-logic.ts'],
}
```

### 7.1. `packages/bracket-engine/src/bracket-logic.spec.ts`

The existing armfight block (`bracket-logic.spec.ts:2723-2840`) is rewritten and expanded. Target ≥ 30 new test cases organised by group:

- **`generateArmfight` validations** — empty pairs, self-pair, BYE/TBD in a pair, same player in two pairs, invalid hand.
- **`generateArmfight` structure** — `bracketSize`, `wbRounds`, ids `wb_1_0..wb_1_{N-1}`, `champion === null`, `status === 'active'`, TBD grand/super final, player de-dup, initial `Match.result` shape.
- **`generateArmfight` 1-pair case** — covers the old legacy semantics under the new shape (no champion, `result` initialised, no rooms for the old 1st/2nd placements).
- **`recordLeg` validations** — bout not found; wrong format; bout completed; bout walkover; winnerId not in pair; legIndex out-of-order; winType invalid; legIndex > 5.
- **`recordLeg` behaviour** — leg 1 transitions `pending → in_progress`; score increments; 3-0 path (3 legs); 3-1 path (4 legs); 3-2 path (5 legs); 2-3 path (player B wins); audit fields written; each `winType ∈ {pin, foul, dq}` exercised.
- **`recordLeg` boundary** — 4th leg after `scoreA === 3` rejected; recording legs after walkover rejected.
- **`forfeitBout`** — pristine bout, mid-bout (e.g. after 2-1), winnerId outside pair, double-forfeit, forfeit-after-complete.
- **`getBoutScore`** — pending, in-progress (with leadingId tie at 2-2), completed, walkover.
- **`propagateResults`** — bout reaching 3-0 sets `match.winner`; walkover propagates; non-armfight brackets unaffected.
- **`finalizeArmfight`** — single pair completed → bracket completed; 5 pairs mixed states; all completed/walkover combinations; `champion` always null.
- **`selectWinner`** on armfight bout — throws.
- **`isPlayableMatch`** — pending/in-progress true; completed/walkover false.
- **`resetMatch`** — clears legs, score, status, winner/loser; `hand` preserved.
- **`canRecordResult`** — pending/in-progress true; completed/walkover false.
- **`validateResult`** — score consistency violations; null result; correct shapes.
- **`getFinalPlacements`** — returns `[]` (explicit test with comment explaining the deliberate change from the old behaviour).
- **`replacePlayerInSlot` / `withdrawPlayerFromSlot`** — pending allowed; in_progress / completed / walkover rejected.
- **`walkBracketMatches` / `findMatch`** — armfight bouts iterated and found.

### 7.2. `apps/api/src/brackets/brackets.service.spec.ts`

Engine functions remain mocked (current pattern at `brackets.service.spec.ts:78-82`). Added cases:

- `generate` with `format: 'armfight'` and N=3 pairs — happy path, calls `generateArmfight` with resolved players.
- DTO validation rejections: missing `pairs`, empty `pairs`, duplicated player, invalid `hand` → 400.
- `generateForGroup` with armfight → `BadRequestException`.
- `recordLegResult` service method — calls engine, persists, broadcasts; non-referee / non-organizer caller → `ForbiddenException`.
- `forfeitBout` service method — same role check.
- `matchResultSchema` resolution returns `'armfight_bo5'` for format `'armfight'`.

### 7.3. Out of test scope for B

- e2e Playwright (per `CLAUDE.md` "Testing & Quality Roadmap" — step 5; we are still on step 2).
- UI / component tests for an admin pair-builder (no UI in this sub-project).
- Load / stress tests on `recordLeg` (websocket broadcast layer is out of scope).

### 7.4. Lint gate

`npx turbo lint && npx turbo test` must pass on the final commit. Coverage gate runs as part of `npx turbo test` once thresholds are wired into `packages/bracket-engine/vitest.config.ts`.

---

## 8. Migration / breaking changes

### 8.1. Production data check (first task in the impl plan)

Before any code change, query the DB:

```sql
SELECT id, "bracketData"->'format' AS format
FROM brackets
WHERE "bracketData"->>'format' = 'armfight';
```

- **0 rows** → no data migration needed; the breaking change is safe.
- **>0 rows** → write a one-shot script `apps/api/scripts/migrate-armfight-data.ts` that converts each old-shape match (`winnersBracket: [[ singleMatch ]]`, `result: null` or non-armfight result) into the new shape by:
  - reading `match.winner` and `match.loser` (if any);
  - if no winner: set `result = { hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' }`;
  - if winner present: synthesise 3 `pin` legs all going to the winner (status `'completed'`), `scoreA`/`scoreB` accordingly, `enteredBy: 'migration'`, `enteredAt` = bracket's existing timestamp;
  - the script is idempotent (re-running on already-migrated brackets is a no-op detected by inspecting `result.status`).

### 8.2. Breaking API changes

| API | Change | Known consumers |
|---|---|---|
| `generateArmfight(players)` → `generateArmfight(pairs)` | engine signature | `apps/api/src/brackets/brackets.service.ts:345`; `brackets.service.spec.ts:641-658` |
| `BracketData.champion` for armfight always `null` | semantics | `getFinalPlacements` (internal); the frontend currently does not surface an armfight champion (verified during spec drafting: `grep -rn 'armfight.*champion' apps/web/src` returned no matches) |
| `Match.result` for armfight is now non-null and `ArmfightBoutResult`-shaped | runtime invariant | the engine's own `validateResult` + the API match-result validator (which is rewritten to delegate to the engine) |
| `getFinalPlacements` returns `[]` for armfight (was 1 or 2 entries) | semantics | covered by a deliberate test; team-scoring code (`apps/api/src/teams`, if any) does not pull armfight placements (verified during impl by grep) |
| `GET /v1/brackets/:id` response: `winnersBracket[0]` now contains N matches for armfight | shape | the frontend has no `apps/web/src/components/bracket*` directory at all (verified during spec drafting via `find apps/web/src/components -type d -name 'bracket*'`) — no bracket UI consumer exists yet |

The first step of the impl plan will be a grep-pass for these consumers; anything unexpected gets a follow-up patch in this sub-project (not in a later one).

### 8.3. No backward-compat shim

The legacy 2-player `generateArmfight(Player[])` signature is **not** kept as a deprecated alias. A one-pair card is the natural one-pair shape under the new API. The handful of test cases that called the old form are rewritten under the new form.

### 8.4. No feature flag

Armfight has no production-critical traffic. A flag would only add carry weight.

---

## 9. Conventions Compliance Checklist

- [ ] No business logic in controllers (scoring + bout snapshot in `BracketsService`).
- [ ] DTOs with `class-validator` decorators (`ArmfightPairDto`, `RecordLegDto`, `ForfeitBoutDto`).
- [ ] Engine has no framework dependencies (pure TypeScript) — preserved.
- [ ] Bracket-engine ≥ 90% coverage on `bracket-logic.ts` enforced by `vitest.config.ts`.
- [ ] No TypeORM migration required (JSONB column).
- [ ] No `console.log` in production code — engine uses pure returns/throws; service uses NestJS `Logger`.
- [ ] All endpoints under `/v1/`.
- [ ] Conventional commits: `feat(bracket)`, `feat(api)`, `test(bracket)`, `chore(bracket)`.
- [ ] Branch name: `feature/armfight-rules` (or `feature/armfight-card` — either is fine).

---

## 10. Implementation order (preview for the writing-plans pass)

Sketch of the task sequence the writing-plans skill will turn into a checkbox-tracked plan:

1. Production-data check (§8.1).
2. Grep-pass for breaking-change consumers (§8.2).
3. `packages/bracket-engine`: new types in `types.ts`; index exports.
4. TDD: `generateArmfight` validations + structure (rewrite existing block, expand).
5. TDD: `recordLeg` validations + behaviour.
6. TDD: `forfeitBout`, `getBoutScore`, `isArmfightBoutResult`.
7. Update `propagateResults`, `finalizeArmfight`, `selectWinner` guard, `isPlayableMatch`, `resetMatch`, `canRecordResult`, `validateResult`, `getFinalPlacements`, `replacePlayerInSlot` / `withdrawPlayerFromSlot` — each with tests.
8. Wire coverage thresholds; run `npx vitest run --coverage`; ensure ≥ 90% on `bracket-logic.ts`.
9. `@gsm/shared-types`: add `'armfight_bo5'` to `MatchResultSchema`.
10. `apps/api`: `GenerateBracketDto` extension + `ArmfightPairDto`.
11. `apps/api`: `BracketsService.buildBracket` armfight branch + reject armfight via `generateForGroup`.
12. `apps/api`: new endpoints `POST /legs`, `POST /forfeit`, `GET /bouts` + DTOs + service methods + tests.
13. `apps/api`: update `matchResultSchema` resolver for armfight.
14. Update existing `brackets.service.spec.ts` armfight cases for the new DTO shape.
15. Final gate: `npx turbo lint && npx turbo test` (coverage gate included).

**Explicitly deferred** (not in B): admin wizard "pairs builder" step; operator UI for live leg-by-leg entry; spectator broadcast UI; websocket per-leg push. These build on top of the stable engine + API delivered here.
