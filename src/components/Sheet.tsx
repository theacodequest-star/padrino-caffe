import type { ReactNode } from 'react'

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  return (
    <div className="dialog-backdrop sheet-backdrop" onClick={onClose}>
      <div className="dialog sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
