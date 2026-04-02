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
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { User } from '../../users/entities/user.entity';
import { WeightCategory } from '../../tournaments/entities/weight-category.entity';

export type EntryStatus = 'pending' | 'confirmed' | 'rejected' | 'withdrawn';

@Entity('tournament_entries')
@Unique(['tournamentId', 'userId'])
export class TournamentEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => WeightCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'weight_category_id' })
  weightCategory: WeightCategory | null;

  @Column({ name: 'weight_category_id', nullable: true })
  weightCategoryId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: EntryStatus;

  @Column({ type: 'varchar', length: 10, nullable: true })
  hand: string | null; // 'left' | 'right' | 'both' — for armwrestling

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  registeredWeight: number | null;

  @Column({ type: 'int', nullable: true })
  seedNumber: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
