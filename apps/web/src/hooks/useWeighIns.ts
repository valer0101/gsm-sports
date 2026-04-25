'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WeighInResponse } from '@/types/api';

/**
 * React Query hooks for the Phase 3.1 weigh-in surface.
 *
 * All mutations invalidate `['admin', 'weigh-ins', tournamentId]` so the
 * manager list refreshes, plus `['admin', 'confirmed-entries', tournamentId]`
 * because auto-reassign may have moved the entry to a different weight
 * category and the registrations list needs to reflect it.
 */

/** List all weigh-ins for a tournament. Admin/organizer view. */
export function useAdminWeighIns(tournamentId: string) {
  return useQuery<WeighInResponse[]>({
    queryKey: ['admin', 'weigh-ins', tournamentId],
    queryFn: () =>
      api.get(`/weigh-ins/tournament/${tournamentId}`).then((r: any) => r.data),
    enabled: !!tournamentId,
  });
}

/** Record (or overwrite) the official weigh-in for an entry. */
export function useAdminRecordWeighIn(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<
    WeighInResponse,
    unknown,
    { entryId: string; officialWeightKg: number }
  >({
    mutationFn: (payload) =>
      api.post('/weigh-ins', payload).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'weigh-ins', tournamentId] });
      // Auto-reassign may move the entry to a different weight category.
      qc.invalidateQueries({ queryKey: ['admin', 'confirmed-entries', tournamentId] });
      // The athlete's own tournament page reads via `useWeighInByEntry` —
      // refresh the chip if the same browser is logged into both views
      // (organizer + athlete in dev, or self-organized event).
      qc.invalidateQueries({ queryKey: ['weigh-in', 'entry'] });
    },
  });
}

/** Admin-only: remove a weigh-in row (scanner error, retest, …). */
export function useAdminUndoWeighIn(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (weighInId) =>
      api.delete(`/weigh-ins/${weighInId}`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'weigh-ins', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'confirmed-entries', tournamentId] });
      qc.invalidateQueries({ queryKey: ['weigh-in', 'entry'] });
    },
  });
}

/**
 * Athlete-facing single lookup — used by the tournament entry card to show
 * a "weighed in" chip next to the check-in badge. Returns `null` when no
 * weigh-in has been recorded yet.
 */
export function useWeighInByEntry(entryId: string | null | undefined) {
  return useQuery<WeighInResponse | null>({
    queryKey: ['weigh-in', 'entry', entryId],
    queryFn: () =>
      api.get(`/weigh-ins/entry/${entryId}`).then((r: any) => r.data ?? null),
    enabled: !!entryId,
  });
}
