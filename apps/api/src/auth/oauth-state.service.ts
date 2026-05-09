import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface OAuthStatePayload {
  redirect: string | null;
  // Discriminator so a stolen session JWT can't be replayed as a state value
  // (and vice versa). Verified explicitly on read.
  type: 'oauth-state';
}

/**
 * Signs and verifies the `state` parameter used in the OAuth 2.0 redirect.
 *
 * Two responsibilities:
 *   1. CSRF protection — the state is a JWT signed with a server-side
 *      secret and short TTL, so an attacker who didn't initiate the flow
 *      can't forge a valid callback.
 *   2. Carrying the post-login redirect path through the round-trip,
 *      since query strings on /auth/google are dropped by Google's
 *      authorization server.
 *
 * The redirect is sanitised to a same-origin path to make it impossible
 * to weaponise the callback into an open redirect.
 */
@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);
  private readonly secret: string;

  constructor(
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.secret =
      config.get<string>('OAUTH_STATE_SECRET') ??
      config.get<string>('JWT_ACCESS_SECRET') ??
      'dev-access-secret-change-in-prod';
  }

  sign(payload: { redirect: string | null }): string {
    const safeRedirect = this.sanitizeRedirect(payload.redirect);
    return this.jwtService.sign(
      { type: 'oauth-state', redirect: safeRedirect } satisfies OAuthStatePayload,
      { secret: this.secret, expiresIn: '10m' },
    );
  }

  verify(state: string | null | undefined): OAuthStatePayload {
    if (!state || typeof state !== 'string') {
      throw new BadRequestException('Missing OAuth state');
    }
    try {
      const decoded = this.jwtService.verify<OAuthStatePayload>(state, { secret: this.secret });
      if (decoded.type !== 'oauth-state') {
        throw new Error('wrong token type');
      }
      return { type: 'oauth-state', redirect: this.sanitizeRedirect(decoded.redirect) };
    } catch (e) {
      this.logger.warn(`OAuth state verification failed: ${(e as Error).message}`);
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  /**
   * Allow only same-origin path redirects. Drops absolute URLs,
   * protocol-relative URLs (`//evil.com/x`), and obviously malformed
   * inputs. Also caps the length to keep the JWT compact.
   */
  private sanitizeRedirect(raw: string | null | undefined): string | null {
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.startsWith('/') || raw.startsWith('//')) return null;
    if (raw.length > 200) return null;
    return raw;
  }
}
