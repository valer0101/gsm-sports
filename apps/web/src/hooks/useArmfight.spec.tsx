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
import { useArmfightBouts, useRecordLeg } from './useArmfight';
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

// (inside the same file, alongside the previous describe block)

describe('useRecordLeg', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs the leg payload to /brackets/:id/legs', async () => {
    (api.post as any).mockResolvedValue({ data: { id: 'bracket-1' } });

    const { result } = renderHook(() => useRecordLeg('bracket-1'), {
      wrapper,
    });

    result.current.mutate({
      boutId: 'wb_1_0',
      legIndex: 1,
      winnerId: 'a',
      winType: 'pin',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/legs', {
      boutId: 'wb_1_0',
      legIndex: 1,
      winnerId: 'a',
      winType: 'pin',
    });
  });

  it('invalidates the bouts query on success', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRecordLeg('bracket-1'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate({
      boutId: 'wb_1_0',
      legIndex: 1,
      winnerId: 'a',
      winType: 'pin',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith({
      queryKey: ['brackets', 'bracket-1', 'bouts'],
    });
  });
});

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
