import { useEffect, useState } from 'react'
import { Page } from '../../components/Page'
import { Loading } from '../../components/Loading'
import { useDialog } from '../../components/Dialog'
import { api, type Person } from '../../lib/api'
import { useAuth, type Role } from '../../lib/auth'
import { useI18n, type StringKey } from '../../lib/i18n'
import { useLoad } from '../../lib/useLoad'

const PROTECTED: Role[] = ['admin', 'owner']

export function Staff() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [staffOnly, setStaffOnly] = useState(false)
  useEffect(() => { const i = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(i) }, [query])
  const people = useLoad(() => api.people(debounced, staffOnly), [debounced, staffOnly])

  return (
    <Page title={t('staff')}>
      <label className="field">
        <input type="search" value={query} placeholder={t('search')} aria-label={t('search')} onChange={e => setQuery(e.target.value)} />
      </label>
      <div className="tabs" role="tablist" style={{ marginTop: 10 }}>
        <button role="tab" aria-selected={!staffOnly} className={!staffOnly ? 'on' : ''} onClick={() => setStaffOnly(false)}>{t('everyone')}</button>
        <button role="tab" aria-selected={staffOnly} className={staffOnly ? 'on' : ''} onClick={() => setStaffOnly(true)}>{t('staffOnly')}</button>
      </div>
      {!people.data ? <Loading error={people.error} /> : people.data.length === 0 ? <p className="muted center">{t('noPeople')}</p> : (
        <ul className="people">
          {people.data.map(p => <PersonCard key={p.id} person={p} onChange={people.reload} />)}
        </ul>
      )}
    </Page>
  )
}

function PersonCard({ person: p, onChange }: { person: Person; onChange: () => void }) {
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  const me = profile?.id === p.id
  const iAmOwner = profile?.role === 'owner'
  // Nobody acts on themselves; only the owner touches admins, and nobody touches the owner.
  const canManage = !me && p.role !== 'owner' && (iAmOwner || !PROTECTED.includes(p.role))
  const roles: Role[] = iAmOwner ? ['guest', 'waiter', 'admin'] : ['guest', 'waiter']
  const name = p.nickname ?? p.full_name ?? p.email ?? ''
  const fmt = (d: string, time = false) => new Date(d).toLocaleString(lang === 'sr' ? 'sr-Latn-RS' : 'en-GB',
    time ? { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'numeric', year: 'numeric' })

  const act = async (message: string, fn: () => Promise<void>, danger = false, okLabel?: string) => {
    if (!(await dialog({ message, confirm: true, danger, okLabel }))) return
    setBusy(true)
    try { await fn() } catch { dialog({ message: t('error') }) }
    setBusy(false); onChange()
  }

  const changeRole = (r: Role) => {
    if (r === p.role) return
    act(t('roleConfirm', { n: name, r: t(`role_${r}` as StringKey) }), () => api.setRole(p.id, r), false, t('changeRole'))
  }

  return (
    <li className={`card person ${p.banned ? 'is-banned' : ''}`}>
      <div className="person-head">
        <div className="person-names">
          <strong>{p.full_name}</strong>
          {p.nickname && <span className="person-nick">„{p.nickname}“</span>}
        </div>
        <span className={`role-chip role-${p.role}`}>{t(`role_${p.role}` as StringKey)}</span>
      </div>
      <p className="muted person-meta">{p.email}<br />{t('memberSince', { d: fmt(p.created_at) })}</p>
      {p.warned_until && <p className="status-line warn">⚠ {t('isWarned', { d: fmt(p.warned_until, true) })}</p>}
      {p.banned && <p className="status-line ban">⛔ {t('isBanned')}</p>}
      {me && <p className="muted">{t('you2')}</p>}

      {canManage && (
        <div className="person-actions">
          {!p.banned && (
            <label className="field role-select">
              <span className="field-label">{t('changeRole')}</span>
              <select value={p.role} disabled={busy} onChange={e => changeRole(e.target.value as Role)}>
                {roles.map(r => <option key={r} value={r}>{t(`role_${r}` as StringKey)}</option>)}
              </select>
            </label>
          )}
          <div className="row-actions">
            {!p.banned && !p.warned_until && (
              <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => act(t('warnConfirm', { n: name }), () => api.warn(p.id), false, t('warnNick'))}>{t('warnNick')}</button>
            )}
            {p.warned_until && (
              <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => act(t('removeWarn') + '?', () => api.removeWarning(p.id), false, t('removeWarn'))}>{t('removeWarn')}</button>
            )}
            {!p.banned
              ? <button className="btn btn-danger btn-small" disabled={busy} onClick={() => act(t('banConfirm', { n: name }), () => api.ban(p.id), true, t('banNow'))}>{t('banNow')}</button>
              : <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => act(t('liftBan') + '?', () => api.unban(p.id), false, t('liftBan'))}>{t('liftBan')}</button>}
          </div>
        </div>
      )}
    </li>
  )
}
