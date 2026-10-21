import { useState, type FormEvent } from 'react'
import { BookingSummary } from '../components/BookingSummary'
import { SectionTitle } from '../components/ui'
import { api } from '../lib'
import type { BookingResult } from '../lib/types'

export default function MyBooking() {
  const [reference, setReference] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<BookingResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const found = await api.lookupBooking(reference, email)
      if (found) setResult(found)
      else setError("Aucune réservation ne correspond à ces informations. Vérifiez le numéro et l'e-mail utilisés.")
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche impossible pour le moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-32 mx-auto max-w-3xl px-5">
      <SectionTitle eyebrow="Espace client" title="Ma réservation" />
      <form onSubmit={submit} className="card p-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end mb-8">
        <div>
          <label className="label" htmlFor="m-ref">Numéro de réservation</label>
          <input id="m-ref" required className="field" placeholder="BJ-260101-AB12" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="m-email">E-mail utilisé</label>
          <input id="m-email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn-dark h-[46px]" disabled={busy}>{busy ? 'Recherche…' : 'Retrouver'}</button>
      </form>
      {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm mb-6" role="alert">{error}</p>}
      {result && <BookingSummary booking={result.booking} invoice={result.invoice} />}
    </div>
  )
}
