import { Page } from '../components/Page'
import { Loading } from '../components/Loading'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { pick } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

export function Events() {
  const { t, lang } = useI18n()
  const events = useLoad(() => api.events())

  return (
    <Page title={t('events')}>
      {!events.data ? <Loading error={events.error} /> : events.data.length === 0 ? <p className="muted center">{t('noEvents')}</p> : (
        <ul className="events">
          {events.data.map(e => {
            const d = new Date(`${e.date}T00:00:00`)
            return (
              <li key={e.id} className="card event">
                <div className="event-date" aria-hidden="true">
                  <span className="event-day">{d.getDate()}</span>
                  <span className="event-month">{d.toLocaleDateString(lang === 'sr' ? 'sr-Latn-RS' : 'en-GB', { month: 'short' })}</span>
                </div>
                <div>
                  <h2 className="event-title">{pick(e, 'title', lang)}</h2>
                  <p className="muted event-when">
                    {d.toLocaleDateString(lang === 'sr' ? 'sr-Latn-RS' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })} · {e.time.slice(0, 5)}
                  </p>
                  {pick(e, 'description', lang) && <p>{pick(e, 'description', lang)}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
