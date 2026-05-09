import { Controller, Post, Get, Body, UseGuards, Request, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { GoogleAuthGuard } from './google-auth.guard';
import { OAuthStateService } from './oauth-state.service';
import type { GoogleProfilePayload } from './google.strategy';
import { Public } from './public.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const DEFAULT_FRONTEND_CALLBACK = 'http://localhost:3000/auth/google/callback';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly oauthState: OAuthStateService,
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
    const { accessToken: _at, refreshToken: _rt, ...safe } = result;
    void _at;
    void _rt;
    return safe;
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    const { accessToken: _at, refreshToken: _rt, ...safe } = result;
    void _at;
    void _rt;
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
  getProfile(@Request() req: ExpressRequest & { user: { sub: string } }) {
    return this.authService.getProfile(req.user.sub);
  }

  /**
   * First-time set OR change of password for the authenticated user.
   * The DTO carries `currentPassword` (required only when one is
   * already on file). Throttled tightly because abusing it drains
   * bcrypt CPU.
   */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('set-password')
  setPassword(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Body() dto: SetPasswordDto,
  ) {
    return this.authService.setPassword(req.user.sub, dto);
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  //
  // Browser hits GET /v1/auth/google → GoogleAuthGuard signs a state JWT
  // (carrying the optional ?redirect= path + acting as the CSRF token)
  // and passport redirects to Google's consent screen → Google calls
  // back /v1/auth/google/callback with a code → passport exchanges it
  // for a profile → we verify the state, run loginWithGoogle, set the
  // session cookie, and bounce to the frontend.
  //
  // The start endpoint is left under the global throttler (100/min)
  // because it issues a redirect, not a credential check. The callback
  // keeps a per-IP gate to absorb attacker-driven retries.

  @ApiExcludeEndpoint()
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth(): void {
    // Guard performs the redirect to Google. Body intentionally empty.
  }

  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Request() req: ExpressRequest & { user?: GoogleProfilePayload },
    @Res() res: Response,
  ) {
    const frontend =
      this.configService.get<string>('GOOGLE_SUCCESS_REDIRECT') ?? DEFAULT_FRONTEND_CALLBACK;

    try {
      // CSRF: verify the signed state Google echoed back. Throws
      // BadRequestException on tamper / expiry — caught below.
      const stateValue = typeof req.query?.state === 'string' ? req.query.state : null;
      const state = this.oauthState.verify(stateValue);

      const profile = req.user;
      if (!profile) throw new Error('Google profile missing on request');

      const language = this.authService.resolveLanguage(req.headers['accept-language']);
      const result = await this.authService.loginWithGoogle(profile, { language });
      res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);

      const target = new URL(frontend);
      target.searchParams.set('status', 'ok');
      if (state.redirect) target.searchParams.set('redirect', state.redirect);
      res.redirect(target.toString());
    } catch (err) {
      this.logger.error(`Google OAuth callback failed: ${(err as Error).message}`);
      const target = new URL(frontend);
      target.searchParams.set('status', 'error');
      res.redirect(target.toString());
    }
  }
}
