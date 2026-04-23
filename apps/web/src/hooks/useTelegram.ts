'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
 * states. `staleTime: 0` — after the user finishes the deep-link flow on
 * their phone the hook must re-query to pick up the new chatId on the
 * next window focus.
 */
export function useTelegramLink() {
  return useQuery<TelegramLinkStatus | null>({
    queryKey: ['telegram', 'link'],
    queryFn: () => api.get('/telegram/link').then((r: any) => r.data),
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
      qc.invalidateQueries({ queryKey: ['telegram', 'link'] });
    },
  });
}
