import type { ReactNode } from 'react';

export function Section({ children }: { children: ReactNode }) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] p-6">
      {children}
    </section>
  );
}

export function SectionTitle({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  return <h2 className={`text-lg font-bold ${inline ? '' : 'mb-4'}`}>{children}</h2>;
}

export function Label({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--color-text-secondary)] mb-2">
      {children}
      {required && <span className="text-[var(--color-primary)] ml-1">*</span>}
    </label>
  );
}

export function Helper({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{children}</p>;
}
