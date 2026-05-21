// apps/web/src/components/admin/armfight-pairs/types.ts

/** One pair-slot in the builder UI. All three fields start empty;
 *  submit blocks until all three are filled. */
export interface PairDraft {
  /** Local-only id for React `key` + remove targeting. crypto.randomUUID(). */
  id: string;
  playerAId: string | '';
  playerBId: string | '';
  hand: 'left' | 'right' | '';
}

/** Engine-shape payload. `hand` narrowed; ''-states filtered out by the
 *  client validator before submit. */
export interface PairPayload {
  playerAId: string;
  playerBId: string;
  hand: 'left' | 'right';
}

/** Create a fresh empty slot — used on mount and on "+ Add pair". */
export function freshDraft(): PairDraft {
  return {
    id: crypto.randomUUID(),
    playerAId: '',
    playerBId: '',
    hand: '',
  };
}

/** Convert a complete draft to the engine payload. Returns null if any
 *  field is still empty — caller filters those out before submit. */
export function draftToPayload(d: PairDraft): PairPayload | null {
  if (!d.playerAId || !d.playerBId || !d.hand) return null;
  return { playerAId: d.playerAId, playerBId: d.playerBId, hand: d.hand };
}
