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
import { User } from '../../users/entities/user.entity';
import { Sport } from '../../sports/entities/sport.entity';

export type AthleteHand = 'left' | 'right' | 'both';
export type AthleteGender = 'male' | 'female';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';

@Entity('athletes')
export class Athlete {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Optional link to a user account
  @Index()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @ManyToOne(() => Sport, { nullable: false })
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;

  @Column({ name: 'sport_id', type: 'int' })
  sportId: number;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 250 })
  slug: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: AthleteGender | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  primaryHand: AthleteHand | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  experienceLevel: ExperienceLevel | null;

  @Column({ type: 'text', nullable: true })
  bioRu: string | null;

  @Column({ type: 'text', nullable: true })
  bioEn: string | null;

  @Column({ type: 'text', nullable: true })
  bioHy: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'jsonb', default: {} })
  socialLinks: Record<string, string>;

  @Column({ type: 'jsonb', default: {} })
  achievements: Record<string, unknown>;

  // Cached ranking fields — updated by RankingsService
  @Index()
  @Column({ type: 'int', nullable: true })
  worldRank: number | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  countryRank: number | null;

  @Column({ type: 'int', default: 0 })
  totalPoints: number;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
