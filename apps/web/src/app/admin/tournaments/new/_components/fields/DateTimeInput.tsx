import { Icon } from '../../_lib/icons';

export function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
        {Icon.calendar()}
      </div>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 pl-10 pr-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all [color-scheme:dark]"
      />
    </div>
  );
}
