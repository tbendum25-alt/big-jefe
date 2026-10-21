import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Gallery } from '../components/Gallery'
import { Empty, ErrorBox, Loader } from '../components/ui'
import { api } from '../lib'
import { fcfa } from '../lib/format'
import { useAsync, useSettings } from '../lib/hooks'
import { computeTotals, nightsBetween, todayIso, validateStay } from '../lib/pricing'
import type { PaymentMethod } from '../lib/types'

export default function RoomDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const room = useAsync(() => api.getRoom(id), [id])

  const [checkIn, setCheckIn] = useState(params.get('in') ?? '')
  const [checkOut, setCheckOut] = useState(params.get('out') ?? '')
  const [guests, setGuests] = useState(Number(params.get('guests') ?? 2) || 2)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('on_site')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [free, setFree] = useState<boolean | null>(null)

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const datesOk = nights >= 1

  // Choisit un mode de paiement réellement proposé par l'hôtel.
  useEffect(() => {
    if (settings.pay_on_site_enabled) setMethod('on_site')
    else if (settings.pay_online_enabled) setMethod('online')
  }, [settings.pay_on_site_enabled, settings.pay_online_enabled])

  useEffect(() => {
    let alive = true
    setFree(null)
    if (!datesOk) return
    api
      .availableRoomIds(checkIn, checkOut)
      .then((ids) => alive && setFree(ids.includes(id)))
      .catch(() => alive && setFree(null))
    return () => {
      alive = false
    }
  }, [checkIn, checkOut, datesOk, id])

  if (room.loading) return <div className="pt-32"><Loader /></div>
  if (room.error) return <div className="pt-32 mx-auto max-w-2xl px-5"><ErrorBox message={room.error} onRetry={room.reload} /></div>
  const r = room.data
  if (!r) {
    return (
      <div className="pt-32 mx-auto max-w-2xl px-5">
        <Empty>
          Cette chambre est introuvable. <Link className="underline" to="/chambres">Voir toutes les chambres</Link>
        </Empty>
      </div>
    )
  }

  const totals = computeTotals(nights * r.price_per_night, settings.tax_rate)
  const noPayment = !settings.pay_on_site_enabled && !settings.pay_online_enabled

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const problem = validateStay(checkIn, checkOut, guests, r.capacity)
    if (problem) return setError(problem)
    if (free === false) return setError('Cette chambre est déjà réservée sur ces dates.')
    setBusy(true)
    try {
      const result = await api.createBooking({
        room_id: r.id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        guest_name: name,
        guest_email: email,
        guest_phone: phone,
        payment_method: method,
        notes,
      })
      try {
        sessionStorage.setItem('bigjefe.lastBooking', JSON.stringify(result))
      } catch {
        /* ignoré : la confirmation reste affichée via la navigation */
      }
      navigate('/reservation-confirmee', { state: result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La réservation a échoué. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-28 mx-auto max-w-7xl px-5">
      <Link to="/chambres" className="text-sm text-emerald-deep underline">← Toutes les chambres</Link>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Gallery photos={r.photos} title={r.name} />
          <h1 className="mt-6 text-5xl font-semibold text-emerald-deep">{r.name}</h1>
          <p className="mt-2 text-lg font-semibold" style={{ color: '#8a6d12' }}>
            {fcfa(r.price_per_night)} <span className="text-sm text-[#4b5d56] font-normal">par nuit</span>
          </p>
          <p className="mt-4 leading-relaxed text-[#35463f]">{r.description}</p>
          <p className="mt-4 text-sm text-[#4b5d56]">
            Jusqu'à {r.capacity} personne{r.capacity > 1 ? 's' : ''} · {r.beds} lit{r.beds > 1 ? 's' : ''}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {r.amenities.map((a) => (
              <li key={a} className="rounded-full border border-gold/60 bg-white px-3 py-1 text-sm text-emerald-deep">{a}</li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit} className="card p-6 h-fit lg:sticky lg:top-28 space-y-4" aria-label="Réserver cette chambre">
          <h2 className="text-3xl text-emerald-deep font-semibold">Réserver</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="b-in">Arrivée</label>
              <input id="b-in" type="date" required className="field" min={todayIso()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="b-out">Départ</label>
              <input id="b-out" type="date" required className="field" min={checkIn || todayIso()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="b-guests">Personnes (max. {r.capacity})</label>
            <input id="b-guests" type="number" min={1} max={r.capacity} className="field" value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          {datesOk && free !== null && (
            <p className={`text-sm font-semibold ${free ? 'text-emerald-700' : 'text-red-700'}`} role="status">
              {free ? 'Disponible sur ces dates' : 'Indisponible sur ces dates'}
            </p>
          )}
          <div>
            <label className="label" htmlFor="b-name">Nom complet</label>
            <input id="b-name" required className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="b-email">E-mail</label>
            <input id="b-email" type="email" required className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="b-phone">Téléphone</label>
            <input id="b-phone" type="tel" required className="field" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="b-notes">Demande particulière (facultatif)</label>
            <textarea id="b-notes" rows={2} className="field" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <fieldset>
            <legend className="label">Paiement</legend>
            {noPayment && <p className="text-sm text-red-700">Aucun mode de paiement n'est proposé pour le moment. Contactez l'hôtel.</p>}
            {settings.pay_on_site_enabled && (
              <label className="flex items-center gap-2 text-sm py-1">
                <input type="radio" name="pay" checked={method === 'on_site'} onChange={() => setMethod('on_site')} /> Payer à l'hôtel
              </label>
            )}
            {settings.pay_online_enabled && (
              <label className="flex items-center gap-2 text-sm py-1">
                <input type="radio" name="pay" checked={method === 'online'} onChange={() => setMethod('online')} /> Payer en ligne (Mobile Money / carte)
              </label>
            )}
          </fieldset>

          {datesOk && (
            <dl className="rounded-xl bg-ivory p-4 text-sm space-y-1">
              <div className="flex justify-between"><dt>{fcfa(r.price_per_night)} × {nights} nuit{nights > 1 ? 's' : ''}</dt><dd>{fcfa(totals.subtotal)}</dd></div>
              {settings.tax_rate > 0 && (
                <div className="flex justify-between"><dt>Taxes ({settings.tax_rate} %)</dt><dd>{fcfa(totals.tax)}</dd></div>
              )}
              <div className="flex justify-between font-semibold text-emerald-deep text-base pt-1 border-t border-gold/40"><dt>Total</dt><dd>{fcfa(totals.total)}</dd></div>
            </dl>
          )}
          <p className="text-xs text-[#5d6e67]">{settings.cancellation_policy}</p>
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}
          <button className="btn-gold w-full" disabled={busy || noPayment || free === false}>
            {busy ? 'Envoi en cours…' : 'Envoyer ma demande de réservation'}
          </button>
        </form>
      </div>
    </div>
  )
}
