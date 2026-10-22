import { useState, type FormEvent } from 'react'
import { Page } from '../../components/Page'
import { Field } from '../../components/Field'
import { Loading } from '../../components/Loading'
import { Sheet } from '../../components/Sheet'
import { useDialog } from '../../components/Dialog'
import { api, type Reward } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { pick, pointsWord } from '../../lib/guest'
import { useLoad } from '../../lib/useLoad'

export function RewardsEdit() {
  const { t, lang } = useI18n()
  const dialog = useDialog()
  const rewards = useLoad(() => api.allRewards())
  const [editing, setEditing] = useState<Partial<Reward> | null>(null)

  const run = async (fn: () => Promise<void>) => {
    try { await fn() } catch { dialog({ message: t('error') }) }
    rewards.reload()
  }

  return (
    <Page title={t('editRewards')}>
      <button className="btn btn-ghost" onClick={() => setEditing({ visible: true, sort_order: (rewards.data?.length ?? 0) + 1 })}>+ {t('newReward')}</button>
      {!rewards.data ? <Loading error={rewards.error} /> : (
        <ul className="list" style={{ marginTop: 14 }}>
          {rewards.data.map(r => (
            <li key={r.id} className="list-row edit-row">
              <div className="edit-row-main">
                <span className={r.visible ? '' : 'muted'}>{pick(r, 'name', lang)}</span>
                <span className="price">{r.cost} {pointsWord(r.cost, lang)}</span>
              </div>
              <div className="edit-row-actions">
                <label className="switch-toggle">
                  <input type="checkbox" role="switch" checked={r.visible} onChange={e => run(() => api.saveReward({ id: r.id, visible: e.target.checked }))} />
                  <span>{r.visible ? t('shown') : t('hiddenR')}</span>
                </label>
                <button className="link-btn" onClick={() => setEditing(r)}>{t('edit')}</button>
                <button className="link-btn danger" onClick={async () => {
                  if (await dialog({ message: t('deleteRewardConfirm', { n: pick(r, 'name', lang) }), confirm: true, danger: true, okLabel: t('delete') }))
                    run(() => api.deleteReward(r.id))
                }}>{t('delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <RewardForm row={editing} onClose={() => setEditing(null)} onSave={r => run(() => api.saveReward(r)).then(() => setEditing(null))} />}
    </Page>
  )
}

function RewardForm({ row, onClose, onSave }: { row: Partial<Reward>; onClose: () => void; onSave: (r: Partial<Reward>) => void }) {
  const { t } = useI18n()
  const [f, setF] = useState({
    name_sr: row.name_sr ?? '', name_en: row.name_en ?? '', cost: row.cost ? String(row.cost) : '',
    sort_order: String(row.sort_order ?? 1), visible: row.visible ?? true,
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ ...(row.id ? { id: row.id } : {}), name_sr: f.name_sr.trim(), name_en: f.name_en.trim(), cost: Number(f.cost), sort_order: Number(f.sort_order) || 0, visible: f.visible })
  }
  return (
    <Sheet onClose={onClose} label={row.id ? t('edit') : t('newReward')}>
      <form onSubmit={submit}>
        <h2 className="section-title" style={{ marginTop: 0 }}>{row.id ? t('edit') : t('newReward')}</h2>
        <Field label={t('nameSr')} name="name_sr" required value={f.name_sr} onChange={e => setF({ ...f, name_sr: e.target.value })} />
        <Field label={t('nameEn')} name="name_en" required value={f.name_en} onChange={e => setF({ ...f, name_en: e.target.value })} />
        <Field label={t('costPoints')} name="cost" required inputMode="numeric" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value.replace(/\D/g, '') })} />
        <Field label={t('sortOrder')} name="sort_order" inputMode="numeric" value={f.sort_order} onChange={e => setF({ ...f, sort_order: e.target.value.replace(/\D/g, '') })} />
        <label className="switch-toggle">
          <input type="checkbox" role="switch" checked={f.visible} onChange={e => setF({ ...f, visible: e.target.checked })} />
          <span>{f.visible ? t('shown') : t('hiddenR')}</span>
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn" disabled={!f.cost}>{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}
