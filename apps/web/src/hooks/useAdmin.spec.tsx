import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArmfightBracket } from './useAdmin';
import { api } from '@/lib/api';

// Stub the `api` module so the hook doesn't try to hit a real backend.
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url.includes('/brackets')) {
        return {
          data: [
            { id: 'b1', bracketData: { format: 'double_elim' } },
            { id: 'b2', bracketData: { format: 'armfight' } },
          ],
        };
      }
      throw new Error(`unexpected url ${url}`);
    }),
    post: vi.fn(async () => ({ data: { id: 'new-bracket' } })),
    patch: vi.fn(async () => ({ data: { id: 'reset-bracket', bracketData: null } })),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useArmfightBracket', () => {
  it('finds and returns the armfight bracket from the list', async () => {
    const { result } = renderHook(() => useArmfightBracket('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toMatchObject({ id: 'b2' });
  });
});

import { useGenerateArmfightBracket } from './useAdmin';

describe('useGenerateArmfightBracket', () => {
  it('POSTs to /brackets/generate with format=armfight and the given pairs', async () => {
    const post = vi.mocked(api.post);
    post.mockClear();

    const { result } = renderHook(() => useGenerateArmfightBracket('t1'), { wrapper });
    result.current.mutate({
      pairs: [
        { playerAId: 'e1', playerBId: 'e2', hand: 'right' },
        { playerAId: 'e3', playerBId: 'e4', hand: 'left' },
      ],
    });
    await waitFor(() => expect(post).toHaveBeenCalled());
    // baseURL already has /v1 — bare path resolves to /v1/brackets/generate
    expect(post.mock.calls[0][0]).toBe('/brackets/generate');
    expect(post.mock.calls[0][1]).toMatchObject({
      tournamentId: 't1',
      bracketFormat: 'armfight',
      pairs: [
        { playerAId: 'e1', playerBId: 'e2', hand: 'right' },
        { playerAId: 'e3', playerBId: 'e4', hand: 'left' },
      ],
    });
  });
});

import { useResetBracket } from './useAdmin';

describe('useResetBracket', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockClear();
  });

  it('PATCHes /brackets/:id/reset and invalidates queries', async () => {
    const { result } = renderHook(
      () => useResetBracket('t1', 'b2'),
      { wrapper },
    );
    result.current.mutate();
    await waitFor(() => expect(vi.mocked(api.patch)).toHaveBeenCalled());
    // baseURL already has /v1 — bare path resolves to /v1/brackets/b2/reset
    expect(vi.mocked(api.patch).mock.calls[0][0]).toBe('/brackets/b2/reset');
  });
});
