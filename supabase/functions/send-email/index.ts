// Fonction serveur : envoi des e-mails (confirmation de réservation, commande, message de contact).
// Service d'envoi : Resend (https://resend.com). Variables : RESEND_API_KEY, MAIL_FROM.
// Elle ne reçoit que des références : le contenu est relu en base, donc elle ne peut pas servir de relais de spam.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const fcfa = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`
const RECENT_MS = 15 * 60 * 1000

async function sendMail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM')
  if (!key || !from || !to) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await db.from('hotel_settings').select('*').eq('id', 1).single()
    const owner = settings?.email as string
    const hotel = esc(settings?.name ?? 'Hôtel')
    const fresh = (iso: string) => Date.now() - new Date(iso).getTime() < RECENT_MS

    if (body.kind === 'booking') {
      const { data: b } = await db.from('bookings').select('*').eq('reference', body.reference).ilike('guest_email', body.email).maybeSingle()
      if (!b || !fresh(b.created_at)) return json({ sent: false })
      const lines = `
        <p>Référence : <strong>${esc(b.reference)}</strong></p>
        <p>Séjour : ${esc(b.check_in)} → ${esc(b.check_out)} (${b.nights} nuit(s)), ${b.guests} personne(s)</p>
        <p>Total : <strong>${fcfa(b.total)}</strong> — paiement : ${b.payment_method === 'online' ? 'en ligne' : "à l'hôtel"}</p>`
      const guest = await sendMail(
        b.guest_email,
        `${settings?.name} — demande de réservation ${b.reference}`,
        `<p>Bonjour ${esc(b.guest_name)},</p><p>Nous avons bien reçu votre demande de réservation. Elle sera confirmée par l'hôtel.</p>${lines}
         <p>Retrouvez votre facture dans « Ma réservation » avec votre numéro et cet e-mail.</p><p>${hotel}</p>`,
      )
      const staff = await sendMail(
        owner,
        `Nouvelle réservation ${b.reference}`,
        `<p>Nouvelle demande de ${esc(b.guest_name)} (${esc(b.guest_email)}, ${esc(b.guest_phone)}).</p>${lines}<p>${esc(b.notes)}</p>`,
        b.guest_email,
      )
      return json({ sent: guest || staff })
    }

    if (body.kind === 'order') {
      const { data: o } = await db.from('orders').select('*').eq('reference', body.reference).maybeSingle()
      if (!o || !fresh(o.created_at)) return json({ sent: false })
      const items = (o.items as { quantity: number; name: string }[]).map((i) => `<li>${i.quantity} × ${esc(i.name)}</li>`).join('')
      const staff = await sendMail(
        owner,
        `Nouvelle commande ${o.reference}`,
        `<p>${esc(o.guest_name)} (${esc(o.guest_phone)}) — ${esc(o.mode)}${o.room_number ? ` — chambre ${esc(o.room_number)}` : ''}</p><ul>${items}</ul><p>Total : <strong>${fcfa(o.total)}</strong></p>`,
      )
      return json({ sent: staff })
    }

    if (body.kind === 'contact') {
      const { data: m } = await db.from('contact_messages').select('*').eq('id', body.message_id).maybeSingle()
      if (!m || !fresh(m.created_at)) return json({ sent: false })
      const staff = await sendMail(
        owner,
        `Message de ${m.name} via le site`,
        `<p><strong>${esc(m.name)}</strong> — ${esc(m.email)} ${esc(m.phone)}</p><p>${esc(m.message).replace(/\n/g, '<br>')}</p>`,
        m.email,
      )
      return json({ sent: staff })
    }

    return json({ error: 'kind inconnu' }, 400)
  } catch (e) {
    console.error('send-email', e)
    return json({ sent: false, error: 'échec' }, 200) // jamais bloquant pour le site
  }
})
