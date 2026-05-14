import { forwardRef } from 'react'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        className="w-full rounded border px-3 text-sm outline-none transition-colors duration-150"
        style={{
          height:      '36px',
          background:  'var(--surface-2)',
          color:       'var(--text)',
          borderColor: error ? 'var(--danger)' : 'var(--border)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)' }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)' }}
        {...props}
      />
      {error
        ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
        : hint
          ? <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
          : null}
    </div>
  )
})
