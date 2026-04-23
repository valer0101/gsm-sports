import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Idempotency record for match-related Telegram notifications. One row per
 * `(tournamentId, matchId, kind)` — the unique constraint guarantees we
 * don't spam the same athlete twice if the reminder cron runs again or
 * the match briefly leaves and re-enters the 15-min window.
 *
 * `kind` is a short string (`'reminder_15m'`, `'opponent_withdrew'`, …)
 * so future notification types don't collide with existing dedupe rows.
 */
@Entity('match_notifications')
@Unique(['tournamentId', 'matchId', 'kind'])
export class MatchNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @Index()
  @Column({ name: 'match_id', type: 'varchar', length: 100 })
  matchId: string;

  @Column({ type: 'varchar', length: 50 })
  kind: string;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;
}
