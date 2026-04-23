'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tournament, Bracket, BracketAuditLog, TournamentEntry } from '@/types/api';

/* ─── Tournaments ─── */

export function useAdminTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['admin', 'tournaments'],
    queryFn: () => api.get('/admin/tournaments').then((r: any) => r.data),
  });
}

export function useAdminTournament(id: string) {
  return useQuery<Tournament>({
    queryKey: ['admin', 'tournament', id],
    queryFn: () => api.get(`/admin/tournaments/${id}`).then((r: any) => r.data),
    enabled: !!id,
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Tournament> & { sportId: string }) =>
      api.post('/admin/tournaments', data).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] }),
  });
}

export function useUpdateTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Tournament>) =>
      api.patch(`/admin/tournaments/${id}`, data).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', id] });
    },
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tournaments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] }),
  });
}

export function useToggleRegistration(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch(`/admin/tournaments/${id}/toggle-registration`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });
}

export function useGenerateBrackets(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(`/admin/tournaments/${id}/generate-brackets`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });
}

/* ─── Users ─── */

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export function useAdminUsers(page = 1, limit = 20) {
  return useQuery<{ users: AdminUser[]; total: number }>({
    queryKey: ['admin', 'users', page, limit],
    queryFn: () => api.get(`/admin/users?page=${page}&limit=${limit}`).then((r: any) => r.data),
  });
}

export function useUpdateUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      api.patch(`/admin/users/${id}/roles`, { roles }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

/* ─── Operators ─── */

export interface OperatorEntry {
  id: string;
  operatorId: string;
  tournamentId: string;
  assignedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export function useAdminOperators(tournamentId: string) {
  return useQuery<OperatorEntry[]>({
    queryKey: ['admin', 'operators', tournamentId],
    queryFn: () => api.get(`/admin/tournaments/${tournamentId}/operators`).then((r: any) => r.data),
    enabled: !!tournamentId,
  });
}

export function useAssignOperator(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api.post(`/admin/tournaments/${tournamentId}/operators`, { email }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'operators', tournamentId] }),
  });
}

