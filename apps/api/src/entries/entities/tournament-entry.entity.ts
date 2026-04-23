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

export type EntryStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'rejected'
  | 'withdrawn';
export type AgeGroup = 'juniors' | 'adults' | 'veterans';

// Unique per: one user can register in same tournament multiple times
// but not in the same (ageGroup + hand) combination
@Entity('tournament_entries')
@Unique(['tournamentId', 'userId', 'ageGroup', 'hand'])
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

  @Column({ name: 'weight_category_id', type: 'uuid', nullable: true })
  weightCategoryId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: EntryStatus;

  // 'juniors' (< 18), 'adults' (18–40), 'veterans' (40+)
  @Column({ type: 'varchar', length: 20, nullable: true })
  ageGroup: AgeGroup | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  hand: string | null; // 'left' | 'right' — for armwrestling

  // Weight provided by user at registration; used for auto-categorization on bracket generation
  @Column({ name: 'weight_kg', type: 'decimal', precision: 5, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ type: 'int', nullable: true })
  seedNumber: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Timestamp of physical check-in at the venue (scan / manual). */
  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  /** User id of the admin / organizer who performed the check-in. */
  @Column({ name: 'checked_in_by', type: 'uuid', nullable: true })
  checkedInBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
