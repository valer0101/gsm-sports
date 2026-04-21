import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Bracket } from './bracket.entity';
import { User } from '../../users/entities/user.entity';

export type AuditAction =
  | 'result_recorded'
  | 'result_corrected'
  | 'match_reset'
  | 'bracket_reset'
  | 'bracket_locked'
  | 'bracket_unlocked'
  | 'player_replaced'
  | 'player_withdrawn';

@Entity('bracket_audit_logs')
@Index(['bracketId', 'createdAt'])
export class BracketAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Bracket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bracket_id' })
  bracket: Bracket;

  @Column({ name: 'bracket_id' })
  bracketId: string;

  /** Which match was affected (null for bracket-level actions like reset/lock) */
  @Column({ name: 'match_id', type: 'varchar', length: 100, nullable: true })
  matchId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedByUser: User | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  /** Bracket/match state before the change */
  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: Record<string, unknown> | null;

  /** Bracket/match state after the change */
  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: Record<string, unknown> | null;

  /** Optional free-text reason (required for corrections) */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
