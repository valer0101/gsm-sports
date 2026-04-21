import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { WeightCategory } from '../../tournaments/entities/weight-category.entity';

export type BracketStatus = 'pending' | 'active' | 'completed';

@Entity('brackets')
export class Bracket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => WeightCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'weight_category_id' })
  weightCategory: WeightCategory | null;

  @Column({ name: 'weight_category_id', type: 'uuid', nullable: true })
  weightCategoryId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: BracketStatus;

  // Full bracket state stored as JSONB — BracketData from @gsm/bracket-engine
  @Column({ type: 'jsonb', nullable: true })
  bracketData: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null; // e.g. "Мужчины до 70 кг"

  // Audit / management fields
  @Column({ name: 'last_modified_by', type: 'uuid', nullable: true })
  lastModifiedBy: string | null;

  @Column({ name: 'last_modified_at', type: 'timestamptz', nullable: true })
  lastModifiedAt: Date | null;

  @Column({ name: 'modification_count', type: 'int', default: 0 })
  modificationCount: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /** When true, only admin can record/change results */
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
