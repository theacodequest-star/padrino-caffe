import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { demo } from './demo'

export type Role = 'guest' | 'waiter' | 'admin' | 'owner'

// Column names follow the spec; confirm against the existing migrations.
export type Profile = {
  id: string
  full_name: string | null
  nickname: string | null
  birth_year: number | null
  role: Role
  language: string | null
  hide_from_leaderboard: boolean | null
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
    setProfile((data as Profile) ?? null)
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

  const refreshProfile = () => fetchProfile(session)
  return <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export const isStaff = (r?: Role) => r === 'waiter' || r === 'admin' || r === 'owner'
export const isManager = (r?: Role) => r === 'admin' || r === 'owner'

export async function nicknameAvailable(nickname: string, selfId?: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('id').ilike('nickname', nickname.replace(/[%_\\]/g, '\\$&')).limit(1)
  if (error) return true
  return !data?.length || data[0].id === selfId
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export const MIN_AGE = 13
export const maxBirthYear = () => new Date().getFullYear() - MIN_AGE
