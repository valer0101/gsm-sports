import { Module, Logger, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { UsersModule } from '../users/users.module';

/**
 * Google OAuth requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 * Without them passport-google-oauth20 throws on construction, so we
 * only register the strategy when both are present. The /auth/google*
 * endpoints will then 500 with "Unknown authentication strategy" if
 * called — surface a clear log so the misconfig is obvious.
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
  providers: [AuthService, JwtStrategy, ...googleStrategyProviders()],
  exports: [AuthService],
})
export class AuthModule {}
