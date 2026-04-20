'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { auth, AppUser } from '@/lib/auth'

type AuthCtx = {
  user: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
  isAdmin: boolean
  isEditor: boolean
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, signOut: async () => {}, isAdmin: false, isEditor: false })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser() {
    const session = await auth.getSession()
    if (session?.user) {
      const profile = await auth.getProfile(session.user.id)
      setUser(profile)
    } else {
      setUser(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') loadUser()
      if (event === 'SIGNED_OUT') { setUser(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await auth.signOut()
    setUser(null)
  }

  return (
    <Ctx.Provider value={{
      user, loading, signOut,
      isAdmin:  user?.role === 'admin',
      isEditor: user?.role === 'admin' || user?.role === 'editor',
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() { return useContext(Ctx) }
