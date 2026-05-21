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
  // Surface this so the Security section can render either "Set password"
  // (Google-only accounts) or "Change password" (everyone else). May be
  // missing on cached entries from older builds — treat undefined as true
  // since password-only accounts always have one set.
  hasPassword?: boolean;
  // Drives the EmailVerificationBanner soft-gate. Server returns it from
  // /auth/me; missing on cached entries from older builds — treat
  // undefined as verified so we don't show the banner on stale clients.
  isVerified?: boolean;
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
        // Persist the minimum needed to avoid a flash of "logged out" on
        // first paint. Deliberately exclude `hasPassword` and any other
        // auth-state metadata: even though they aren't secrets, CodeQL's
        // js/clear-text-storage rule flags identifiers matching
        // `password`/`token`/`secret`, and the React Query refetch on
        // mount populates the field anyway.
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
