import { Icon } from '../_lib/icons';
import { STEPS } from '../_lib/constants';

export function WizardProgress({
  currentStep,
  completedSteps,
  onJump,
}: {
  currentStep: number;
  completedSteps: Set<number>;
  onJump: (n: number) => void;
}) {
  return (
    <>
      {/* Mobile compact bar */}
      <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs">
            <span className="text-[var(--color-text-muted)]">Step </span>
            <span className="text-white font-bold">{currentStep}</span>
            <span className="text-[var(--color-text-muted)]"> of {STEPS.length}</span>
          </div>
          <div className="text-[10px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">
            {STEPS[currentStep - 1].label}
          </div>
        </div>
        <div className="h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop nodes */}
      <div className="hidden md:block bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const isDone = completedSteps.has(s.num);
              const isCurrent = currentStep === s.num;
              const canJump = isDone;
              return (
                <div key={s.num} className="flex items-center flex-1 last:flex-initial">
                  <button
                    type="button"
                    onClick={() => canJump && onJump(s.num)}
                    disabled={!canJump && !isCurrent}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={[
                        'h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm transition-all',
                        isCurrent && 'bg-[var(--color-primary)] text-white shadow-[0_0_0_4px_var(--color-primary-dim)] scale-110',
                        isDone && !isCurrent && 'bg-[var(--color-success)] text-black',
                        !isDone && !isCurrent && 'bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-muted)]',
                      ].filter(Boolean).join(' ')}
                    >
                      {isDone && !isCurrent ? Icon.check('h-4 w-4') : s.num.toString().padStart(2, '0')}
                    </div>
                    <span
                      className={[
                        'text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors',
                        isCurrent && 'text-white',
                        isDone && !isCurrent && 'text-[var(--color-success)]',
                        !isDone && !isCurrent && 'text-[var(--color-text-muted)]',
                      ].filter(Boolean).join(' ')}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={[
                        'flex-1 h-px mx-3 -mt-5 transition-colors',
                        completedSteps.has(s.num) ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]',
                      ].join(' ')}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
