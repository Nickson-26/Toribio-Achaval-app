import { supabase } from './supabase'

export type UserRole = 'admin' | 'editor' | 'viewer'

export type AppUser = {
  id: string
  email: string
  nombre: string
  role: UserRole
  aprobado: boolean
  created_at: string
}

export const auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signUp(email: string, password: string, nombre: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // Create profile pending approval
    if (data.user) {
      await supabase.from('usuarios').insert({
        id: data.user.id,
        email,
        nombre,
        role: 'viewer',
        aprobado: false,
      })
    }
    return data
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async getProfile(userId: string): Promise<AppUser | null> {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()
    return data
  },

  async getAllUsers(): Promise<AppUser[]> {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false })
    return data || []
  },

  async updateUser(id: string, patch: Partial<AppUser>) {
    const { error } = await supabase.from('usuarios').update(patch).eq('id', id)
    if (error) throw error
  },

  async deleteUser(id: string) {
    await supabase.from('usuarios').delete().eq('id', id)
  },
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:  'Administrador',
  editor: 'Editor',
  viewer: 'Solo lectura',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  admin:  'badge-red',
  editor: 'badge-blue',
  viewer: 'badge-gray',
}
