import { useState } from 'react'
import { api } from '../lib'
import { dateFr, fcfa, statusLabels } from '../lib/format'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import type { Booking, Invoice } from '../lib/types'
import { StatusBadge } from './ui'

/** Récapitulatif d'une réservation + sa facture figée (confirmation et consultation client). */
export function BookingSummary({ booking, invoice }: { booking: Booking; invoice: Invoice }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const pay = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await api.startOnlinePayment(invoice.id, booking.guest_email)
      if (result.state === 'redirect') window.location.href = result.url
      else setMessage(result.message)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Paiement indisponible.')
    } finally {
      setBusy(false)
    }
  }

  const canPay = booking.payment_method === 'online' && invoice.balance > 0 && booking.status !== 'cancelled'

  return (
    <div className="card p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label !mb-1">Numéro de réservation</p>
          <p className="font-display text-4xl text-emerald-deep font-bold tracking-wide">{booking.reference}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={booking.status} label={statusLabels[booking.status]} />
          <StatusBadge status={invoice.payment_status} label={statusLabels[invoice.payment_status]} />
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <dt className="label">Séjour</dt>
          <dd>
            {dateFr(booking.check_in)} → {dateFr(booking.check_out)} ({booking.nights} nuit{booking.nights > 1 ? 's' : ''})
          </dd>
        </div>
        <div>
          <dt className="label">Personnes</dt>
          <dd>{booking.guests}</dd>
        </div>
        <div>
          <dt className="label">Client</dt>
          <dd>
            {booking.guest_name}
            <br />
            {booking.guest_email} · {booking.guest_phone}
          </dd>
        </div>
        <div>
          <dt className="label">Paiement choisi</dt>
          <dd>{booking.payment_method === 'online' ? 'En ligne' : "À l'hôtel"}</dd>
        </div>
      </dl>

      <table className="mt-6 w-full text-sm">
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#eee8d5]">
              <td className="py-2">{l.label}</td>
              <td className="py-2 text-right">{fcfa(l.total)}</td>
            </tr>
          ))}
          {invoice.tax_rate > 0 && (
            <tr>
              <td className="py-2">Taxes ({invoice.tax_rate} %)</td>
              <td className="py-2 text-right">{fcfa(invoice.tax)}</td>
            </tr>
          )}
          <tr className="font-semibold text-emerald-deep">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{fcfa(invoice.total)}</td>
          </tr>
          <tr>
            <td className="py-1">Déjà payé</td>
            <td className="py-1 text-right">{fcfa(invoice.paid)}</td>
          </tr>
          <tr>
            <td className="py-1">Solde restant</td>
            <td className="py-1 text-right">{fcfa(invoice.balance)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-dark" onClick={() => downloadInvoicePdf(invoice)}>
          Télécharger la facture (PDF)
        </button>
        <button className="btn-dark" onClick={() => window.print()}>
          Imprimer
        </button>
        {canPay && (
          <button className="btn-gold" onClick={pay} disabled={busy}>
            {busy ? 'Ouverture…' : 'Payer en ligne'}
          </button>
        )}
      </div>
      {message && (
        <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3" role="status">
          {message}
        </p>
      )}
      <p className="mt-6 text-xs text-[#5d6e67]">
        Votre réservation est une demande : elle est confirmée par l'hôtel. Le statut « payé » n'apparaît qu'après
        vérification du paiement.
      </p>
    </div>
  )
}
