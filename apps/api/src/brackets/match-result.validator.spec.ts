import { describe, it, expect } from 'vitest';
import { validateMatchResult } from './match-result.validator';
import type { Match } from '@gsm/bracket-engine';

const makeMatch = (): Match => ({
  id: 'wb_1_0',
  round: 1,
  matchIndex: 0,
  player1: {
    id: 'p1',
    firstName: 'Alice',
    lastName: '',
    number: 1,
  },
  player2: {
    id: 'p2',
    firstName: 'Bob',
    lastName: '',
    number: 2,
  },
  winner: null,
  loser: null,
});

describe('validateMatchResult', () => {
  describe('structural checks', () => {
    it('rejects non-object payloads', () => {
      expect(validateMatchResult(null, 'armwrestling', makeMatch())).toContain(
        'result must be an object',
      );
      expect(validateMatchResult('oops', 'armwrestling', makeMatch())).toContain(
        'result must be an object',
      );
    });

    it('rejects mismatched schema field', () => {
      const errors = validateMatchResult(
        { schema: 'points', victoryType: 'pin' },
        'armwrestling',
        makeMatch(),
      );
      expect(
        errors.some((e) => e.includes('does not match') && e.includes('armwrestling')),
      ).toBe(true);
    });
  });

  describe('armwrestling', () => {
    it('accepts a minimal valid payload (pin, no rounds / fouls)', () => {
      const errors = validateMatchResult(
        { schema: 'armwrestling', victoryType: 'pin' },
        'armwrestling',
        makeMatch(),
      );
      expect(errors).toEqual([]);
    });

    it('accepts rounds + fouls tied to real players', () => {
      const errors = validateMatchResult(
        {
          schema: 'armwrestling',
          victoryType: 'points',
          rounds: [
            { winnerId: 'p1', durationMs: 12000 },
            { winnerId: 'p2' },
            { winnerId: 'p1', durationMs: 9000 },
          ],
          fouls: { p1: 0, p2: 2 },
        },
        'armwrestling',
        makeMatch(),
      );
      expect(errors).toEqual([]);
    });

    it('rejects invalid victoryType', () => {
      const errors = validateMatchResult(
        { schema: 'armwrestling', victoryType: 'tko' },
        'armwrestling',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('victoryType'))).toBe(true);
    });

    it('rejects rounds with a non-player winnerId', () => {
      const errors = validateMatchResult(
        {
          schema: 'armwrestling',
          victoryType: 'points',
          rounds: [{ winnerId: 'ghost-player' }],
        },
        'armwrestling',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('rounds[0].winnerId'))).toBe(true);
    });

    it('rejects negative round duration', () => {
      const errors = validateMatchResult(
        {
          schema: 'armwrestling',
          victoryType: 'pin',
          rounds: [{ winnerId: 'p1', durationMs: -500 }],
        },
        'armwrestling',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('durationMs'))).toBe(true);
    });

    it('rejects fouls keyed by a non-player id', () => {
      const errors = validateMatchResult(
        {
          schema: 'armwrestling',
          victoryType: 'fouls',
          fouls: { p1: 1, mystery: 3 },
        },
        'armwrestling',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('mystery'))).toBe(true);
    });

    it('rejects non-integer / negative foul counts', () => {
      expect(
        validateMatchResult(
          { schema: 'armwrestling', victoryType: 'fouls', fouls: { p1: 1.5 } },
          'armwrestling',
          makeMatch(),
        ).some((e) => e.includes('fouls.p1')),
      ).toBe(true);
      expect(
        validateMatchResult(
          { schema: 'armwrestling', victoryType: 'fouls', fouls: { p1: -1 } },
          'armwrestling',
          makeMatch(),
        ).some((e) => e.includes('fouls.p1')),
      ).toBe(true);
    });
  });

  describe('score', () => {
    it('accepts a minimal valid payload', () => {
      const errors = validateMatchResult(
        {
          schema: 'score',
          periods: [
            { player1: 21, player2: 18 },
            { player1: 19, player2: 21 },
            { player1: 21, player2: 15 },
          ],
          finalPlayer1: 61,
          finalPlayer2: 54,
        },
        'score',
        makeMatch(),
      );
      expect(errors).toEqual([]);
    });

    it('rejects empty periods', () => {
      const errors = validateMatchResult(
        { schema: 'score', periods: [], finalPlayer1: 0, finalPlayer2: 0 },
        'score',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('non-empty'))).toBe(true);
    });

    it('rejects non-integer period scores', () => {
      const errors = validateMatchResult(
        {
          schema: 'score',
          periods: [{ player1: 1.5, player2: 3 }],
          finalPlayer1: 1,
          finalPlayer2: 3,
        },
        'score',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('player1'))).toBe(true);
    });
  });

  describe('points', () => {
    it('accepts judge cards', () => {
      const errors = validateMatchResult(
        {
          schema: 'points',
          cards: [
            { judge: 'J1', player1: 30, player2: 27 },
            { judge: 'J2', player1: 29, player2: 28 },
            { judge: 'J3', player1: 28, player2: 29 },
          ],
        },
        'points',
        makeMatch(),
      );
      expect(errors).toEqual([]);
    });

    it('rejects empty cards array', () => {
      const errors = validateMatchResult(
        { schema: 'points', cards: [] },
        'points',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('non-empty'))).toBe(true);
    });
  });

  describe('time', () => {
    it('accepts finish times', () => {
      const errors = validateMatchResult(
        { schema: 'time', player1Ms: 48300, player2Ms: 49100 },
        'time',
        makeMatch(),
      );
      expect(errors).toEqual([]);
    });

    it('rejects negative times', () => {
      const errors = validateMatchResult(
        { schema: 'time', player1Ms: -1, player2Ms: 0 },
        'time',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('player1Ms'))).toBe(true);
    });
  });

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

  describe('simple_winner', () => {
    it('accepts just the schema field', () => {
      expect(
        validateMatchResult({ schema: 'simple_winner' }, 'simple_winner', makeMatch()),
      ).toEqual([]);
    });

    it('accepts an optional notes string', () => {
      expect(
        validateMatchResult(
          { schema: 'simple_winner', notes: 'clean match' },
          'simple_winner',
          makeMatch(),
        ),
      ).toEqual([]);
    });

    it('rejects notes >500 chars', () => {
      const errors = validateMatchResult(
        { schema: 'simple_winner', notes: 'x'.repeat(501) },
        'simple_winner',
        makeMatch(),
      );
      expect(errors.some((e) => e.includes('500'))).toBe(true);
    });
  });
});
