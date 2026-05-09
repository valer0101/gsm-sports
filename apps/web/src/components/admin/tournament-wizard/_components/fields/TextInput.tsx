import type { ReactNode } from 'react';

export function TextInput({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: (cls?: string) => ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
          {icon('h-4 w-4')}
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'w-full h-12 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)]',
          icon ? 'pl-10 pr-4' : 'px-4',
        ].join(' ')}
      />
    </div>
  );
}
