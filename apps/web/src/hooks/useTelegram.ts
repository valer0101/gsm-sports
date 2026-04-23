'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrentUser } from './useCurrentUser';

export interface TelegramLinkStatus {
  id: string;
  chatIdMasked: string;
  linkedAt: string;
}

export interface TelegramLinkToken {
  token: string;
  /** `https://t.me/<BOT>?start=<token>` — what the user taps on mobile. */
  deepLink: string;
  /** ISO timestamp; after this the token is useless and must be re-issued. */
  expiresAt: string;
}

/**
 * Current Telegram link for the logged-in user. `null` when unlinked.
 * Used to drive the profile-page section between "connect" and "connected"
 * states.
 *
 * `queryKey` includes the current user's id so the cache doesn't leak
 * across accounts: if user A logs out and user B logs in in the same
 * tab, React Query won't serve A's "connected to …1234" badge to B
 * while the new fetch is in flight. `enabled` also guards against
 * anonymous fires — no point asking `/telegram/link` without a token.
 *
 * Refetches on window focus so the status flips to "connected"
 * automatically after the athlete completes the deep-link flow on
 * their phone.
 */
export function useTelegramLink() {
  const { data: user } = useCurrentUser();
  const userId = user?.id ?? null;
  return useQuery<TelegramLinkStatus | null>({
    queryKey: ['telegram', 'link', userId],
    queryFn: () => api.get('/telegram/link').then((r: any) => r.data),
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });
}

/**
 * Issue a fresh 5-minute deep-link token. Manual trigger — we deliberately
 * do NOT auto-issue on mount so the token isn't burning its TTL in the
 * background. Caller renders the QR only after the athlete clicks
 * "Connect". On success, caches the result; re-click refreshes.
 */
export function useIssueTelegramLinkToken() {
  return useMutation<TelegramLinkToken>({
    mutationFn: () =>
      api.get('/telegram/link-token').then((r: any) => r.data),
  });
}

export function useUnlinkTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/telegram/link').then((r: any) => r.data),
    onSuccess: () => {
      // Invalidate the full `['telegram', 'link', *]` prefix so the hit
      // fires regardless of which user-scoped key currently lives in cache.
      qc.invalidateQueries({ queryKey: ['telegram', 'link'] });
    },
  });
}
