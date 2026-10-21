import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useI18n } from '../lib/i18n'

type Opts = { message: string; confirm?: boolean; okLabel?: string; danger?: boolean }
type Pending = Opts & { resolve: (ok: boolean) => void }

const DialogContext = createContext<(o: Opts) => Promise<boolean>>(async () => false)

// In-app replacement for alert() and confirm().
export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [pending, setPending] = useState<Pending | null>(null)
  const ask = useCallback((o: Opts) => new Promise<boolean>(resolve => setPending({ ...o, resolve })), [])
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null) }

  return (
    <DialogContext.Provider value={ask}>
      {children}
      {pending && (
        <div className="dialog-backdrop" onClick={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <p>{pending.message}</p>
            <div className="dialog-actions">
              {pending.confirm && <button className="btn btn-ghost" onClick={() => close(false)}>{t('cancel')}</button>}
              <button className={`btn ${pending.danger ? 'btn-danger' : ''}`} onClick={() => close(true)} autoFocus>
                {pending.okLabel ?? t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export const useDialog = () => useContext(DialogContext)
