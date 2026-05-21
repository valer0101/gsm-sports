'use client';

import { use } from 'react';
import { ArmfightPairsView } from './_view';

/**
 * Default route export — handles the Next.js 15 awaitable `params` and
 * delegates to `ArmfightPairsView` with a plain `id`. The split lets unit
 * tests render `ArmfightPairsView` directly without needing a Suspense
 * boundary around the `use(params)` suspend.
 */
export default function ArmfightPairsPage({ params }: { params: Promise<{ id: string }> }) {
  // Matches the pattern in apps/web/src/app/admin/tournaments/[id]/page.tsx:56.
  const { id } = use(params);
  return <ArmfightPairsView id={id} />;
}
