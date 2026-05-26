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
