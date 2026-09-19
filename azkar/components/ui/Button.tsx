import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover active:bg-accent-hover shadow-soft',
  secondary:
    'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-95 border border-transparent',
};

const SIZES: Record<Size, string> = {
  // Зоны нажатия всегда >= 44px по высоте — палец не должен «целиться».
  sm: 'h-11 px-3.5 text-[0.9375rem] rounded-xl gap-1.5',
  md: 'h-12 px-4 text-base rounded-2xl gap-2',
  lg: 'h-14 px-6 text-[1.0625rem] rounded-2xl gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-custom-focus
      className={cn(
        'inline-flex items-center justify-center font-semibold select-none',
        'transition-[background-color,transform,color] duration-150 ease-out',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  );
}

/** Круглая кнопка-иконка. Обязательно требует aria-label. */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: Variant;
  size?: 'sm' | 'md';
}

export function IconButton({
  className,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      data-custom-focus
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'transition-[background-color,transform,color] duration-150 ease-out active:scale-95',
        'disabled:pointer-events-none disabled:opacity-45',
        size === 'md' ? 'size-11' : 'size-10',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
