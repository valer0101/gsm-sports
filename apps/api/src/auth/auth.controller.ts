import { Controller, Post, Get, Body, Query, UseGuards, Request, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
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
    private readonly passwordReset: PasswordResetService,
    private readonly emailVerification: EmailVerificationService,
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

  /**
   * Always returns 200, even when no user matches. Anti-enumeration.
   * Rate-limited per existing /auth/* policy (10 req / 15 min / IP).
   */
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordReset.requestReset(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  /**
   * Consumes a reset token + sets the new password. The token format and
   * password length are also enforced by the DTO so invalid input is
   * rejected before any DB work.
   */
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.consumeToken(dto.token, dto.password);
    return { message: 'Password updated' };
  }

  // Throttled at the same /auth/* policy as the sibling endpoints. The
  // 256-bit token space makes brute force infeasible anyway, but
  // rate-limiting an unauthenticated GET is a cheap defense-in-depth and
  // keeps parity with `forgot-password` / `reset-password` / `resend-verification`.
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Get('verify-email')
  async verifyEmailGet(@Query('token') token: string) {
    await this.emailVerification.verifyToken(token);
    return { message: 'Email verified' };
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.emailVerification.resendVerification(dto.email);
    return { message: 'If that email exists and is unverified, a new link has been sent.' };
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

      res.redirect(this.buildFrontendRedirect(frontend, 'ok', state.redirect));
    } catch (err) {
      this.logger.error(`Google OAuth callback failed: ${(err as Error).message}`);
      res.redirect(this.buildFrontendRedirect(frontend, 'error', null));
    }
  }

  /**
   * Builds the post-OAuth redirect URL with two layers of protection:
   *
   *   1. The redirect path comes from `OAuthStateService.verify()`, which
   *      already enforces a same-origin path (starts with `/`, not `//`,
   *      length-capped). It can only ever land in our `redirect=` query
   *      param — never in the host, scheme, or path of the URL we
   *      redirect to.
   *
   *   2. After construction we re-check that the final URL still starts
   *      with the configured frontend prefix. Setting a search param
   *      can't change the origin/path at runtime, so this is belt &
   *      suspenders — but it also gives CodeQL a recognised sanitiser
   *      pattern for `js/server-side-unvalidated-url-redirection`,
   *      which otherwise tracks taint through the URL builder and
   *      flags `res.redirect()`.
   *
   * The host/path of `frontend` itself is server-controlled (env var
   * `GOOGLE_SUCCESS_REDIRECT`), never user input.
   */
  private buildFrontendRedirect(
    frontend: string,
    status: 'ok' | 'error',
    redirectPath: string | null,
  ): string {
    const params = new URLSearchParams({ status });
    if (
      status === 'ok' &&
      redirectPath &&
      redirectPath.startsWith('/') &&
      !redirectPath.startsWith('//') &&
      redirectPath.length <= 200
    ) {
      params.set('redirect', redirectPath);
    }
    const finalUrl = `${frontend}?${params.toString()}`;
    if (!finalUrl.startsWith(frontend)) {
      // Unreachable under normal operation — the prefix is built from
      // `frontend` directly. If it ever fires, refuse the redirect
      // rather than send a user somewhere unexpected.
      throw new Error('Frontend redirect URL drifted from configured base');
    }
    return finalUrl;
  }
}
