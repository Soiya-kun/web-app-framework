import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { joinClassNames } from './className'

const controlClassName =
  'w-full rounded-control border border-line bg-surface px-3 py-2 text-sm aria-invalid:border-danger focus:outline-2 focus:outline-primary'

export type FormFieldProps = {
  readonly field: string
  readonly label: string
  readonly problemText: string | undefined
  readonly children: ReactNode
}

/** 見出し・入力欄・項目の問題の文を縦に並べる。問題の文は入力欄の説明（aria-describedby）になる。 */
export function FormField({ field, label, problemText, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={field} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {problemText === undefined ? null : (
        <p id={`${field}-problem`} className="text-sm text-danger">
          {problemText}
        </p>
      )}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={joinClassNames(controlClassName, className)} {...props} />
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={joinClassNames(controlClassName, className)} {...props} />
}
