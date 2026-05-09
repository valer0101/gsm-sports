export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={[
        'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors border',
        value
          ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
          : 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}
