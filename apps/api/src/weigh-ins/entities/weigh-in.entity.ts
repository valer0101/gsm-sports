import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TournamentEntry } from '../../entries/entities/tournament-entry.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Official weigh-in result for a `TournamentEntry`. One row per entry — a
 * re-weigh overwrites the previous row rather than appending a new one, so
 * the bracket-generation gate can ask "does this entry have a weigh-in?" in
 * a single query.
 *
 * `tournamentId` is denormalised from the entry for fast per-tournament
 * lookups in the admin UI (one indexed join saved per request). The entry
 * FK itself is `UNIQUE` so re-weighing is an upsert, not a duplicate row.
 */
@Entity('weigh_ins')
export class WeighIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @OneToOne(() => TournamentEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: TournamentEntry;

  @Column({ name: 'entry_id', type: 'uuid', unique: true })
  entryId: string;

  @Index()
  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  /** Weight measured on site, in kilograms. */
  @Column({
    name: 'official_weight_kg',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  officialWeightKg: number;

  /** User id of the admin / organizer who recorded the measurement. */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'verified_by' })
  verifiedByUser: User;

  @Column({ name: 'verified_by', type: 'uuid' })
  verifiedBy: string;

  @Column({ name: 'verified_at', type: 'timestamptz', default: () => 'now()' })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
