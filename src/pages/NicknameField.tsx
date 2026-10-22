import { useEffect, useState } from 'react'
import { Field } from '../components/Field'
import { useI18n } from '../lib/i18n'
import { nicknameAvailable } from '../lib/auth'

export type NickState = 'idle' | 'checking' | 'free' | 'taken'

export function NicknameField({ value, onChange, onState }: {
  value: string
  onChange: (v: string) => void
  onState: (s: NickState) => void
}) {
  const { t } = useI18n()
  const [state, setState] = useState<NickState>('idle')

  useEffect(() => {
    const nick = value.trim()
    if (nick.length < 2) { setState('idle'); onState('idle'); return }
    setState('checking'); onState('checking')
    const timer = setTimeout(async () => {
      const s = (await nicknameAvailable(nick)) ? 'free' : 'taken'
      setState(s); onState(s)
    }, 350)
    return () => clearTimeout(timer)
  }, [value, onState])

  return (
    <Field
      label={t('nickname')} name="nickname" required minLength={2} maxLength={24} autoComplete="nickname"
      value={value} onChange={e => onChange(e.target.value)}
      hint={t('nicknameHint')}
      error={state === 'taken' ? t('nicknameTaken') : undefined}
      ok={state === 'free' ? t('nicknameFree') : undefined}
    />
  )
}
