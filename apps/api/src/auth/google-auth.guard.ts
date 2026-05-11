import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport';
import type { Request } from 'express';
import { OAuthStateService } from './oauth-state.service';

/**
 * Wraps `AuthGuard('google')` so we can inject our signed `state` JWT
 * into passport's authorize call. The guard is used for both the
 * start endpoint (`GET /auth/google`) — where state is generated —
 * and the callback (`GET /auth/google/callback`), where passport
 * ignores `getAuthenticateOptions().state` and reads `req.query.state`
 * instead. Callback-side validation lives in the controller so we can
 * redirect users to a friendly error page on failure.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly oauthState: OAuthStateService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const req = context.switchToHttp().getRequest<Request>();
    const rawRedirect = (req.query?.redirect ?? null) as string | null;
    return {
      scope: ['email', 'profile'],
      state: this.oauthState.sign({ redirect: rawRedirect }),
    };
  }

  // Swallow auth failures (e.g. user clicked "Cancel" on Google's consent
  // screen → ?error=access_denied) so the callback controller can run its
  // try/catch and redirect to a friendly frontend error page. Without this
  // override the guard throws UnauthorizedException before the controller
  // method ever executes, dumping a stack trace at the user.
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
