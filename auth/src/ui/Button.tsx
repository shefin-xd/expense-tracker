import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

type Props = ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean };

/** iOS buttons: filled blue, tinted (soft blue), plain text, destructive red. */
const variants = {
  primary: 'bg-accent text-white active:opacity-80',
  secondary: 'bg-accent/12 text-accent active:bg-accent/20',
  ghost: 'bg-transparent text-accent active:bg-fill',
  danger: 'bg-danger text-white active:opacity-80',
};

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-[opacity,background-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-9 rounded-[10px] px-3.5 text-[14px]' : 'h-11 rounded-[12px] px-5 text-[16px]',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ComponentProps<'button'> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={clsx('inline-flex size-10 shrink-0 items-center justify-center rounded-full text-accent transition-colors active:bg-fill sm:hover:bg-fill', className)} {...rest}>
      {children}
    </button>
  );
}
