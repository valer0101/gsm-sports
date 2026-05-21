import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Thin wrapper over the Resend SDK. Mirrors the Sentry pattern: when
 * RESEND_API_KEY is unset the service short-circuits to a no-op + log
 * line so local dev and CI don't need real credentials, and a single
 * missing env var doesn't crash the app at boot.
 *
 * Errors from Resend are logged at warn level but never rethrown — a
 * transient mail outage must not 500 a sign-up or forgot-password
 * request. The user can always retry; the audit trail lives in logs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('MAIL_FROM') ?? 'no-reply@gsm-sports.example';
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not set — MailService is disabled. Outbound email will be logged but not sent.',
      );
      this.client = null;
    } else {
      this.client = new Resend(apiKey);
    }
  }

  async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.client) {
      this.logger.log(`[mail disabled] would send to=${opts.to} subject="${opts.subject}"`);
      return;
    }
    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      if (error) {
        this.logger.warn(`Resend rejected email to=${opts.to}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(
        `Resend threw for email to=${opts.to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
