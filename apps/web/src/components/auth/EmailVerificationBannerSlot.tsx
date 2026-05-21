'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { EmailVerificationBanner } from './EmailVerificationBanner';

/**
 * Mount point for `EmailVerificationBanner`. Reads the current user via
 * the existing React Query cache (`useCurrentUser`) and renders the
 * banner only when the user is authenticated AND has not verified their
 * email. Returns `null` otherwise — there's no banner for guests, and
 * no banner for verified users.
 *
 * Soft gate: the banner is a nag, not a block. It does NOT redirect or
 * gate any flow. Plan: `docs/superpowers/specs/2026-05-20-production-launch-week-design.md`
 * section 4.3.
 */
export function EmailVerificationBannerSlot() {
  const { data: user } = useCurrentUser();
  if (!user || user.isVerified !== false) return null;
  return <EmailVerificationBanner email={user.email} />;
}
