import type { MatchResult, MatchResultSchema } from '@gsm/shared-types';
import type { Match, GrandFinalMatch } from '@gsm/bracket-engine';
import { isArmfightBoutResult } from '@gsm/bracket-engine';

/**
 * Validation for the sport-specific `result` payload attached to a
 * recorded match (Phase 3.2). Pure helper — no Nest imports — so the
 * service layer stays thin. Returns a list of human-readable error
 * messages; an empty array means the payload is valid.
 *
 * Two invariants guide what each schema checks:
 *   1. The payload's `schema` field must equal the tournament's
 *      `SportConfig.matchResultSchema`. Sending `armwrestling` detail
 *      to a boxing match is a client bug, not a silent write.
 *   2. Any `winnerId` carried inside the payload (armwrestling rounds)
 *      must reference a real player in *this* match. Fouls use player
 *      ids as object keys — same rule applies.
 *
 * We deliberately don't re-validate the outer `Match.winnerId` here —
 * that's already enforced by `validateResult` in bracket-engine.
 */
export function validateMatchResult(
  result: unknown,
  expectedSchema: MatchResultSchema,
  match: Match | GrandFinalMatch,
): string[] {
  const errors: string[] = [];

  if (result === null || typeof result !== 'object') {
    errors.push('result must be an object');
    return errors;
  }
  const r = result as Record<string, unknown>;

  const schema = r.schema;
  if (schema !== expectedSchema) {
    errors.push(
      `result.schema '${String(schema)}' does not match the sport's expected schema '${expectedSchema}'`,
    );
    // Keep checking shape — returning early hides other bugs the client
    // can fix in the same round trip.
  }

  const playerIds = new Set<string>([match.player1.id, match.player2.id]);

  switch (expectedSchema) {
    case 'simple_winner':
      assertOptionalString(r, 'notes', errors);
      break;

    case 'armwrestling': {
      if (
        r.victoryType !== 'pin' &&
        r.victoryType !== 'points' &&
        r.victoryType !== 'fouls' &&
        r.victoryType !== 'dq'
      ) {
        errors.push(
          "armwrestling: victoryType must be one of 'pin' | 'points' | 'fouls' | 'dq'",
        );
      }
      if (r.rounds !== undefined) {
        if (!Array.isArray(r.rounds)) {
          errors.push('armwrestling: rounds must be an array');
        } else {
          r.rounds.forEach((round, i) => {
            if (!round || typeof round !== 'object') {
              errors.push(`armwrestling: rounds[${i}] must be an object`);
              return;
            }
            const row = round as Record<string, unknown>;
            if (typeof row.winnerId !== 'string' || !playerIds.has(row.winnerId)) {
              errors.push(
                `armwrestling: rounds[${i}].winnerId must be one of the match players`,
              );
            }
            if (row.durationMs !== undefined) {
              if (
                typeof row.durationMs !== 'number' ||
                !Number.isFinite(row.durationMs) ||
                row.durationMs < 0
              ) {
                errors.push(
                  `armwrestling: rounds[${i}].durationMs must be a non-negative number`,
                );
              }
            }
          });
        }
      }
      if (r.fouls !== undefined) {
        if (!r.fouls || typeof r.fouls !== 'object' || Array.isArray(r.fouls)) {
          errors.push('armwrestling: fouls must be an object keyed by player id');
        } else {
          for (const [key, value] of Object.entries(r.fouls as Record<string, unknown>)) {
            if (!playerIds.has(key)) {
              errors.push(
                `armwrestling: fouls key '${key}' is not a player in this match`,
              );
            }
            if (
              typeof value !== 'number' ||
              !Number.isInteger(value) ||
              value < 0
            ) {
              errors.push(`armwrestling: fouls.${key} must be a non-negative integer`);
            }
          }
        }
      }
      assertOptionalString(r, 'notes', errors);
      break;
    }

    case 'score': {
      if (!Array.isArray(r.periods) || r.periods.length === 0) {
        errors.push('score: periods must be a non-empty array');
      } else {
        r.periods.forEach((p, i) => {
          if (!p || typeof p !== 'object') {
            errors.push(`score: periods[${i}] must be an object`);
            return;
          }
          const row = p as Record<string, unknown>;
          if (!isNonNegativeInt(row.player1)) {
            errors.push(`score: periods[${i}].player1 must be a non-negative integer`);
          }
          if (!isNonNegativeInt(row.player2)) {
            errors.push(`score: periods[${i}].player2 must be a non-negative integer`);
          }
        });
      }
      if (!isNonNegativeInt(r.finalPlayer1)) {
        errors.push('score: finalPlayer1 must be a non-negative integer');
      }
      if (!isNonNegativeInt(r.finalPlayer2)) {
        errors.push('score: finalPlayer2 must be a non-negative integer');
      }
      assertOptionalString(r, 'notes', errors);
      break;
    }

    case 'points': {
      if (!Array.isArray(r.cards) || r.cards.length === 0) {
        errors.push('points: cards must be a non-empty array');
      } else {
        r.cards.forEach((c, i) => {
          if (!c || typeof c !== 'object') {
            errors.push(`points: cards[${i}] must be an object`);
            return;
          }
          const row = c as Record<string, unknown>;
          if (!isNonNegativeInt(row.player1)) {
            errors.push(`points: cards[${i}].player1 must be a non-negative integer`);
          }
          if (!isNonNegativeInt(row.player2)) {
            errors.push(`points: cards[${i}].player2 must be a non-negative integer`);
          }
          if (row.judge !== undefined && typeof row.judge !== 'string') {
            errors.push(`points: cards[${i}].judge must be a string`);
          }
        });
      }
      assertOptionalString(r, 'notes', errors);
      break;
    }

    case 'time': {
      if (!isNonNegativeInt(r.player1Ms)) {
        errors.push('time: player1Ms must be a non-negative integer');
      }
      if (!isNonNegativeInt(r.player2Ms)) {
        errors.push('time: player2Ms must be a non-negative integer');
      }
      assertOptionalString(r, 'notes', errors);
      break;
    }

    case 'armfight_bo5': {
      if (!isArmfightBoutResult(r as unknown)) {
        errors.push('armfight_bo5: payload is not a valid ArmfightBoutResult');
        break;
      }
      // `isArmfightBoutResult` only checks `Array.isArray(r.legs)` — not
      // element shape. Per-element guard before dereferencing winnerId so
      // a malicious `legs: [null]` payload doesn't TypeError into a 500.
      const legs = (r as unknown as { legs: unknown[] }).legs;
      legs.forEach((leg, i) => {
        if (!leg || typeof leg !== 'object') {
          errors.push(`armfight_bo5: legs[${i}] must be an object`);
          return;
        }
        const winnerId = (leg as Record<string, unknown>).winnerId;
        if (typeof winnerId !== 'string' || !playerIds.has(winnerId)) {
          errors.push(`armfight_bo5: legs[${i}].winnerId must be one of the match players`);
        }
      });
      const { scoreA, scoreB, status } = r as unknown as {
        scoreA: number; scoreB: number; status: string;
      };
      if (scoreA + scoreB !== legs.length) {
        errors.push('armfight_bo5: scoreA + scoreB must equal legs.length');
      }
      const decided = scoreA === 3 || scoreB === 3;
      if (decided && status !== 'completed' && status !== 'walkover') {
        errors.push('armfight_bo5: bout reached 3 legs but status is not completed/walkover');
      }
      break;
    }

    default: {
      // Future-proof: a new schema in shared-types without a validator
      // case here should fail closed rather than silently accepting any
      // object as valid.
      const _exhaustive: never = expectedSchema;
      errors.push(`Unsupported matchResultSchema: ${String(_exhaustive)}`);
    }
  }

  return errors;
}

/** Narrow a validated blob to its `MatchResult` type. Call after `validateMatchResult` returns no errors. */
export function asMatchResult(validated: unknown): MatchResult {
  return validated as MatchResult;
}

function assertOptionalString(
  r: Record<string, unknown>,
  key: string,
  errors: string[],
): void {
  if (r[key] === undefined) return;
  if (typeof r[key] !== 'string') {
    errors.push(`${key} must be a string`);
  } else if ((r[key] as string).length > 500) {
    errors.push(`${key} must be 500 characters or fewer`);
  }
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}
