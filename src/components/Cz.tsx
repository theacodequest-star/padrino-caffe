import { Fragment } from 'react'

// Cinzel draws the Đ bar on top of the letter, so draw a D with our own bar across the stem.
export function Cz({ children }: { children: string }) {
  const parts = children.split(/([Đđ])/)
  return (
    <>
      {parts.map((p, i) =>
        p === 'Đ' || p === 'đ'
          ? <span key={i} className={p === 'Đ' ? 'dj' : 'dj dj-small'}>D</span>
          : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  )
}
