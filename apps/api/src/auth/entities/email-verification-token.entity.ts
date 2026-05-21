import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_verification_tokens')
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Migration creates this table in snake_case (see
  // 1779680000000-email-verification-tokens.ts). Explicit `name:` aliases
  // keep TypeORM's column lookups matching the DB, same pattern as the
  // `password_reset_tokens` entity and `telegram_links`.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // UNIQUE for the same reason as `password_reset_tokens.token_hash`:
  // explicit guarantee + serves as the lookup index.
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
