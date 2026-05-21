import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
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

  // consumeToken is implemented in Task 5 — keep the stub here to keep
  // the controller's import shape stable.
  async consumeToken(_rawToken: string, _newPassword: string): Promise<void> {
    throw new BadRequestException('Not implemented yet');
  }
}

export const __testing = { TOKEN_BYTES, TOKEN_TTL_MINUTES };
// Suppress unused import — bcrypt is needed in Task 5 but importing it now
// avoids touching this file again to add it; ts-eslint allows unused imports
// when re-exported elsewhere, so we no-op it.
void bcrypt;
void LessThan;
