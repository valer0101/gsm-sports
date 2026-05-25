import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';
import { useArmfightBouts } from './useArmfight';
import type { BoutSnapshot } from '@/components/operator/armfight/types';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleBouts: BoutSnapshot[] = [
  {
    boutId: 'wb_1_0',
    order: 1,
    hand: 'right',
    playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
    playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
    scoreA: 0,
    scoreB: 0,
    status: 'pending',
    leadingId: null,
    legs: [],
    walkoverReason: null,
  },
];

describe('useArmfightBouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GETs /brackets/:id/bouts and returns the snapshots', async () => {
    (api.get as any).mockResolvedValue({ data: sampleBouts });

    const { result } = renderHook(() => useArmfightBouts('bracket-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/brackets/bracket-1/bouts');
    expect(result.current.data).toEqual(sampleBouts);
  });

  it('does not fetch when bracketId is undefined', () => {
    renderHook(() => useArmfightBouts(undefined), { wrapper });
    expect(api.get).not.toHaveBeenCalled();
  });
});
