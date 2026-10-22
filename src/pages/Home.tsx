import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useI18n, type StringKey } from '../lib/i18n'
import { isManager, isStaff, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { api, type EventItem } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { InstallButton } from '../components/InstallButton'
import { pick } from '../lib/guest'

const tile = (to: string, label: StringKey) => ({ to, label })

export function Home() {
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const role = profile?.role ?? 'guest'
  const open = useLoad(() => (isStaff(role) ? Promise.resolve(null) : api.myOpenOrder()), [role])
  // Only events that haven't started yet; past and deleted ones never come back from the database.
  const upcoming = useLoad(() => api.events()).data ?? []
  const next = upcoming[0]

  const Tiles = ({ items, guest }: { items: { to: string; label: StringKey }[]; guest?: boolean }) => (
    <div className={guest ? 'tiles tiles-guest' : 'tiles'}>
      {items.map(i => (
        <Link key={i.to} to={i.to} className="tile">
          {t(i.label)}
          {i.to === '/events' && upcoming.length > 0 && <span className="tile-badge" aria-label={t('upcomingCount', { n: upcoming.length })}>{upcoming.length}</span>}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="page">
      <div className="home-head">
        <Logo />
        <h1 className="title" style={{ marginBottom: 0 }}>{profile?.nickname ?? 'Padrino'}</h1>
        <p>{t(`role_${role}`)}</p>
      </div>

      {isStaff(role) ? (
        <>
          <Link to="/scan" className="btn btn-big" style={{ marginTop: 24 }}>{t('scanOrder')}</Link>
          <h2 className="group-title">{t('everyDay')}</h2>
          <Tiles items={[tile('/orders', 'orders'), tile('/redeem', 'redeem'), tile('/menu', 'menu'), tile('/events', 'events')]} />
          {isManager(role) && (
            <>
              <h2 className="group-title">{t('management')}</h2>
              <Tiles items={[
                tile('/admin/stats', 'statistics'), tile('/admin/staff', 'staff'), tile('/admin/menu', 'editMenu'),
                tile('/admin/rewards', 'editRewards'), tile('/admin/reviews', 'waiterReviews'), tile('/admin/events', 'editEvents'),
              ]} />
            </>
          )}
        </>
      ) : (
        <div style={{ marginTop: 24 }}>
          {open.data && <Link to={`/order/${open.data.id}`} className="btn btn-big open-order">{t('yourOrder')} · {t(`st_${open.data.status}`)}</Link>}
          {next && <NextEvent event={next} more={upcoming.length - 1} lang={lang} />}
          <Tiles guest items={[tile('/menu', 'menu'), tile('/events', 'events'), tile('/points', 'myPoints')]} />
        </div>
      )}

      <p className="footer-quote">„{t('footer')}“</p>
      <div className="logout">
        <InstallButton className="link-btn" />
        <button onClick={() => supabase.auth.signOut()}>{t('logout')}</button>
      </div>
    </div>
  )
}

// A highlighted card on the guest home screen while an event is coming up.
function NextEvent({ event: e, more, lang }: { event: EventItem; more: number; lang: 'sr' | 'en' }) {
  const { t } = useI18n()
  const d = new Date(`${e.date}T00:00:00`)
  const locale = lang === 'sr' ? 'sr-Latn-RS' : 'en-GB'
  return (
    <Link to="/events" className="card next-event">
      <div className="event-date" aria-hidden="true">
        <span className="event-day">{d.getDate()}</span>
        <span className="event-month">{d.toLocaleDateString(locale, { month: 'short' })}</span>
      </div>
      <div className="next-event-text">
        <span className="next-event-label">{t('comingUp')}</span>
        <strong className="event-title">{pick(e, 'title', lang)}</strong>
        <span className="muted">{d.toLocaleDateString(locale, { weekday: 'long' })} · {e.time.slice(0, 5)}</span>
        {more > 0 && <span className="muted">{t('moreEvents', { n: more })}</span>}
      </div>
      <span className="next-event-go" aria-hidden="true">›</span>
    </Link>
  )
}
