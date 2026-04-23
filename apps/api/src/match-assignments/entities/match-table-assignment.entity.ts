import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { TournamentTable } from '../../tournaments/entities/tournament-table.entity';
import { Bracket } from '../../brackets/entities/bracket.entity';

/**
 * Pins a specific match (identified by its bracket-engine id) to a playing
 * surface inside a tournament. One row per match-to-table event — when a
 * match is re-assigned or replayed (e.g. after a reset) a new row is created.
 *
 * Active assignment = `finishedAt IS NULL`. The service layer enforces that
 * at most one active assignment exists per match.
 */
@Entity('match_table_assignments')
export class MatchTableAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @Index()
  @ManyToOne(() => Bracket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bracket_id' })
  bracket: Bracket;

  @Column({ name: 'bracket_id', type: 'uuid' })
  bracketId: string;

  /** Match ID within the bracket's engine structure (e.g. "w-0-0"). */
  @Index()
  @Column({ name: 'match_id', type: 'varchar', length: 100 })
  matchId: string;

  @Index()
  @ManyToOne(() => TournamentTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: TournamentTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId: string;

  /** User who claimed the match to the table (operator / organizer / admin). */
  @Column({ name: 'claimed_by', type: 'uuid', nullable: true })
  claimedBy: string | null;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
