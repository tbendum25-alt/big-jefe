// Fonction serveur : création d'une transaction FedaPay pour le solde d'une facture.
// Variables : FEDAPAY_SECRET_KEY, FEDAPAY_ENV (« sandbox » par défaut, « live » en production), SITE_URL.
// ⚠ À valider avec la documentation FedaPay (https://docs.fedapay.com) et un compte marchand avant la mise en production.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const base = () =>
  Deno.env.get('FEDAPAY_ENV') === 'live' ? 'https://api.fedapay.com' : 'https://sandbox-api.fedapay.com'

async function fedapay(path: string, init: RequestInit & { body?: string }) {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('FEDAPAY_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`FedaPay ${res.status}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!Deno.env.get('FEDAPAY_SECRET_KEY')) return json({ error: 'not_configured' }, 503)
  try {
    const { invoice_id, email } = await req.json()
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: inv } = await db.from('invoices').select('*').eq('id', invoice_id).maybeSingle()
    if (!inv) return json({ error: 'not_found' }, 404)
    // Le montant vient de la facture en base (jamais du navigateur) et seul le client concerné peut payer.
    if (inv.payment_method !== 'online' || inv.balance <= 0) return json({ error: 'not_payable' }, 400)
    if (inv.kind === 'booking' && String(email).toLowerCase() !== String(inv.customer_email).toLowerCase())
      return json({ error: 'forbidden' }, 403)

    const [first, ...rest] = String(inv.customer_name).split(' ')
    const created = await fedapay('/v1/transactions', {
      method: 'POST',
      body: JSON.stringify({
        description: `${inv.hotel?.name ?? 'Hôtel'} — facture ${inv.number}`,
        amount: inv.balance,
        currency: { iso: 'XOF' },
        callback_url: `${Deno.env.get('SITE_URL') ?? ''}/ma-reservation`,
        customer: { firstname: first, lastname: rest.join(' ') || first, email: inv.customer_email || undefined },
      }),
    })
    const tx = created['v1/transaction'] ?? created.transaction ?? created
    const token = await fedapay(`/v1/transactions/${tx.id}/token`, { method: 'POST' })

    await db.from('payments').insert({
      invoice_id: inv.id,
      amount: inv.balance,
      method: 'FedaPay',
      provider: 'fedapay',
      provider_ref: String(tx.id),
      status: 'pending',
    })
    return json({ url: token.url })
  } catch (e) {
    console.error('fedapay-create', e)
    return json({ error: 'failed' }, 502)
  }
})
