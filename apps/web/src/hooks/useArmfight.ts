'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BoutSnapshot } from '@/components/operator/armfight/types';
import type { LegWinType } from '@gsm/bracket-engine';

/**
 * Read-only snapshot of all bouts in an armfight bracket.
 * Mirrors GET /v1/brackets/:id/bouts (apps/api/src/brackets/brackets.controller.ts:91).
 *
 * Path note: `api.baseURL` already ends in `/v1`; the bare `/brackets/...`
 * is correct. See apps/web/src/hooks/useAdmin.ts:196-198 for the same gotcha.
 */
export function useArmfightBouts(bracketId: string | undefined) {
  return useQuery<BoutSnapshot[]>({
    queryKey: ['brackets', bracketId, 'bouts'],
    queryFn: () =>
      api.get(`/brackets/${bracketId}/bouts`).then((r: any) => r.data),
    enabled: !!bracketId,
  });
}

/**
 * Append a leg result to an armfight bo5 bout.
 * Mirrors POST /v1/brackets/:id/legs (brackets.controller.ts:74).
 *
 * Engine validation errors come back as 400 with message prefix
 * `recordLeg: …`. The mutation does NOT swallow them — callers must
 * read `mutation.error` to surface the engine message verbatim.
 *
 * Only the `bouts` query is invalidated here. The server emits
 * `bracket_updated` after every commit, and the parent's
 * `useBracketSocket(tournamentId)` handles the rest of the cache
 * (operator dashboard, schedule, etc.).
 */
export function useRecordLeg(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      boutId: string;
      legIndex: number;
      winnerId: string;
      winType: LegWinType;
    }) =>
      api
        .post(`/brackets/${bracketId}/legs`, body)
        .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', bracketId, 'bouts'] });
    },
  });
}

/**
 * Close an armfight bout as walkover.
 * Mirrors POST /v1/brackets/:id/forfeit (brackets.controller.ts:84).
 *
 * Engine errors come back as 400 with message prefix `forfeitBout: …`.
 * The mutation does NOT swallow them.
 */
export function useForfeitBout(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      boutId: string;
      winnerId: string;
      walkoverReason?: string;
    }) => {
      const payload: Record<string, unknown> = {
        boutId: body.boutId,
        winnerId: body.winnerId,
      };
      if (body.walkoverReason !== undefined) {
        payload.walkoverReason = body.walkoverReason;
      }
      return api
        .post(`/brackets/${bracketId}/forfeit`, payload)
        .then((r: any) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', bracketId, 'bouts'] });
    },
  });
}
