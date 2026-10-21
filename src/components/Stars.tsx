export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={value >= i - 0.25 ? 'on' : ''}>★</span>)}
    </span>
  )
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="star-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i}`}
          className={value >= i ? 'on' : ''} onClick={() => onChange(i)}>★</button>
      ))}
    </div>
  )
}
