import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { renderVerificationEmail, type SupportedLocale } from '../mail/templates';
import type { User } from '../users/entities/user.entity';

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 24;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly tokens: Repository<EmailVerificationToken>,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Send a fresh verification email for `user`. No-op if already verified. */
  async sendVerification(user: User): Promise<void> {
    if (user.isVerified) return;

    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60_000);

    await this.tokens.save(
      this.tokens.create({ userId: user.id, tokenHash, expiresAt, usedAt: null }),
    );

    const siteUrl = this.config.get<string>('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${siteUrl}/auth/verify-email?token=${rawToken}`;
    const locale = (user.language as SupportedLocale) ?? 'hy';
    const { subject, html } = renderVerificationEmail({
      locale,
      verifyUrl,
      firstName: user.firstName,
    });
    await this.mail.send({ to: user.email, subject, html });
    this.logger.log(`Verification email sent to ${user.email}`);
  }

  /** Resend for a user identified by email. Silent on unknown / already-verified. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.isVerified) return;
    await this.sendVerification(user);
  }

  /** Consume a token. Sets `isVerified=true` on the user. */
  async verifyToken(rawToken: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(rawToken)) {
      throw new BadRequestException('Invalid verification token');
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = await this.tokens.findOne({
      where: { tokenHash, usedAt: null as unknown as Date },
    });
    if (!row || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.users.update(row.userId, { isVerified: true });
    await this.tokens.update({ id: row.id }, { usedAt: new Date() });
    this.logger.log(`Email verified for userId=${row.userId}`);
  }
}
