/**
 * @gsm/scheduler — pure-function ETA and table assignment for pending matches.
 *
 * Given N tables, a prioritised list of playable matches, per-match duration
 * and a minimum rest interval between an athlete's own matches, produce a
 * schedule of `{matchId, tableId, estimatedStartAt, estimatedEndAt}` rows.
 *
 * The function is deterministic, side-effect free, and framework-agnostic so
 * both the API (authoritative schedule) and the web client (optimistic local
 * recompute after each result) can call it with identical input and get the
 * same output.
 *
 * Algorithm (greedy FIFO, O(m·n) — tolerable at 200 athletes × 8 tables):
 *   1. For each table, seed `nextFreeAt` with its `currentMatchEstimatedEndAt`
 *      if busy, else `now`.
 *   2. Walk pending matches in the order the caller supplied (caller is
 *      responsible for bracket-round priority, seed order, etc — this keeps
 *      the scheduler sport-agnostic).
 *   3. For each match:
 *      - Compute `athleteReadyAt = max(lastFinishAt + minRest)` over both
 *        athletes — the earliest they may play again.
 *      - Pick the table with the smallest `nextFreeAt`. Ties broken by table
 *        id ascending so the output is stable.
 *      - `start = max(table.nextFreeAt, athleteReadyAt)`.
 *      - `end = start + avgMatchDuration`.
 *      - Advance `table.nextFreeAt = end` and both athletes' `lastFinishAt = end`.
 *
 * Known simplifications kept deliberately tiny for v1:
 *   - No look-ahead optimisation. A greedy pick on a long match may push a
 *     short one to a later table unnecessarily. Acceptable at the target scale.
 *   - Duration is a flat average. Real match durations vary by sport rules
 *     (armwrestling: pin in 5s vs 3 rounds), but the point of this layer is
 *     an ETA, not a stopwatch — drift is corrected on every recompute.
 *   - Min-rest is symmetrical for both athletes. Individual overrides can be
 *     added later via an `athleteRestOverrides: Map<id, number>` parameter
 *     without changing callers.
 */

/** Lightweight representation of a playing surface. */
export interface SchedulerTable {
  id: string;
  /** `busy` means a match is in progress; `offline` means skip entirely. */
  status: 'idle' | 'busy' | 'offline';
  /**
   * Only meaningful when `status === 'busy'`. ISO timestamp (or epoch ms —
   * both accepted). If absent, the scheduler falls back to `now` so the busy
   * table is treated as about to free up.
   */
  currentMatchEstimatedEndAt?: number | string | null;
}

/** Single pending match. Order of the input array is the scheduling priority. */
export interface SchedulerMatch {
  matchId: string;
  bracketId: string;
  /**
   * Stable IDs of the two athletes competing. Scheduler uses these for the
   * min-rest constraint only — it doesn't care about names or seeds.
   */
  athleteIds: [string, string];
}

export interface SchedulerInput {
  /** Reference "now" so callers can re-compute deterministically. */
  now: Date | number | string;
  /** Available tables. Offline tables are filtered out internally. */
  tables: SchedulerTable[];
  /** Pending matches in priority order (caller sorts). */
  pendingMatches: SchedulerMatch[];
  /** Typical duration of a match for this sport/tournament, in seconds. */
  avgMatchDurationSec: number;
  /** Minimum rest between an athlete's own matches, in seconds. */
  minRestBetweenMatchesSec: number;
  /**
   * Known last finish time per athlete (from earlier matches in THIS same
   * tournament). If an athlete isn't in the map, they're assumed available
   * from `now`. Keys: athlete id, values: epoch ms or ISO string.
   */
  athleteLastFinishAt?: Record<string, number | string | Date>;
}

export interface ScheduledMatch {
  matchId: string;
  bracketId: string;
  tableId: string;
  /** Epoch ms. Callers format for display. */
  estimatedStartAt: number;
  /** Epoch ms. */
  estimatedEndAt: number;
  /**
   * 1-based position of this match in the combined queue across ALL tables
   * (ordered by `estimatedStartAt`, tie-break by tableId). Useful for a
   * "you are #7 in line" banner.
   */
  order: number;
}

