import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import type { GoogleProfilePayload } from './google.strategy';

const SUPPORTED_LANGUAGES = ['ru', 'en', 'hy'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** PostgreSQL `unique_violation` SQLSTATE — surfaced through TypeORM's QueryFailedError. */
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (dto.phone) {
      const existingPhone = await this.usersService.findByPhone(dto.phone);
      if (existingPhone) throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? null,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      country: dto.country,
      language: dto.language || 'hy',
      roles: ['user'],
    });

    const tokens = this.generateTokens(user.id, user.email, user.roles);
    this.logger.log(`User registered: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const isPhone = /^\+?[\d\s\-()]{7,20}$/.test(dto.login) && !dto.login.includes('@');
    const user = isPhone
      ? await this.usersService.findByPhoneWithPassword(dto.login)
      : await this.usersService.findByEmailWithPassword(dto.login);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid login or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid login or password');
    }

    await this.usersService.update(user.id, { lastLoginAt: new Date() });

    const tokens = this.generateTokens(user.id, user.email, user.roles);
    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      ...tokens,
    };
  }

  /**
   * Sign in or sign up via Google OAuth. Three branches:
   *   1. User already linked to this googleId → log in.
   *   2. User exists with the same email but no googleId → link the
   *      Google identity (Google has verified the email, so we trust
   *      the binding).
   *   3. No matching user → provision a fresh account with no
   *      passwordHash; the user can later set one via /auth/set-password.
   *
   * Concurrent callbacks (e.g. browser back-button + retry) can race
   * between branches 2 and 3. We catch PostgreSQL unique-violations
   * and re-resolve the user so both requests converge on the same row
   * instead of one of them 500-ing.
   */
  async loginWithGoogle(
    profile: GoogleProfilePayload,
    ctx: { language?: string | null } = {},
  ) {
    let user = await this.usersService.findByGoogleId(profile.googleId);

    if (!user) {
      const byEmail = await this.usersService.findByEmail(profile.email);
      if (byEmail) {
        user = await this.usersService.update(byEmail.id, {
          googleId: profile.googleId,
          isVerified: true,
          ...(byEmail.avatarUrl ? {} : { avatarUrl: profile.avatarUrl }),
        });
        this.logger.log(`Linked Google account to existing user: ${user.email}`);
      } else {
        user = await this.createGoogleUserSafe(profile, ctx);
      }
    }

    await this.usersService.update(user.id, { lastLoginAt: new Date() });
    const tokens = this.generateTokens(user.id, user.email, user.roles);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      ...tokens,
    };
  }

  /**
   * Set or change the password for the authenticated user.
   *
   * Two modes:
   *   - First-set (Google-only account): no current password recorded
   *     yet, so the request is allowed without `currentPassword`.
   *   - Change: the user already has a hash; we require the correct
   *     `currentPassword` to prevent session-hijack → silent password
   *     reset. Throws 401 on mismatch (does not leak whether the
   *     account has a password — the JWT already proved identity).
   */
  async setPassword(userId: string, dto: SetPasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to change an existing password');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Invalid current password');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.usersService.update(userId, { passwordHash });
    this.logger.log(`Password ${user.passwordHash ? 'changed' : 'set'} for user: ${user.email}`);
    return { message: 'Password updated' };
  }

  /**
   * Pick a language code we actually support out of an `Accept-Language`
   * header. Falls back to Armenian (the project's default locale) so
   * a Google-provisioned user never lands with an empty language.
   */
  resolveLanguage(acceptLanguage: string | string[] | undefined): SupportedLanguage {
    const header = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
    if (typeof header !== 'string' || !header) return 'hy';
    const first = header.split(',')[0]?.trim().toLowerCase().slice(0, 2) ?? '';
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(first)
      ? (first as SupportedLanguage)
      : 'hy';
  }

  private async createGoogleUserSafe(
    profile: GoogleProfilePayload,
    ctx: { language?: string | null },
  ) {
    try {
      const created = await this.usersService.create({
        email: profile.email,
        passwordHash: null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        googleId: profile.googleId,
        roles: ['user'],
        isVerified: true,
        language: ctx.language ?? 'hy',
      });
      this.logger.log(`User registered via Google: ${created.email}`);
      return created;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Lost the race against a concurrent callback — re-resolve the
      // canonical user row by googleId (preferred) or email.
      const winner =
        (await this.usersService.findByGoogleId(profile.googleId)) ??
        (await this.usersService.findByEmail(profile.email));
      if (!winner) throw err;
      this.logger.log(`Google sign-up race resolved to existing user: ${winner.email}`);
      return winner;
    }
  }

  async getProfile(userId: string) {
    // Use the password-aware lookup so we can surface a `hasPassword`
    // boolean to the client without ever leaking the hash itself —
    // the profile UI uses it to decide whether to render the
    // "Set password" or "Change password" form for Google-only users.
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      avatarUrl: user.avatarUrl,
      country: user.country,
      city: user.city,
      language: user.language,
      isVerified: user.isVerified,
      hasPassword: user.passwordHash !== null && user.passwordHash !== undefined,
    };
  }

  private generateTokens(userId: string, email: string, roles: string[]) {
    const payload = { sub: userId, email, roles };
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret-change-in-prod',
    );
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(
        { ...payload, type: 'refresh' },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    };
  }
}

/**
 * Detects PostgreSQL unique-constraint violations bubbling up through
 * TypeORM's `QueryFailedError`. The driver code is the SQLSTATE; we
 * intentionally don't peek at the constraint name so the helper stays
 * resilient to migrations that rename the index.
 */
function isUniqueViolation(err: unknown): boolean {
  const driverCode =
    (err as { driverError?: { code?: string }; code?: string })?.driverError?.code ??
    (err as { code?: string })?.code;
  return driverCode === PG_UNIQUE_VIOLATION;
}
