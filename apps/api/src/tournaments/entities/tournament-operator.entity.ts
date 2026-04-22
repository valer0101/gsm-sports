import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Tournament } from './tournament.entity';
import { TournamentTable } from './tournament-table.entity';
import { User } from '../../users/entities/user.entity';

@Entity('tournament_operators')
@Unique(['tournamentId', 'operatorId'])
export class TournamentOperator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: User;

  @Column({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  /**
   * Optional table assignment. When null, the operator can work any table in
   * the tournament (useful for single-table events or roaming head judges).
   * When set, the operator sees only this table's match queue.
   */
  @Index()
  @ManyToOne(() => TournamentTable, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'table_id' })
  table: TournamentTable | null;

  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId: string | null;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt: Date;
}
