import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

const control =
  'w-full rounded border border-strong bg-surface px-3 text-base text-fg placeholder:text-faint transition-colors hover:border-faint focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60 sm:text-sm';

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={clsx(control, 'h-10', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(control, 'min-h-[72px] py-2', className)} {...rest} />;
}
export function Select({ className, children, invalid, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={clsx(control, 'h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', invalid && 'border-danger', className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238B929E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Rupee amount input. Keeps the raw string; conversion to paise happens on the server. */
export function AmountInput({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted" aria-hidden>₹</span>
      <input inputMode="decimal" autoComplete="off" placeholder="0.00" className={clsx(control, 'num h-10 pl-7', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />
    </div>
  );
}

/** Label + control + error. The child receives an id through render-prop so label and input stay linked. */
export function Field({ label, error, hint, optional, className, children }: {
  label: string; error?: string | undefined; hint?: string; optional?: boolean; className?: string; children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-[13px] font-medium text-fg">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-faint">Optional</span>}
      </label>
      {children(id)}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{message}</p>;
}
