import { useState, type FormEvent } from 'react'
import { Page } from '../../components/Page'
import { Cz } from '../../components/Cz'
import { Field } from '../../components/Field'
import { Loading } from '../../components/Loading'
import { Sheet } from '../../components/Sheet'
import { useDialog } from '../../components/Dialog'
import { api, type EventItem } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { pick } from '../../lib/guest'
import { useLoad } from '../../lib/useLoad'

const today = () => new Date().toISOString().slice(0, 10)
const srDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}` }

export function EventsEdit() {
  const { t, lang } = useI18n()
  const dialog = useDialog()
  const events = useLoad(() => api.allEvents())
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    try { await fn() } catch { dialog({ message: t('error') }) }
    events.reload()
  }

  const notify = async (e: EventItem) => {
    if (!(await dialog({ message: t('notifyConfirm', { n: pick(e, 'title', lang) }), confirm: true, okLabel: t('notifyGuests') }))) return
    setSending(e.id)
    try { dialog({ message: t('notified', { n: await api.notifyEvent(e.id) }) }) } catch { dialog({ message: t('error') }) }
    setSending(null)
  }

  return (
    <Page title={t('editEvents')}>
      <button className="btn btn-ghost" onClick={() => setEditing({ date: today(), time: '21:00' })}>+ {t('newEvent')}</button>
      {!events.data ? <Loading error={events.error} /> : (
        <ul className="events" style={{ marginTop: 6 }}>
          {events.data.map(e => {
            const past = e.date < today()
            return (
              <li key={e.id} className={`card ${past ? 'is-past' : ''}`}>
                <div className="edit-row-main">
                  <strong className="event-title"><Cz>{pick(e, 'title', lang)}</Cz></strong>
                  {past && <span className="tag">{t('pastEvent')}</span>}
                </div>
                <p className="muted event-when">{srDate(e.date)} · {e.time.slice(0, 5)}</p>
                {pick(e, 'description', lang) && <p>{pick(e, 'description', lang)}</p>}
                <div className="edit-row-actions">
                  {!past && (
                    <button className="btn btn-small" disabled={sending === e.id} onClick={() => notify(e)}>🔔 {t('notifyGuests')}</button>
                  )}
                  <button className="link-btn" onClick={() => setEditing(e)}>{t('edit')}</button>
                  <button className="link-btn danger" onClick={async () => {
                    if (await dialog({ message: t('deleteEventConfirm', { n: pick(e, 'title', lang) }), confirm: true, danger: true, okLabel: t('delete') }))
                      run(() => api.deleteEvent(e.id))
                  }}>{t('delete')}</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editing && <EventForm row={editing} onClose={() => setEditing(null)} onSave={r => run(() => api.saveEvent(r)).then(() => setEditing(null))} />}
    </Page>
  )
}

function EventForm({ row, onClose, onSave }: { row: Partial<EventItem>; onClose: () => void; onSave: (r: Partial<EventItem>) => void }) {
  const { t } = useI18n()
  const [f, setF] = useState({
    title_sr: row.title_sr ?? '', title_en: row.title_en ?? '', description_sr: row.description_sr ?? '', description_en: row.description_en ?? '',
    date: row.date ?? today(), time: (row.time ?? '21:00').slice(0, 5),
  })
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({
      ...(row.id ? { id: row.id } : {}), title_sr: f.title_sr.trim(), title_en: f.title_en.trim(),
      description_sr: f.description_sr.trim() || null, description_en: f.description_en.trim() || null, date: f.date, time: f.time,
    })
  }
  return (
    <Sheet onClose={onClose} label={row.id ? t('edit') : t('newEvent')}>
      <form onSubmit={submit}>
        <h2 className="section-title" style={{ marginTop: 0 }}><Cz>{row.id ? t('edit') : t('newEvent')}</Cz></h2>
        <Field label={t('titleSr')} name="title_sr" required value={f.title_sr} onChange={e => set('title_sr')(e.target.value)} />
        <Field label={t('titleEn')} name="title_en" required value={f.title_en} onChange={e => set('title_en')(e.target.value)} />
        <label className="field">
          <span className="field-label">{t('descSr')}</span>
          <textarea rows={3} value={f.description_sr} onChange={e => set('description_sr')(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('descEn')}</span>
          <textarea rows={3} value={f.description_en} onChange={e => set('description_en')(e.target.value)} />
        </label>
        <div className="two-col">
          <Field label={t('date')} name="date" type="date" required value={f.date} onChange={e => set('date')(e.target.value)} />
          <Field label={t('time')} name="time" type="time" required value={f.time} onChange={e => set('time')(e.target.value)} />
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn">{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}
