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
import { Athlete } from '../../athletes/entities/athlete.entity';
import { Sport } from '../../sports/entities/sport.entity';

@Entity('ranking_entries')
@Unique(['athleteId', 'sportId', 'season', 'hand', 'gender', 'weightCategory'])
export class RankingEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @Column({ name: 'athlete_id', type: 'uuid' })
  athleteId: string;

  @Index()
  @ManyToOne(() => Sport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;

  @Column({ name: 'sport_id', type: 'uuid' })
  sportId: string;

  @Index()
  @Column({ type: 'int' })
  season: number; // year, e.g. 2025

  @Column({ type: 'int', default: 0 })
  points: number;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  hand: string | null; // 'left' | 'right' — null means overall

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string | null; // 'male' | 'female'

  @Column({ type: 'varchar', length: 100, nullable: true })
  weightCategory: string | null; // e.g. 'до 70 кг'

  // Calculated positions — updated by recalculate()
  @Index()
  @Column({ type: 'int', nullable: true })
  worldPosition: number | null;

  @Column({ type: 'int', nullable: true })
  countryPosition: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
