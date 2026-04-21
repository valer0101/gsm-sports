'use client';

import Image from 'next/image';

interface Props {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  className?: string;
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim()?.[0] ?? '';
  const l = lastName?.trim()?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

export function Avatar({ src, firstName, lastName, size = 28, className = '' }: Props) {
  const initials = getInitials(firstName, lastName);

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={initials} fill className="object-cover" sizes={`${size}px`} unoptimized />
      ) : (
        <span
          className="font-semibold text-white/70 select-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
