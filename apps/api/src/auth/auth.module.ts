import { Module, Logger, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { GoogleAuthGuard } from './google-auth.guard';
import { OAuthStateService } from './oauth-state.service';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { EmailVerificationService } from './email-verification.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

/**
 * Google OAuth requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 * Without them passport-google-oauth20 throws inside its constructor
 * (an empty clientID is fatal), so we conditionally include the
 * strategy provider. Reading `process.env` here — instead of going
 * through `ConfigService` — is intentional: providers must be decided
 * at module-compile time, before DI is wired up.
 *
 * The state service and guard are always registered so the
 * /auth/google* endpoints can fail cleanly (passport raises
 * "Unknown authentication strategy" → caught by the controller and
 * turned into a friendly error redirect) instead of crashing on boot.
 */
function googleStrategyProviders(): Provider[] {
  const hasGoogle = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  if (!hasGoogle) {
    new Logger('AuthModule').warn(
      'Google OAuth disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.',
    );
    return [];
  }
  return [GoogleStrategy];
}

@Module({
  imports: [
    UsersModule,
    MailModule,
    TypeOrmModule.forFeature([PasswordResetToken, EmailVerificationToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-prod'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES', '15m') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OAuthStateService,
    PasswordResetService,
    EmailVerificationService,
    GoogleAuthGuard,
    ...googleStrategyProviders(),
  ],
  exports: [AuthService],
})
export class AuthModule {}
