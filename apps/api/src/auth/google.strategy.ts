import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * Google OAuth 2.0 strategy. Activated only when both
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured —
 * AuthModule registers this provider behind that gate so the
 * app still boots in environments without Google credentials.
 *
 * The verify callback shapes the profile down to the fields we
 * need; account linking + JWT issuance happens in AuthService.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    const callbackURL =
      config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:4000/v1/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      this.logger.warn(`Google profile ${profile.id} has no email — rejecting`);
      done(new Error('Google account did not return an email address'), undefined);
      return;
    }

    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      email: email.toLowerCase(),
      firstName: profile.name?.givenName ?? 'Google',
      lastName: profile.name?.familyName ?? 'User',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, payload);
  }
}
