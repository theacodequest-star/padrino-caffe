import { useState, type FormEvent } from 'react'
import { Page } from '../components/Page'
import { Field } from '../components/Field'
import { NicknameField, type NickState } from './NicknameField'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { maxBirthYear, useAuth } from '../lib/auth'

// "Još samo malo": an account without a nickname or year of birth (from the old app's Google sign-in) fills them in first.
export function CompleteProfile() {
  const { t } = useI18n()
  const { session, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [nick, setNick] = useState<NickState>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const tooYoung = birthYear.length === 4 && Number(birthYear) > maxBirthYear()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session || nick === 'taken' || tooYoung) return
    setBusy(true); setError('')
    const fullName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
    const { error } = await supabase.from('profiles')
      .update({ nickname: nickname.trim(), birth_year: Number(birthYear), ...(fullName ? { name: fullName } : {}) })
      .eq('id', session.user.id)
    setBusy(false)
    if (error) setError(/duplicate|unique/i.test(error.message) ? t('nicknameTaken') : t('error'))
    else await refreshProfile()
  }

  return (
    <Page title={t('almostThere')} back={false}>
      <p className="center">{t('almostThereText')}</p>
      <form onSubmit={submit}>
        <NicknameField value={nickname} onChange={setNickname} onState={setNick} />
        <Field
          label={t('birthYear')} name="birthYear" required inputMode="numeric" pattern="\d{4}" maxLength={4}
          value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, ''))}
          error={tooYoung ? t('tooYoung') : undefined}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" disabled={busy || nick !== 'free' || birthYear.length !== 4 || tooYoung}>{t('save')}</button>
      </form>
    </Page>
  )
}
