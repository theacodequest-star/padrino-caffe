import { useState, type FormEvent } from 'react'
import { Page } from '../components/Page'
import { Scanner } from '../components/Scanner'
import { useDialog } from '../components/Dialog'
import { api, type MemberSummary, type Reward } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { pick, pointsWord } from '../lib/guest'

const UUIDISH = /^[0-9a-z-]{6,}$/i

export function Redeem() {
  const { t, lang } = useI18n()
  const dialog = useDialog()
  const [member, setMember] = useState<MemberSummary | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState('')

  const lookup = async (raw: string) => {
    const id = raw.replace(/^padrino:member:/i, '').trim()
    if (!UUIDISH.test(id) || busy) return
    setBusy(true); setMsg(null)
    try {
      const [m, r] = await Promise.all([api.member(id), api.rewards()])
      if (!m) setMsg({ text: t('memberNotFound'), kind: 'error' })
      else { setMember(m); setRewards(r) }
    } catch { setMsg({ text: t('error'), kind: 'error' }) }
    setBusy(false)
  }

  const redeem = async (r: Reward) => {
    if (!member) return
    const ok = await dialog({ message: t('redeemConfirm', { r: pick(r, 'name', lang), n: r.cost }), confirm: true, okLabel: t('use') })
    if (!ok) return
    setBusy(true)
    try {
      await api.redeemReward(member.user_id, r.id)
      setMember({ ...member, balance: member.balance - r.cost })
      setMsg({ text: t('redeemed'), kind: 'ok' })
    } catch { setMsg({ text: t('error'), kind: 'error' }) }
    setBusy(false)
  }

  const submit = (e: FormEvent) => { e.preventDefault(); lookup(manual) }

  return (
    <Page title={t('redeem')}>
      {!member ? (
        <>
          <Scanner onResult={lookup} paused={busy} />
          <p className="muted center">{t('scanMember')}</p>
          <form onSubmit={submit} className="code-form">
            <label className="field">
              <span className="field-label">ID</span>
              <input value={manual} autoComplete="off" spellCheck={false} onChange={e => setManual(e.target.value.trim())} />
            </label>
            <button className="btn" disabled={busy || !UUIDISH.test(manual)}>{t('find')}</button>
          </form>
        </>
      ) : (
        <>
          <div className="card balance">
            <strong className="member-nick" style={{ marginTop: 0 }}>{member.nickname}</strong>
            {member.full_name && <span className="muted">{member.full_name}</span>}
            <span className="balance-num">{member.balance}</span>
            <span className="muted">{pointsWord(member.balance, lang)}</span>
          </div>
          {member.blocked ? <p className="form-error center">{t('memberBlocked')}</p> : (
            <ul className="list" style={{ marginTop: 16 }}>
              {rewards.map(r => {
                const enough = member.balance >= r.cost
                return (
                  <li key={r.id} className="list-row">
                    <span>{pick(r, 'name', lang)}<br /><span className="muted">{r.cost} {pointsWord(r.cost, lang)}</span></span>
                    {enough
                      ? <button className="btn btn-small" disabled={busy} onClick={() => redeem(r)}>{t('use')}</button>
                      : <span className="tag">{t('notEnough')}</span>}
                  </li>
                )
              })}
            </ul>
          )}
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => { setMember(null); setMsg(null); setManual('') }}>{t('scanAnother')}</button>
        </>
      )}
      {msg && <p className={`scan-msg ${msg.kind}`} role="status">{msg.text}</p>}
    </Page>
  )
}
