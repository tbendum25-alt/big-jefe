// Fonction serveur : notification de FedaPay (webhook).
// Le contenu reçu n'est JAMAIS cru : on relit la transaction auprès de FedaPay avec la clé secrète,
// puis on compare statut et montant avec le paiement attendu avant de le marquer « réussi ».
// Déployer avec : supabase functions deploy fedapay-webhook --no-verify-jwt
// Puis déclarer l'URL de cette fonction dans le tableau de bord FedaPay (Webhooks).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { json } from '../_shared/cors.ts'

const base = () =>
  Deno.env.get('FEDAPAY_ENV') === 'live' ? 'https://api.fedapay.com' : 'https://sandbox-api.fedapay.com'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!Deno.env.get('FEDAPAY_SECRET_KEY')) return json({ error: 'not_configured' }, 503)
  try {
    const event = await req.json()
    const txId = event?.entity?.id ?? event?.id
    if (!txId) return json({ ok: true })

    const res = await fetch(`${base()}/v1/transactions/${txId}`, {
      headers: { Authorization: `Bearer ${Deno.env.get('FEDAPAY_SECRET_KEY')}` },
    })
    if (!res.ok) return json({ error: 'verify_failed' }, 502)
    const payload = await res.json()
    const tx = payload['v1/transaction'] ?? payload.transaction ?? payload

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: payment } = await db
      .from('payments')
      .select('*')
      .eq('provider', 'fedapay')
      .eq('provider_ref', String(txId))
      .maybeSingle()
    if (!payment) return json({ ok: true })

    let status: 'succeeded' | 'failed' | 'refunded' | null = null
    if (tx.status === 'approved' || tx.status === 'transferred') {
      // Le montant confirmé par FedaPay doit être exactement celui attendu.
      status = Number(tx.amount) === payment.amount ? 'succeeded' : 'failed'
    } else if (tx.status === 'declined' || tx.status === 'canceled') status = 'failed'
    else if (tx.status === 'refunded') status = 'refunded'

    if (status && status !== payment.status) {
      await db.from('payments').update({ status }).eq('id', payment.id)
    }
    return json({ ok: true })
  } catch (e) {
    console.error('fedapay-webhook', e)
    return json({ error: 'failed' }, 500)
  }
})
