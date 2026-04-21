'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UpdateMePayload {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  country?: string;
  city?: string;
  language?: string;
  dateOfBirth?: string;
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateMePayload) => {
      const res = await api.patch('/users/me', data);
      return (res as any).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}
