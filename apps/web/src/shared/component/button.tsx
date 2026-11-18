import type { ButtonHTMLAttributes } from 'react'
import { joinClassNames } from './className'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

const variantClassNames = {
  primary: 'bg-primary text-white hover:bg-primary-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:bg-danger-strong',
} as const satisfies Record<ButtonVariant, string>

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: ButtonVariant }

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames(
        'rounded-control px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50',
        variantClassNames[variant],
        className,
      )}
      {...props}
    />
  )
}