export function useRemoveOperator(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (operatorId: string) =>
      api.delete(`/admin/tournaments/${tournamentId}/operators/${operatorId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'operators', tournamentId] }),
  });
}

/* ─── Bracket management (admin) ─── */

export function useAdminBrackets(tournamentId: string) {
  return useQuery<Bracket[]>({
    queryKey: ['admin', 'brackets', tournamentId],
    queryFn: () => api.get(`/admin/tournaments/${tournamentId}/brackets`).then((r: any) => r.data),
    enabled: !!tournamentId,
  });
}

export function useAdminCorrectResult(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { matchId: string; winnerId: string; reason?: string }) =>
      api.patch(`/admin/brackets/${bracketId}/correct-result`, payload).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

export function useAdminResetMatch(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { matchId: string; reason?: string }) =>
      api.patch(`/admin/brackets/${bracketId}/reset-match`, payload).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

export function useAdminLockBracket(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lock: boolean) =>
      api
        .patch(`/admin/brackets/${bracketId}/${lock ? 'lock' : 'unlock'}`)
        .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
    },
  });
}

/**
 * Starts a category on a bracket — the backend auto-forfeits any entry not
 * in `checked_in` (PR #20). Used by the admin bracket manager UI after
 * on-site check-in is complete.
 */
export interface StartCategoryResult {
  requireCheckIn: boolean;
  withdrawn: string[];
  skipped: string[];
  doubleNoShow: string[];
  errors: Array<{ matchId: string; error: string }>;
}

export function useAdminStartCategory(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<StartCategoryResult>({
    mutationFn: () =>
      api.patch(`/brackets/${bracketId}/start-category`).then((r: any) => r.data),
    onSuccess: () => {
      // Forfeits mutate bracketData + audit log — invalidate everything the
      // bracket manager / operator UI might display.
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'bracket-audit', bracketId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'pending-matches', tournamentId] });
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] });
    },
  });
}

/**
 * Admin/organizer manually marks an athlete as physically present on site.
 * Equivalent to scanning their QR but skips the camera step — used for
 * walk-up check-in at a kiosk / front desk.
 */
export function useAdminCheckInEntry(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.post(`/entries/${entryId}/check-in`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'confirmed-entries', tournamentId] });
      qc.invalidateQueries({ queryKey: ['entries', 'my'] });
    },
  });
}

/**
 * Check in by scanning the athlete's QR. Server decodes and verifies the
 * signed JWT; UI just posts the raw token string. Returns the updated
 * entry on success (or throws on expired / wrong-purpose / cross-
 * tournament stale token).
 */
export function useAdminCheckInByQr(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<TournamentEntry, unknown, string>({
    mutationFn: (token: string) =>
      api.post('/entries/check-in-by-qr', { token }).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'confirmed-entries', tournamentId] });
      qc.invalidateQueries({ queryKey: ['entries', 'my'] });
    },
  });
}

/** Admin-only — revert a previous check-in (e.g. scanner error). */
export function useAdminUndoCheckIn(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.post(`/entries/${entryId}/undo-check-in`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'confirmed-entries', tournamentId] });
      qc.invalidateQueries({ queryKey: ['entries', 'my'] });
    },
  });
}

export function useAdminBracketAuditLog(bracketId: string) {
  return useQuery<BracketAuditLog[]>({
    queryKey: ['admin', 'bracket-audit', bracketId],
    queryFn: () => api.get(`/admin/brackets/${bracketId}/audit`).then((r: any) => r.data),
    enabled: !!bracketId,
  });
}

/**
 * Tournament entries in an "actively competing" status — confirmed OR
 * checked_in. Used as bracket-replacement candidates AND as the data
 * source for the admin registrations list (so post-check-in rows don't
 * vanish).
 *
 * The hook name is kept for backwards compatibility with its original
 * single-status meaning; its queryKey was renamed to
 * `['admin', 'confirmed-entries', tournamentId]` to dodge any stale
 * `confirmed`-suffixed cache from before. Callers that invalidate this
 * list must target the new key (not the legacy `['admin','entries',...]`
 * prefix).
 */
export interface ConfirmedEntry {
  id: string;
  status: string;
  ageGroup: string | null;
  hand: string | null;
  weightKg: number | null;
  seedNumber: number | null;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export function useConfirmedEntries(tournamentId: string) {
  return useQuery<{ data: ConfirmedEntry[] }>({
    queryKey: ['admin', 'confirmed-entries', tournamentId],
    // Fetch with no status filter, then narrow to the set we care about on
    // the client. Cheaper than two round-trips, and the admin payload is
    // capped at 100 entries anyway.
    queryFn: () =>
      api
        .get(`/entries/tournament/${tournamentId}?limit=100`)
        .then((r: { data: { data: ConfirmedEntry[]; meta: unknown } }) => ({
          ...r.data,
          data: r.data.data.filter(
            (e) => e.status === 'confirmed' || e.status === 'checked_in',
          ),
        })),
    enabled: !!tournamentId,
  });
}

/* ─── Manual slot edits (admin) ─── */

export function useAdminReplacePlayer(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      matchId: string;
      position: 1 | 2;
      newEntryId: string;
      reason: string;
    }) =>
      api.patch(`/brackets/${bracketId}/replace-player`, payload).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'bracket-audit', bracketId] });
    },
  });
}

export function useAdminWithdrawPlayer(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { matchId: string; position: 1 | 2; reason: string }) =>
      api.patch(`/brackets/${bracketId}/withdraw-player`, payload).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['admin', 'bracket-audit', bracketId] });
    },
  });
}

export function useAdminReassignEntry(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      entryId: string;
      weightCategoryId?: string | null;
      ageGroup?: 'juniors' | 'adults' | 'veterans';
      hand?: 'left' | 'right';
      weightKg?: number;
      reason: string;
    }) => {
      const { entryId, ...body } = payload;
      return api.patch(`/entries/${entryId}/reassign`, body).then((r: any) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', tournamentId] });
      // useConfirmedEntries now lives under ['admin','confirmed-entries',id].
      // The previous prefix `['admin','entries',id]` used to match its old
      // 4-segment key but the rename broke that — target the new key
      // explicitly so the registrations list refetches after a reassign.
      qc.invalidateQueries({ queryKey: ['admin', 'confirmed-entries', tournamentId] });
      qc.invalidateQueries({ queryKey: ['entries', tournamentId] });
    },
  });
}
