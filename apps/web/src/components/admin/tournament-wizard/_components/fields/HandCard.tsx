import type { ReactNode } from 'react';

export function HandCard({
  active,
  onClick,
  icon,
  title,
  extraNote,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  extraNote?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative text-left p-4 rounded-md border transition-all flex flex-col gap-2',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
      ].join(' ')}
    >
      {active && <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
      <div className={`flex items-center gap-3 ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
        {icon}
        <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>{title}</span>
      </div>
      {extraNote && <div className="text-[11px] text-[var(--color-text-muted)] leading-snug">{extraNote}</div>}
    </button>
  );
}
