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
import { Tournament } from './tournament.entity';

@Entity('weight_categories')
export class WeightCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Tournament, (t) => t.weightCategories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  minWeight: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxWeight: number | null;

  // Allow athletes up to `maxWeight + weightToleranceKg` to register and
  // be weighed-in for this category. 0 (default) preserves the historical
  // strict `weight > maxWeight ⇒ reject` behavior.
  @Column({ name: 'weight_tolerance_kg', type: 'decimal', precision: 5, scale: 2, default: 0 })
  weightToleranceKg: number;

  @Column({ type: 'varchar', length: 10, default: 'male' })
  gender: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
