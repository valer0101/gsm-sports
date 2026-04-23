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
import { User } from '../../users/entities/user.entity';

/**
 * Binds a GSM user to a Telegram chat so the bot can push notifications
 * (match-in-15-min, opponent-withdrew, check-in-open, …).
 *
 * Invariants:
 *   - One link per user (`@Unique userId`). Re-linking overwrites `chatId`
 *     — useful when the athlete switches phones or uses a new Telegram
 *     account.
 *   - `chatId` is Telegram's numeric id, stored as bigint (large positive
 *     integers or small negatives for groups; we only care about personal
 *     chats for v1 but keep the type generous).
 */
@Entity('telegram_links')
@Unique(['userId'])
export class TelegramLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * Telegram chat id. Stored as bigint text because JS numbers start to
   * lose precision past 2^53 and personal chat ids are already 10-digit
   * values; bigint as string sidesteps that risk. The service converts
   * to number only at the boundary where we send to Telegram.
   */
  @Index()
  @Column({ name: 'chat_id', type: 'bigint' })
  chatId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
