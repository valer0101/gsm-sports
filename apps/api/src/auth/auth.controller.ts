import { Controller, Post, Get, Body, UseGuards, Request, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { GoogleProfilePayload } from './google.strategy';
import { Public } from './public.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Brute-force gate: 10 attempts / 15 min / IP. Mirrors docs/04-API-DESIGN
  // "Auth endpoints: 10 req / 15 min". Overrides the global 100/min default
  // throttler for this route only.
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    const { accessToken: _, refreshToken: __, ...safe } = result;
    return safe;
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    const { accessToken: _, refreshToken: __, ...safe } = result;
    return safe;
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { message: 'Logged out' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  // Browser hits GET /v1/auth/google → passport redirects to Google's
  // consent screen → Google calls back /v1/auth/google/callback with a
  // code → passport exchanges it for a profile → we issue our cookie and
  // bounce to the frontend. Throttled like the password endpoints to keep
  // the OAuth flow off the global brute-force allowance.

  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleAuth(): void {
    // Guard performs the redirect to Google. Body intentionally empty.
  }

  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Request() req: any, @Res() res: Response) {
    const frontend =
      this.configService.get<string>('GOOGLE_SUCCESS_REDIRECT') ??
      'http://localhost:3000/auth/google/callback';

    try {
      const profile = req.user as GoogleProfilePayload;
      const result = await this.authService.loginWithGoogle(profile);
      res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
      res.redirect(`${frontend}?status=ok`);
    } catch (err) {
      this.logger.error(`Google OAuth callback failed: ${(err as Error).message}`);
      res.redirect(`${frontend}?status=error`);
    }
  }
}
