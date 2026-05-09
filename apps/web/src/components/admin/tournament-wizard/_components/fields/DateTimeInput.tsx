import { Icon } from '../../_lib/icons';

export function DateTimeInput({
  value,
  onChange,
  min,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
        {Icon.calendar()}
      </div>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        disabled={disabled}
        className={[
          'w-full h-12 pl-10 pr-4 bg-[var(--color-surface-2)] border focus:ring-4 focus:outline-none rounded-md transition-all [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed',
          invalid
            ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
            : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-dim)]',
        ].join(' ')}
      />
    </div>
  );
}
