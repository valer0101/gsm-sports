'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tournament, Bracket, BracketAuditLog } from '@/types/api';

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

export function useAdminBracketAuditLog(bracketId: string) {
  return useQuery<BracketAuditLog[]>({
    queryKey: ['admin', 'bracket-audit', bracketId],
    queryFn: () => api.get(`/admin/brackets/${bracketId}/audit`).then((r: any) => r.data),
    enabled: !!bracketId,
  });
}

/** Confirmed tournament entries — used as replacement candidates. */
export interface ConfirmedEntry {
  id: string;
  status: string;
  ageGroup: string | null;
  hand: string | null;
  weightKg: number | null;
  seedNumber: number | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export function useConfirmedEntries(tournamentId: string) {
  return useQuery<{ data: ConfirmedEntry[] }>({
    queryKey: ['admin', 'entries', tournamentId, 'confirmed'],
    queryFn: () =>
      api
        .get(`/entries/tournament/${tournamentId}?status=confirmed&limit=100`)
        .then((r: any) => r.data),
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
      api
        .patch(`/brackets/${bracketId}/matches/${payload.matchId}/replace-player`, {
          position: payload.position,
          newEntryId: payload.newEntryId,
          reason: payload.reason,
        })
        .then((r: any) => r.data),
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
      api
        .patch(`/brackets/${bracketId}/matches/${payload.matchId}/withdraw-player`, {
          position: payload.position,
          reason: payload.reason,
        })
        .then((r: any) => r.data),
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
      qc.invalidateQueries({ queryKey: ['admin', 'entries', tournamentId] });
      qc.invalidateQueries({ queryKey: ['entries', tournamentId] });
    },
  });
}
