import clsx from 'clsx';
import { useId, type ComponentProps, type ReactNode } from 'react';

// iOS text fields: a soft gray fill, no outline, 44px tall; blue focus ring.
const base = 'rounded-[10px] bg-fill px-3.5 text-text placeholder:text-faint transition-shadow focus:outline-none focus:ring-[3px] focus:ring-accent/40 disabled:opacity-60';
const control = clsx('block w-full', base);

export function Field({ label, error, hint, children, className }: { label: string; error?: string | undefined; hint?: string; children: (id: string, describedBy: string | undefined) => ReactNode; className?: string }) {
  const id = useId();
  const msgId = error || hint ? `${id}-msg` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</label>
      {children(id, msgId)}
      {error ? <p id={msgId} role="alert" className="mt-1.5 px-1 text-[13px] text-danger">{error}</p> : hint ? <p id={msgId} className="mt-1.5 px-1 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

type BaseProps = { label: string; error?: string | undefined; hint?: string; wrapperClassName?: string };

export function TextInput({ label, error, hint, wrapperClassName, className, ...rest }: BaseProps & ComponentProps<'input'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => <input id={id} aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'h-11', error && 'ring-2 ring-danger/60', className)} {...rest} />}
    </Field>
  );
}

export function AmountInput({ label, error, hint, wrapperClassName, ...rest }: BaseProps & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted" aria-hidden>₹</span>
          <input id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'h-11 pl-8 tabular-nums', error && 'ring-2 ring-danger/60')} {...rest} />
        </div>
      )}
    </Field>
  );
}

export function SelectInput({ label, error, hint, wrapperClassName, className, children, ...rest }: BaseProps & ComponentProps<'select'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => <select id={id} aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'h-11 pr-8', error && 'ring-2 ring-danger/60', className)} {...rest}>{children}</select>}
    </Field>
  );
}

export function TextArea({ label, error, hint, wrapperClassName, className, ...rest }: BaseProps & ComponentProps<'textarea'>) {
  return (
    <Field label={label} error={error} {...(hint ? { hint } : {})} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {(id, d) => <textarea id={id} rows={3} aria-invalid={!!error} aria-describedby={d} className={clsx(control, 'py-2.5', error && 'ring-2 ring-danger/60', className)} {...rest} />}
    </Field>
  );
}

/** Compact controls for filter rows (the label is read by screen readers). */
export function FilterSelect({ label, className, children, ...rest }: { label: string } & ComponentProps<'select'>) {
  return <select aria-label={label} className={clsx(base, 'h-10 min-w-0 shrink-0 rounded-[10px] pr-7 text-[15px]', className)} {...rest}>{children}</select>;
}
export function FilterDate({ label, className, ...rest }: { label: string } & ComponentProps<'input'>) {
  return <input type="date" aria-label={label} className={clsx(base, 'h-10 shrink-0 text-[15px]', className)} {...rest} />;
}

/** A row of filters: one swipeable line on phones, wrapping on larger screens. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('cl-scroll-x -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0', className)}>{children}</div>;
}

/** iOS switch: 51 x 31, green when on. */
export function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-[16px]">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-fill-strong transition-colors duration-200 peer-checked:bg-success peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/50 peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:size-[27px] after:rounded-full after:bg-white after:shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] after:transition-transform after:duration-200 peer-checked:after:translate-x-5" />
    </label>
  );
}
