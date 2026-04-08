import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Sport } from '../../sports/entities/sport.entity';
import { WeightCategory } from './weight-category.entity';

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Sport, { nullable: false })
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;

  @Column({ name: 'sport_id', type: 'uuid' })
  sportId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;

  @Column({ name: 'organizer_id' })
  organizerId: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  nameRu: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  nameEn: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  nameHy: string | null;

  @Index()
  @Column({ type: 'varchar', length: 300, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  descriptionRu: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionEn: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionHy: string | null;

  @Index()
  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 50, default: 'double_elimination' })
  format: string;

  @Column({ type: 'int', nullable: true })
  maxParticipants: number | null;

  @Column({ type: 'boolean', default: false })
  registrationOpen: boolean;

  @Column({ type: 'boolean', default: false })
  bracketGenerated: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  registrationDeadline: Date | null;

  // draft | upcoming | registration_open | registration_closed | bracket_ready | active | completed | cancelled
  @Index()
  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'boolean', default: false })
  isLive: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  posterUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  streamUrl: string | null;

  @Column({ type: 'jsonb', default: {} })
  sportConfig: Record<string, unknown>;

  @OneToMany(() => WeightCategory, (wc) => wc.tournament, { cascade: true })
  weightCategories: WeightCategory[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
