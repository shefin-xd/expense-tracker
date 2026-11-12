import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

type Props = ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean };

const variants = {
  primary: 'bg-primary text-primary-fg hover:opacity-90 border border-transparent',
  secondary: 'bg-bg text-text border border-border-strong hover:bg-surface',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-surface',
  danger: 'bg-danger text-white border border-transparent hover:opacity-90',
};

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
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
    <button type="button" aria-label={label} title={label} className={clsx('inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-text', className)} {...rest}>
      {children}
    </button>
  );
}
