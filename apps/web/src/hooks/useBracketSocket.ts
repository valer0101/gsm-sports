'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { Bracket } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/v1', '') ?? 'http://localhost:4000';

/**
 * Subscribes to real-time bracket updates for a tournament.
 * When the server emits `bracket_updated`, invalidates the React Query cache
 * so BracketView re-renders automatically.
 */
export function useBracketSocket(tournamentId: string | undefined) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!tournamentId) return;

    const socket = io(`${API_URL}/brackets`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_tournament', tournamentId);
    });

    socket.on(
      'bracket_updated',
      (payload: { bracketId: string; bracketData: Bracket['bracketData'] }) => {
        // Optimistically update the cache so the UI refreshes instantly
        qc.setQueryData<Bracket[]>(['brackets', tournamentId], (old) => {
          if (!old) return old;
          return old.map((b) =>
            b.id === payload.bracketId ? { ...b, bracketData: payload.bracketData } : b,
          );
        });
        // Also update operator cache
        qc.setQueryData<Bracket[]>(['operator', 'brackets', tournamentId], (old) => {
          if (!old) return old;
          return old.map((b) =>
            b.id === payload.bracketId ? { ...b, bracketData: payload.bracketData } : b,
          );
        });
        // Sub-D: live-refresh the per-bracket bouts query used by the
        // armfight focus view. We invalidate (not setQueryData) because
        // the bouts derivation lives server-side in `listBouts`.
        qc.invalidateQueries({
          queryKey: ['brackets', payload.bracketId, 'bouts'],
        });
      },
    );

    return () => {
      socket.emit('leave_tournament', tournamentId);
      socket.disconnect();
    };
  }, [tournamentId, qc]);
}
