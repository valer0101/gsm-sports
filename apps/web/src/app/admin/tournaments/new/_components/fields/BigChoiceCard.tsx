import type { ReactNode } from 'react';
import { Icon } from '../../_lib/icons';

export function BigChoiceCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative text-left p-6 rounded-[10px] border-2 transition-all min-h-[180px] flex flex-col',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
      ].join(' ')}
    >
      {active && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
          {Icon.check('h-3 w-3')}
        </div>
      )}
      <div className={active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}>
        {icon}
      </div>
      <div className="mt-4">
        <div className={`text-2xl font-extrabold tracking-tight ${active ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>{title}</div>
        <div className="text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)] mt-0.5">{subtitle}</div>
      </div>
      <div className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</div>
    </button>
  );
}
