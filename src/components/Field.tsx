import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; ok?: string }

export function Field({ label, hint, error, ok, id, ...rest }: Props) {
  const fid = id ?? rest.name
  return (
    <label className="field" htmlFor={fid}>
      <span className="field-label">{label}</span>
      <input id={fid} {...rest} aria-invalid={!!error} />
      {error ? <span className="field-msg field-error">{error}</span>
        : ok ? <span className="field-msg field-ok">{ok}</span>
        : hint ? <span className="field-msg">{hint}</span> : null}
    </label>
  )
}
