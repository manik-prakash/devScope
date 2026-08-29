'use client'

interface FilterSelectProps {
  value:        string
  onChange:     (v: string) => void
  options:      { label: string; value: string }[]
  placeholder?: string
}

// Styled <select> used across the session filter bars.
export function FilterSelect({ value, onChange, options, placeholder = 'All' }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded border px-3 text-sm outline-none transition-colors duration-150 cursor-pointer"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        color:       value ? 'var(--text)' : 'var(--text-muted)',
        minWidth:    '140px',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
