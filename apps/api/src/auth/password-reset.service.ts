import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { renderPasswordResetEmail, type SupportedLocale } from '../mail/templates';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 30;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1 of the flow: user submits their email. We ALWAYS resolve
   * without error — never reveal whether the address exists. If a real
   * user is found we save a hashed token and email the plaintext.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      // Silently succeed; log at debug for forensics only.
      this.logger.debug(`Password reset requested for unknown email: ${email}`);
      return;
    }

    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    const siteUrl = this.config.get<string>('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
    const resetUrl = `${siteUrl}/auth/reset-password?token=${rawToken}`;
    const locale = (user.language as SupportedLocale) ?? 'hy';

    const { subject, html } = renderPasswordResetEmail({
      locale,
      resetUrl,
      firstName: user.firstName,
    });
    await this.mail.send({ to: user.email, subject, html });
    this.logger.log(`Password reset requested for ${user.email}`);
  }

  /**
   * Step 2 of the flow: user submits the token + a new password.
   * Verifies the token (unused, unexpired), sets the password, marks
   * the token used.
   *
   * Session-invalidation note: existing access-token cookies expire in
   * 15 minutes regardless (see `JwtModule.registerAsync` in
   * `auth.module.ts`); refresh tokens are issued but not currently
   * persisted client-side. Effective session invalidation therefore
   * happens within 15 minutes of a reset without further code. A
   * passwordChangedAt column + JwtStrategy DB check is a post-launch
   * tightening (see ROADMAP — Phase 2 / Security).
   */
  async consumeToken(rawToken: string, newPassword: string): Promise<void> {
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/.test(rawToken)) {
      throw new BadRequestException('Invalid reset token');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = await this.tokens.findOne({
      where: { tokenHash, usedAt: null as unknown as Date },
    });

    if (!row || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.update(row.userId, { passwordHash });
    await this.tokens.update({ id: row.id }, { usedAt: new Date() });
    this.logger.log(`Password reset consumed for userId=${row.userId}`);
  }
}
