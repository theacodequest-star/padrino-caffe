import type { ReactNode } from 'react'
import { Page } from './Page'
import { useAuth, type Role } from '../lib/auth'
import { useI18n } from '../lib/i18n'

const LEVEL: Record<Role, number> = { guest: 0, waiter: 1, admin: 2, owner: 3 }

// Hides staff pages from the wrong roles. The database enforces the same rules.
export function RoleGate({ min, children }: { min: Role; children: ReactNode }) {
  const { profile } = useAuth()
  const { t } = useI18n()
  if (LEVEL[profile?.role ?? 'guest'] < LEVEL[min]) return <Page><p className="center">{t('noAccess')}</p></Page>
  return <>{children}</>
}
