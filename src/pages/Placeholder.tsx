import { Page } from '../components/Page'
import { useI18n } from '../lib/i18n'

export function NotFound() {
  const { t } = useI18n()
  return <Page title="404"><p className="center">{t('notFound')}</p></Page>
}
