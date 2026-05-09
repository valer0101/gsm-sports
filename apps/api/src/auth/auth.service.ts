import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { GoogleProfilePayload } from './google.strategy';

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
   *      Google identity to the existing account (single source of
   *      truth per email — avoids duplicate accounts).
   *   3. No matching user → provision a new account with no password
   *      hash; future logins must go through Google or password reset.
   *
   * Either way, returns the same shape as login()/register() so the
   * controller can issue cookies uniformly.
   */
  async loginWithGoogle(profile: GoogleProfilePayload) {
    let user = await this.usersService.findByGoogleId(profile.googleId);

    if (!user) {
      const byEmail = await this.usersService.findByEmail(profile.email);
      if (byEmail) {
        user = await this.usersService.update(byEmail.id, {
          googleId: profile.googleId,
          // Trust Google's verified email — saves a second verification round-trip.
          isVerified: true,
          ...(byEmail.avatarUrl ? {} : { avatarUrl: profile.avatarUrl }),
        });
        this.logger.log(`Linked Google account to existing user: ${user.email}`);
      } else {
        user = await this.usersService.create({
          email: profile.email,
          passwordHash: null,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          googleId: profile.googleId,
          roles: ['user'],
          isVerified: true,
        });
        this.logger.log(`User registered via Google: ${user.email}`);
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

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
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
