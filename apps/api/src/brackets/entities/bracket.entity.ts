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

  @Column({ name: 'weight_category_id', nullable: true })
  weightCategoryId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: BracketStatus;

  // Full bracket state stored as JSONB — BracketData from @gsm/bracket-engine
  @Column({ type: 'jsonb', nullable: true })
  bracketData: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null; // e.g. "Мужчины до 70 кг"

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
