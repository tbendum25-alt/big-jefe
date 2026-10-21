import type { Api } from './api'
import { demoApi } from './demoApi'
import { isSupabaseConfigured } from './supabase'
import { supabaseApi } from './supabaseApi'

/** Supabase si configuré, sinon le mode démonstration local. */
export const api: Api = isSupabaseConfigured ? supabaseApi : demoApi
