// Fonction serveur : gestion de l'équipe de l'administration.
//   status  (public)    : la configuration initiale est-elle ouverte ? (aucun propriétaire + SETUP_CODE défini)
//   setup   (public)    : crée le compte PROPRIÉTAIRE, une seule fois, avec le code SETUP_CODE
//   list    (connecté)  : liste des comptes de l'administration
//   add     (propriétaire) : crée un compte employé
//   remove  (propriétaire) : supprime un compte employé
// Variables : SETUP_CODE (secret à définir : `supabase secrets set SETUP_CODE=...`), SITE_URL.
// La clé « service role » ne quitte jamais ce serveur : le navigateur ne peut créer aucun compte lui-même.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const MIN_PASSWORD = 10
const emailOk = (e: unknown): e is string =>
  typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
const passwordOk = (p: unknown): p is string => typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= 200

/** Comparaison à durée constante (évite de deviner le code lettre par lettre). */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const action = String(body.action ?? '')

    const countAdmins = async () => {
      const { count } = await db.from('admin_users').select('user_id', { count: 'exact', head: true })
      return count ?? 0
    }

    if (action === 'status') {
      return json({ needs_setup: Boolean(Deno.env.get('SETUP_CODE')) && (await countAdmins()) === 0 })
    }

    if (action === 'setup') {
      const code = Deno.env.get('SETUP_CODE')
      if (!code) return json({ error: "La configuration initiale n'est pas activée sur ce site." }, 403)
      if ((await countAdmins()) > 0) return json({ error: 'Un propriétaire existe déjà.' }, 409)
      if (!safeEqual(String(body.code ?? ''), code)) return json({ error: 'Code de configuration incorrect.' }, 403)
      if (!emailOk(body.email)) return json({ error: 'Adresse e-mail invalide.' }, 400)
      if (!passwordOk(body.password)) return json({ error: `Mot de passe : ${MIN_PASSWORD} caractères minimum.` }, 400)

      const { data, error } = await db.auth.admin.createUser({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        email_confirm: true,
      })
      if (error || !data.user) return json({ error: 'Création du compte impossible (e-mail déjà utilisé ?).' }, 400)
      // L'index unique « un seul propriétaire » refuse une seconde création simultanée.
      const { error: insertError } = await db.from('admin_users').insert({ user_id: data.user.id, role: 'owner' })
      if (insertError) {
        await db.auth.admin.deleteUser(data.user.id)
        return json({ error: 'Un propriétaire existe déjà.' }, 409)
      }
      return json({ ok: true })
    }

    // Actions réservées aux comptes de l'administration : on vérifie le jeton de l'appelant.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await db.auth.getUser(token)
    const caller = auth?.user
    if (!caller) return json({ error: 'Connexion requise.' }, 401)
    const { data: me } = await db.from('admin_users').select('role').eq('user_id', caller.id).maybeSingle()
    if (!me) return json({ error: 'Accès refusé.' }, 403)
    const isOwner = me.role === 'owner'

    if (action === 'list') {
      const { data: rows } = await db.from('admin_users').select('user_id, role, created_at').order('created_at')
      const members = await Promise.all(
        (rows ?? []).map(async (r) => {
          const { data } = await db.auth.admin.getUserById(r.user_id)
          return {
            user_id: r.user_id,
            email: data.user?.email ?? '(compte introuvable)',
            role: r.role,
            created_at: r.created_at,
            is_self: r.user_id === caller.id,
          }
        }),
      )
      return json({ members })
    }

    if (action === 'add') {
      if (!isOwner) return json({ error: 'Seul le propriétaire peut ajouter des employés.' }, 403)
      if (!emailOk(body.email)) return json({ error: 'Adresse e-mail invalide.' }, 400)
      if (!passwordOk(body.password)) return json({ error: `Mot de passe : ${MIN_PASSWORD} caractères minimum.` }, 400)
      const { data, error } = await db.auth.admin.createUser({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        email_confirm: true,
      })
      if (error || !data.user) return json({ error: 'Création du compte impossible (e-mail déjà utilisé ?).' }, 400)
      const { error: insertError } = await db.from('admin_users').insert({ user_id: data.user.id, role: 'staff' })
      if (insertError) {
        await db.auth.admin.deleteUser(data.user.id)
        return json({ error: "Le compte n'a pas pu être ajouté à l'équipe." }, 500)
      }
      return json({ ok: true })
    }

    if (action === 'remove') {
      if (!isOwner) return json({ error: 'Seul le propriétaire peut retirer des employés.' }, 403)
      const target = String(body.user_id ?? '')
      const { data: row } = await db.from('admin_users').select('role').eq('user_id', target).maybeSingle()
      if (!row) return json({ error: 'Compte introuvable.' }, 404)
      if (target === caller.id || row.role === 'owner') return json({ error: 'Le compte propriétaire ne peut pas être retiré.' }, 400)
      // Supprimer le compte d'authentification supprime aussi sa ligne admin_users (on delete cascade).
      const { error } = await db.auth.admin.deleteUser(target)
      if (error) return json({ error: 'Suppression impossible.' }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Action inconnue.' }, 400)
  } catch {
    return json({ error: 'Erreur du serveur.' }, 500)
  }
})