export interface SchedulerOutput {
  scheduled: ScheduledMatch[];
  /**
   * Matches that could not be placed because no table was online, or the
   * pending list was empty. Echoed back so the caller can show a warning.
   */
  unscheduled: SchedulerMatch[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function toEpoch(v: number | string | Date | null | undefined): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function requireEpoch(v: number | string | Date, field: string): number {
  const e = toEpoch(v);
  if (e === null) throw new Error(`${field} must be a valid date`);
  return e;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Compute schedule + ETA for every pending match.
 */
export function buildSchedule(input: SchedulerInput): SchedulerOutput {
  const { avgMatchDurationSec, minRestBetweenMatchesSec } = input;
  if (avgMatchDurationSec <= 0) {
    throw new Error('avgMatchDurationSec must be positive');
  }
  if (minRestBetweenMatchesSec < 0) {
    throw new Error('minRestBetweenMatchesSec cannot be negative');
  }

  const nowMs = requireEpoch(input.now, 'now');
  const durationMs = avgMatchDurationSec * 1000;
  const restMs = minRestBetweenMatchesSec * 1000;

  // Filter out offline tables; they can't receive matches.
  const workingTables = input.tables.filter((t) => t.status !== 'offline');

  if (workingTables.length === 0 || input.pendingMatches.length === 0) {
    return { scheduled: [], unscheduled: [...input.pendingMatches] };
  }

  // `nextFreeAt` per table, seeded from busy-match ETA where known.
  const tableNextFreeAt = new Map<string, number>();
  for (const t of workingTables) {
    if (t.status === 'busy') {
      const end = toEpoch(t.currentMatchEstimatedEndAt ?? null) ?? nowMs;
      tableNextFreeAt.set(t.id, Math.max(end, nowMs));
    } else {
      tableNextFreeAt.set(t.id, nowMs);
    }
  }

  // `lastFinishAt` per athlete, seeded from caller-provided history.
  const athleteLastFinishAt = new Map<string, number>();
  if (input.athleteLastFinishAt) {
    for (const [id, v] of Object.entries(input.athleteLastFinishAt)) {
      const e = toEpoch(v);
      if (e !== null) athleteLastFinishAt.set(id, e);
    }
  }

  const scheduled: ScheduledMatch[] = [];

  for (const match of input.pendingMatches) {
    // Earliest this match's participants may play.
    const [p1, p2] = match.athleteIds;
    const rest1 = (athleteLastFinishAt.get(p1) ?? 0) + restMs;
    const rest2 = (athleteLastFinishAt.get(p2) ?? 0) + restMs;
    const athleteReadyAt = Math.max(rest1, rest2, nowMs);

    // Pick table with smallest nextFreeAt, stable tie-break on id.
    let bestTableId: string | null = null;
    let bestFreeAt = Number.POSITIVE_INFINITY;
    for (const t of workingTables) {
      const freeAt = tableNextFreeAt.get(t.id)!;
      if (
        freeAt < bestFreeAt ||
        (freeAt === bestFreeAt && (bestTableId === null || t.id < bestTableId))
      ) {
        bestFreeAt = freeAt;
        bestTableId = t.id;
      }
    }
    // workingTables.length > 0 is guaranteed by the guard above.
    const tableId = bestTableId as string;

    const start = Math.max(bestFreeAt, athleteReadyAt);
    const end = start + durationMs;

    tableNextFreeAt.set(tableId, end);
    athleteLastFinishAt.set(p1, end);
    athleteLastFinishAt.set(p2, end);

    scheduled.push({
      matchId: match.matchId,
      bracketId: match.bracketId,
      tableId,
      estimatedStartAt: start,
      estimatedEndAt: end,
      order: 0, // filled after the loop, once we know global ordering
    });
  }

  // Global ordering by start time, then stable by tableId for ties.
  const ordered = [...scheduled].sort((a, b) => {
    if (a.estimatedStartAt !== b.estimatedStartAt) {
      return a.estimatedStartAt - b.estimatedStartAt;
    }
    return a.tableId.localeCompare(b.tableId);
  });
  ordered.forEach((m, i) => {
    m.order = i + 1;
  });

  // Preserve original insertion order in the returned array (so callers that
  // rely on "the order I asked about" keep it); the `order` field conveys
  // queue position.
  return { scheduled, unscheduled: [] };
}
