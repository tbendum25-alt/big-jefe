import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Vrai quand les variables d'environnement Supabase sont renseignées (voir .env.example). */
export const isSupabaseConfigured = Boolean(url && anonKey)

// Seule la clé « anon » (publique) est utilisée ici. Les clés secrètes restent dans les fonctions serveur.
export const supabase = isSupabaseConfigured ? createClient(url as string, anonKey as string) : null
