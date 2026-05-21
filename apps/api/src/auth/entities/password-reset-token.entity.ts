import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Migration creates this table in snake_case (see
  // 1779580000000-password-reset-tokens.ts). TypeORM property names default
  // to the column name, so each column needs an explicit `name:` alias to
  // match the table. Same pattern as `telegram_links` entity.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // SHA-256 hex of the random token. Hex of a 32-byte digest is 64 chars.
  // The plaintext token lives only in the email link, never in the DB.
  // UNIQUE: collisions are astronomically improbable for 256-bit input,
  // but the constraint makes that guarantee explicit and lets the index
  // double as a uniqueness index without a separate one.
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
