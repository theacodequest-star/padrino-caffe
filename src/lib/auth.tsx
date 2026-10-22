import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { demo } from './demo'
import { api } from './api'
import { load, remove, save } from './storage'

export type Role = 'guest' | 'waiter' | 'admin' | 'owner'

// The app's view of a profile row (name → full_name, nickname_deadline → warned_until, banned_at → banned).
export type Profile = {
  id: string
  full_name: string | null
  nickname: string | null
  birth_year: number | null
  role: Role
  language: string | null
  hide_from_leaderboard: boolean | null
  event_emails: boolean
  warned_until: string | null
  banned: boolean | null
}

type Ctx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<Ctx>({ session: null, profile: null, loading: true, refreshProfile: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (s: Session | null) => {
    if (demo.on) { setProfile({ ...demo.profile }); return }
    if (!s) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    setProfile(data ? {
      id: data.id, full_name: data.name, nickname: data.nickname, birth_year: data.birth_year, role: data.role === 'customer' ? 'guest' : data.role,
      language: data.language, hide_from_leaderboard: data.hide_from_leaderboard, event_emails: data.event_emails ?? true,
      warned_until: data.banned_at ? null : data.nickname_deadline, banned: !!data.banned_at,
    } : null)
  }, [])

  useEffect(() => {
    if (demo.on) {
      setSession({ user: { id: demo.profile.id, user_metadata: {} } } as unknown as Session)
      setProfile(demo.profile)
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await fetchProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Run outside the callback so Supabase isn't called while it holds its auth lock.
      setTimeout(() => { fetchProfile(s) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [fetchProfile])

  // Count this visit as activity (event emails only go to people active recently).
  const userId = session?.user.id
  useEffect(() => {
    if (userId && !demo.on) supabase.rpc('touch_last_seen').then(() => {})
  }, [userId])

  // One device per account: logging in elsewhere ends this session on the server, so check it
  // every minute and whenever the app comes back to the screen, and sign out here when it is gone.
  useEffect(() => {
    if (!userId || demo.on) return
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const { error } = await supabase.auth.getUser()
      // Only a definite "no such session" counts; being offline must not log anyone out.
      if (error && (error.status === 401 || error.status === 403)) {
        save(KICKED_KEY, '1')
        await supabase.auth.signOut({ scope: 'local' })
      }
    }
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [userId])

  const refreshProfile = () => fetchProfile(session)
  return <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export const isStaff = (r?: Role) => r === 'waiter' || r === 'admin' || r === 'owner'
export const isManager = (r?: Role) => r === 'admin' || r === 'owner'

// Nicknames are unique ignoring case; the database answers without exposing other profiles.
export async function nicknameAvailable(nickname: string): Promise<boolean> {
  try { return !(await api.nicknameTaken(nickname)) } catch { return true }
}

const KICKED_KEY = 'padrino.kicked'

// Call right after a fresh login: ends the account's sessions on every other device.
export async function endOtherSessions() {
  if (!demo.on) await supabase.auth.signOut({ scope: 'others' })
}

// Set when this device was signed out because the account logged in somewhere else.
export const wasSignedOutElsewhere = () => load(KICKED_KEY) === '1'
export const clearSignedOutElsewhere = () => remove(KICKED_KEY)

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export const MIN_AGE = 13
export const maxBirthYear = () => new Date().getFullYear() - MIN_AGE
