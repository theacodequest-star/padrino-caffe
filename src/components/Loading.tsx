import { useI18n } from '../lib/i18n'

export function Loading({ error }: { error?: string | null }) {
  const { t } = useI18n()
  return <p className={error ? 'form-error center' : 'muted center'}>{error ? t('error') : t('loading')}</p>
}
