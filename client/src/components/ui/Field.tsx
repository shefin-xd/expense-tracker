import clsx from 'clsx';
import { useId, type ComponentProps, type ReactNode } from 'react';

const base = 'rounded-md border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60';
const control = clsx('block w-full', base);

export function Field({ label, error, hint, children, className }: { label: string; error?: string | undefined; hint?: string; children: (id: string, describedBy: string | undefined) => ReactNode; className?: string }) {
  const id = useId();
  const msgId = error || hint ? `${id}-msg` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">{label}</label>
      {children(id, msgId)}
      {error ? <p id={msgId} role="alert" className="mt-1.5 text-[13px] text-danger">{error}</p> : hint ? <p id={msgId} className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

type BaseProps = { label: string; error?: string | undefined; hint?: string; wrapperClassName?: string };

export function TextInput({ label, error, hint, wrapperClassName, className, ...rest }: BaseProps & ComponentProps<'input'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => <input id={id} aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'h-10', error && 'border-danger', className)} {...rest} />}
    </Field>
  );
}

export function AmountInput({ label, error, hint, wrapperClassName, ...rest }: BaseProps & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted" aria-hidden>₹</span>
          <input id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'h-10 pl-7 tabular-nums', error && 'border-danger')} {...rest} />
        </div>
      )}
    </Field>
  );
}

export function SelectInput({ label, error, hint, wrapperClassName, className, children, ...rest }: BaseProps & ComponentProps<'select'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => <select id={id} aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'h-10', error && 'border-danger', className)} {...rest}>{children}</select>}
    </Field>
  );
}

export function TextArea({ label, error, hint, wrapperClassName, className, ...rest }: BaseProps & ComponentProps<'textarea'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => <textarea id={id} rows={3} aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'py-2', error && 'border-danger', className)} {...rest} />}
    </Field>
  );
}

/** Compact controls used in filter bars (no label above, label is read by screen readers). */
export function FilterSelect({ label, className, children, ...rest }: { label: string } & ComponentProps<'select'>) {
  return <select aria-label={label} className={clsx(base, 'h-9 min-w-0', className)} {...rest}>{children}</select>;
}
export function FilterDate({ label, className, ...rest }: { label: string } & ComponentProps<'input'>) {
  return <input type="date" aria-label={label} className={clsx(base, 'h-9', className)} {...rest} />;
}

export function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-border-strong bg-surface transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:left-0.5 after:top-0.5 after:size-3.5 after:rounded-full after:bg-muted after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-primary-fg" />
    </label>
  );
}
