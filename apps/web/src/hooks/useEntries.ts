'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TournamentEntry } from '@/types/api';

/**
 * Entries owned by the current user, across every tournament they've
 * registered for. Backed by `GET /v1/entries/my`. Small list (most athletes
 * have a handful of registrations at a time) so no pagination needed.
 */
export function useMyEntries() {
  return useQuery<TournamentEntry[]>({
    queryKey: ['entries', 'my'],
    queryFn: () => api.get('/entries/my').then((r: any) => r.data),
  });
}

/**
 * Signed QR token for on-site check-in. The athlete requests their own
 * token (`GET /v1/entries/:id/checkin-qr`); the QR encodes the token so an
 * admin/organizer scans it and calls `POST /v1/entries/check-in-by-qr`.
 *
 * Cached briefly — the backend TTL is 30 days but the client holds the
 * fetched value for 10 minutes before re-asking. Long enough to render
 * the QR repeatedly without spam, short enough that a refresh after a
 * stale-token warning is cheap.
 */
export interface CheckinQr {
  token: string;
  expiresAt: string;
}

export function useCheckinQr(entryId: string | null | undefined) {
  return useQuery<CheckinQr>({
    queryKey: ['entries', 'checkin-qr', entryId],
    queryFn: () => api.get(`/entries/${entryId}/checkin-qr`).then((r: any) => r.data),
    enabled: !!entryId,
    staleTime: 10 * 60 * 1000,
  });
}
