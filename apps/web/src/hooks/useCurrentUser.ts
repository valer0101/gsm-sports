'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  avatarUrl: string | null;
}

export function clearStoredUser() {
  if (typeof window !== 'undefined') localStorage.removeItem('gsm_user');
}

export function useCurrentUser() {
  const [initialUser, setInitialUser] = useState<CurrentUser | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gsm_user');
      if (raw) setInitialUser(JSON.parse(raw));
    } catch {
      // Corrupt or missing localStorage entry — fall through to network fetch.
    }
    setMounted(true);
  }, []);

  const query = useQuery<CurrentUser>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const data = await api.get('/auth/me').then((r: any) => r.data);
        localStorage.setItem(
          'gsm_user',
          JSON.stringify({
            id: data.id,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            roles: data.roles,
          }),
        );
        return data;
      } catch {
        clearStoredUser();
        throw new Error('Not authenticated');
      }
    },
    enabled: mounted,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    data: query.data ?? initialUser,
  };
}
