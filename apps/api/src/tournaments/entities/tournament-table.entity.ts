import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import type { TableStatus } from '@gsm/shared-types';
import { Tournament } from './tournament.entity';

@Entity('tournament_tables')
@Unique(['tournamentId', 'number'])
export class TournamentTable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'idle' })
  status: TableStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
