'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UpdateMePayload {
  firstName?: string;
  lastName?: string;
  // Empty string or null = clear avatar. Backend normalises both to NULL.
  avatarUrl?: string | null;
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

/**
 * Upload an image to the shared /upload/image endpoint. Wrapping this in a
 * mutation keeps components free of direct axios calls, per CLAUDE.md:
 * "No direct fetch()/axios in components."
 */
export function useUploadImage() {
  return useMutation<{ url: string }, unknown, File>({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return (res as any).data;
    },
  });
}
