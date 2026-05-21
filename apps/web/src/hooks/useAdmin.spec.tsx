import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArmfightBracket } from './useAdmin';

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
