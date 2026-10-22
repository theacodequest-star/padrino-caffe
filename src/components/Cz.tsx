import { Fragment } from 'react'

// Cinzel draws the Đ bar on top of the letter, so draw a D with our own bar across the stem.
// Words with Đ are kept on one line, since the replacement letter would otherwise allow a break mid-word.
// One wrapping span keeps the spaces between words when the parent is a flex box.
export function Cz({ children }: { children: string }) {
  return (
    <span>
      {children.split(/(\s+)/).map((word, w) =>
        /[Đđ]/.test(word)
          ? (
            <span key={w} className="nowrap">
              {word.split(/([Đđ])/).map((p, i) =>
                p === 'Đ' || p === 'đ'
                  ? <span key={i} className={p === 'Đ' ? 'dj' : 'dj dj-small'}>D</span>
                  : <Fragment key={i}>{p}</Fragment>,
              )}
            </span>
          )
          : <Fragment key={w}>{word}</Fragment>,
      )}
    </span>
  )
}
