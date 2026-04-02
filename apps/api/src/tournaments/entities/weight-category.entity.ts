import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tournament } from './tournament.entity';

@Entity('weight_categories')
export class WeightCategory {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ type: 'varchar', length: 10, default: 'male' })
  gender: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
