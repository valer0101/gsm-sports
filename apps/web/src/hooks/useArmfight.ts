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

// useMutation, useQueryClient, and LegWinType are intentionally imported here;
// Tasks 3 and 4 will add mutation hooks to this file that use them.
