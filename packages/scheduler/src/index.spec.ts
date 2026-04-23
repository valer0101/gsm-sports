import { describe, it, expect } from 'vitest';
import { buildSchedule } from './index';
import type { SchedulerInput, SchedulerTable, SchedulerMatch } from './index';

const NOW = new Date('2026-05-01T10:00:00Z');
const nowMs = NOW.getTime();

const idleTable = (id: string): SchedulerTable => ({ id, status: 'idle' });

const match = (id: string, p1: string, p2: string): SchedulerMatch => ({
  matchId: id,
  bracketId: 'b-1',
  athleteIds: [p1, p2],
});

const baseInput = (overrides: Partial<SchedulerInput> = {}): SchedulerInput => ({
  now: NOW,
  tables: [idleTable('t1'), idleTable('t2')],
  pendingMatches: [],
  avgMatchDurationSec: 300, // 5 min
  minRestBetweenMatchesSec: 900, // 15 min
  ...overrides,
});

describe('buildSchedule', () => {
  describe('empty inputs', () => {
    it('returns empty when there are no pending matches', () => {
      const out = buildSchedule(baseInput({ pendingMatches: [] }));
      expect(out.scheduled).toEqual([]);
      expect(out.unscheduled).toEqual([]);
    });

    it('marks all matches unscheduled when there are no tables', () => {
      const matches = [match('m1', 'a', 'b'), match('m2', 'c', 'd')];
      const out = buildSchedule(baseInput({ tables: [], pendingMatches: matches }));
      expect(out.scheduled).toEqual([]);
      expect(out.unscheduled).toEqual(matches);
    });

    it('treats offline tables as nonexistent', () => {
      const out = buildSchedule(
        baseInput({
          tables: [{ id: 't1', status: 'offline' }],
          pendingMatches: [match('m1', 'a', 'b')],
        }),
      );
      expect(out.scheduled).toEqual([]);
      expect(out.unscheduled).toHaveLength(1);
    });
  });

  describe('greedy table fill', () => {
    it('fills idle tables in parallel with no shared athletes', () => {
      const out = buildSchedule(
        baseInput({
          pendingMatches: [
            match('m1', 'a', 'b'),
            match('m2', 'c', 'd'),
            match('m3', 'e', 'f'),
          ],
        }),
      );

      expect(out.scheduled).toHaveLength(3);
      // First two match start immediately on separate tables.
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs);
      expect(out.scheduled[1].estimatedStartAt).toBe(nowMs);
      expect(out.scheduled[0].tableId).not.toBe(out.scheduled[1].tableId);
      // Third waits for the first table to free up (5 min).
      expect(out.scheduled[2].estimatedStartAt).toBe(nowMs + 300_000);
    });

    it('assigns order 1..n by start time across tables', () => {
      const out = buildSchedule(
        baseInput({
          pendingMatches: [match('m1', 'a', 'b'), match('m2', 'c', 'd'), match('m3', 'e', 'f')],
        }),
      );
      expect(out.scheduled.map((s) => s.order).sort()).toEqual([1, 2, 3]);
    });

    it('end = start + duration', () => {
      const out = buildSchedule(baseInput({ pendingMatches: [match('m1', 'a', 'b')] }));
      expect(out.scheduled[0].estimatedEndAt - out.scheduled[0].estimatedStartAt).toBe(300_000);
    });
  });

  describe('busy table ETA', () => {
    it('waits until currentMatchEstimatedEndAt before placing next match', () => {
      const busyEnd = nowMs + 120_000; // table will free in 2 min
      const out = buildSchedule(
        baseInput({
          tables: [
            { id: 't1', status: 'busy', currentMatchEstimatedEndAt: busyEnd },
          ],
          pendingMatches: [match('m1', 'a', 'b')],
        }),
      );
      expect(out.scheduled[0].estimatedStartAt).toBe(busyEnd);
    });

    it('accepts ISO string for busy ETA', () => {
      const busyIso = new Date(nowMs + 60_000).toISOString();
      const out = buildSchedule(
        baseInput({
          tables: [{ id: 't1', status: 'busy', currentMatchEstimatedEndAt: busyIso }],
          pendingMatches: [match('m1', 'a', 'b')],
        }),
      );
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs + 60_000);
    });

    it('falls back to now when busy table has no ETA', () => {
      const out = buildSchedule(
        baseInput({
          tables: [{ id: 't1', status: 'busy' }],
          pendingMatches: [match('m1', 'a', 'b')],
        }),
      );
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs);
    });

    it('prefers idle table over busy one even if busy will free soon', () => {
      const out = buildSchedule(
        baseInput({
          tables: [
            { id: 't1', status: 'busy', currentMatchEstimatedEndAt: nowMs + 30_000 },
            idleTable('t2'),
          ],
          pendingMatches: [match('m1', 'a', 'b')],
        }),
      );
      expect(out.scheduled[0].tableId).toBe('t2');
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs);
    });
  });

  describe('min-rest between own matches', () => {
    it('defers a match if the athlete just finished and rest has not elapsed', () => {
      const out = buildSchedule(
        baseInput({
          pendingMatches: [match('m1', 'a', 'b')],
          athleteLastFinishAt: {
            a: nowMs - 300_000, // A finished 5 min ago; needs 15 min rest → 10 min to go
          },
        }),
      );
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs - 300_000 + 900_000);
    });

    it('uses the later-finishing athlete to set the floor', () => {
      const out = buildSchedule(
        baseInput({
          pendingMatches: [match('m1', 'a', 'b')],
          athleteLastFinishAt: {
            a: nowMs - 600_000, // 10 min ago — 5 min rest left
            b: nowMs - 120_000, // 2 min ago — 13 min rest left
          },
        }),
      );
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs - 120_000 + 900_000);
    });

    it('does not defer when rest has fully elapsed', () => {
      const out = buildSchedule(
        baseInput({
          pendingMatches: [match('m1', 'a', 'b')],
          athleteLastFinishAt: {
            a: nowMs - 1_200_000, // 20 min ago — fully rested
          },
        }),
      );
      expect(out.scheduled[0].estimatedStartAt).toBe(nowMs);
    });

    it('chains min-rest across scheduled matches', () => {
      // Same athlete plays m1 and m3 on the same table — the second one should
      // push past the rest window even though the table would be free earlier.
      const out = buildSchedule(
        baseInput({
          tables: [idleTable('t1')],
          pendingMatches: [
            match('m1', 'a', 'b'),
            match('m2', 'c', 'd'),
            match('m3', 'a', 'e'),
          ],
          avgMatchDurationSec: 60, // 1 min matches
          minRestBetweenMatchesSec: 600, // 10 min rest
        }),
      );
      // m1 finishes at now+60s; a must wait +600s more before m3 can run.
      const m3 = out.scheduled.find((s) => s.matchId === 'm3')!;
      expect(m3.estimatedStartAt).toBeGreaterThanOrEqual(nowMs + 60_000 + 600_000);
    });
  });

  describe('stable output', () => {
    it('breaks ties on table id ascending (deterministic)', () => {
      const out = buildSchedule(
        baseInput({
          tables: [idleTable('t2'), idleTable('t1')], // intentionally reversed
          pendingMatches: [match('m1', 'a', 'b')],
        }),
      );
      // Both tables free at `now`; tie → lexicographically smallest id wins.
      expect(out.scheduled[0].tableId).toBe('t1');
    });

    it('is referentially deterministic for the same input', () => {
      const input = baseInput({
        pendingMatches: [match('m1', 'a', 'b'), match('m2', 'c', 'd'), match('m3', 'e', 'f')],
      });
      const a = buildSchedule(input);
      const b = buildSchedule(input);
      expect(a).toEqual(b);
    });
  });

  describe('validation', () => {
    it('rejects non-positive match duration', () => {
      expect(() =>
        buildSchedule(baseInput({ avgMatchDurationSec: 0, pendingMatches: [match('m1', 'a', 'b')] })),
      ).toThrow(/avgMatchDurationSec/);
    });

    it('rejects negative rest', () => {
      expect(() =>
        buildSchedule(
          baseInput({ minRestBetweenMatchesSec: -1, pendingMatches: [match('m1', 'a', 'b')] }),
        ),
      ).toThrow(/minRestBetweenMatchesSec/);
    });

    it('rejects invalid now', () => {
      expect(() =>
        buildSchedule(baseInput({ now: 'not a date', pendingMatches: [match('m1', 'a', 'b')] })),
      ).toThrow(/now/);
    });
  });
});
