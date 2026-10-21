import { useMemo, useState, type FormEvent } from 'react'
import { Empty, ErrorBox, Loader, Photo, Reveal, SectionTitle, StatusBadge } from '../components/ui'
import { api } from '../lib'
import { fcfa, modeLabels, statusLabels } from '../lib/format'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { useAsync, useSettings } from '../lib/hooks'
import { computeTotals } from '../lib/pricing'
import type { OrderMode, OrderResult, PaymentMethod } from '../lib/types'

export default function Restaurant() {
  const { settings } = useSettings()
  const categories = useAsync(() => api.listMenuCategories(), [])
  const items = useAsync(() => api.listMenuItems(), [])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [room, setRoom] = useState('')
  const [mode, setMode] = useState<OrderMode>('dine_in')
  const [method, setMethod] = useState<PaymentMethod>(settings.pay_on_site_enabled ? 'on_site' : 'online')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<OrderResult | null>(null)
  const [payMessage, setPayMessage] = useState('')

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ dish: items.data?.find((i) => i.id === id), quantity }))
        .filter((l): l is { dish: NonNullable<typeof l.dish>; quantity: number } => Boolean(l.dish) && l.quantity > 0),
    [cart, items.data],
  )
  const subtotal = lines.reduce((s, l) => s + l.dish.price * l.quantity, 0)
  const totals = computeTotals(subtotal, settings.tax_rate)

  const add = (id: string, delta: number) =>
    setCart((c) => {
      const q = Math.max(0, Math.min(50, (c[id] ?? 0) + delta))
      const next = { ...c }
      if (q === 0) delete next[id]
      else next[id] = q
      return next
    })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await api.createOrder({
        guest_name: name,
        guest_phone: phone,
        room_number: room,
        mode,
        payment_method: method,
        items: lines.map((l) => ({ item_id: l.dish.id, quantity: l.quantity })),
      })
      setDone(result)
      setCart({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La commande a échoué. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  const payOnline = async (invoiceId: string) => {
    const r = await api.startOnlinePayment(invoiceId, '')
    if (r.state === 'redirect') window.location.href = r.url
    else setPayMessage(r.message)
  }

  if (done) {
    return (
      <div className="pt-32 mx-auto max-w-2xl px-5">
        <div className="card p-8 text-center">
          <h1 className="text-4xl text-emerald-deep font-semibold">Commande enregistrée</h1>
          <p className="mt-2 font-display text-3xl text-emerald-deep">{done.order.reference}</p>
          <div className="mt-3 flex justify-center gap-2">
            <StatusBadge status={done.order.status} label={statusLabels[done.order.status]} />
            <StatusBadge status={done.invoice.payment_status} label={statusLabels[done.invoice.payment_status]} />
          </div>
          <p className="mt-4 text-sm text-[#35463f]">
            {modeLabels[done.order.mode]} · Total {fcfa(done.order.total)}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn-dark" onClick={() => downloadInvoicePdf(done.invoice)}>Télécharger la facture (PDF)</button>
            {done.order.payment_method === 'online' && (
              <button className="btn-gold" onClick={() => payOnline(done.invoice.id)}>Payer en ligne</button>
            )}
            <button className="btn-outline !text-emerald-deep !border-emerald-deep" onClick={() => setDone(null)}>Nouvelle commande</button>
          </div>
          {payMessage && <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">{payMessage}</p>}
        </div>
      </div>
    )
  }

  const noPayment = !settings.pay_on_site_enabled && !settings.pay_online_enabled

  return (
    <div className="pt-32 mx-auto max-w-7xl px-5">
      <SectionTitle eyebrow="Gastronomie" title="Le restaurant" />
      <p className="text-center -mt-6 mb-12 text-[#4b5d56]">{settings.restaurant_hours}</p>

      {(items.loading || categories.loading) && <Loader />}
      {items.error && <ErrorBox message={items.error} onRetry={items.reload} />}
      {!items.loading && !items.error && (items.data ?? []).length === 0 && (
        <Empty>Le menu sera bientôt disponible.</Empty>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-12">
          {(categories.data ?? []).map((c) => {
            const dishes = (items.data ?? []).filter((i) => i.category_id === c.id)
            if (!dishes.length) return null
            return (
              <section key={c.id} aria-labelledby={`cat-${c.id}`}>
                <h2 id={`cat-${c.id}`} className="text-3xl text-emerald-deep font-semibold mb-5">{c.name}</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {dishes.map((d) => (
                    <Reveal key={d.id}>
                      <article className="group card overflow-hidden h-full flex flex-col">
                        <Photo src={d.photo_url} alt={d.name} className="h-40" fallbackLabel={d.name} />
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="flex justify-between gap-2">
                            <h3 className="text-xl font-semibold text-emerald-deep">{d.name}</h3>
                            <span className="text-sm font-semibold whitespace-nowrap pt-1" style={{ color: '#8a6d12' }}>{fcfa(d.price)}</span>
                          </div>
                          <p className="text-sm text-[#4b5d56] mt-1">{d.description}</p>
                          <div className="mt-auto pt-4 flex items-center gap-2">
                            {cart[d.id] ? (
                              <>
                                <button className="h-9 w-9 rounded-full border border-emerald-deep text-emerald-deep" onClick={() => add(d.id, -1)} aria-label={`Retirer un ${d.name}`}>−</button>
                                <span className="w-6 text-center font-semibold" aria-live="polite">{cart[d.id]}</span>
                                <button className="h-9 w-9 rounded-full border border-emerald-deep text-emerald-deep" onClick={() => add(d.id, 1)} aria-label={`Ajouter un ${d.name}`}>+</button>
                              </>
                            ) : (
                              <button className="btn-dark !py-2 !px-4 text-sm" onClick={() => add(d.id, 1)}>Ajouter</button>
                            )}
                          </div>
                        </div>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <form onSubmit={submit} className="card p-6 h-fit lg:sticky lg:top-28 space-y-4" aria-label="Votre commande">
          <h2 className="text-3xl text-emerald-deep font-semibold">Votre commande</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-[#4b5d56]">Votre panier est vide. Ajoutez des plats depuis le menu.</p>
          ) : (
            <ul className="divide-y divide-[#eee8d5] text-sm">
              {lines.map((l) => (
                <li key={l.dish.id} className="py-2 flex items-center justify-between gap-2">
                  <span>{l.quantity} × {l.dish.name}</span>
                  <span className="flex items-center gap-2">
                    {fcfa(l.dish.price * l.quantity)}
                    <button type="button" className="text-red-700 text-xs underline" onClick={() => add(l.dish.id, -l.quantity)}>Retirer</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {lines.length > 0 && (
            <>
              <dl className="rounded-xl bg-ivory p-4 text-sm space-y-1">
                <div className="flex justify-between"><dt>Sous-total</dt><dd>{fcfa(totals.subtotal)}</dd></div>
                {settings.tax_rate > 0 && <div className="flex justify-between"><dt>Taxes ({settings.tax_rate} %)</dt><dd>{fcfa(totals.tax)}</dd></div>}
                <div className="flex justify-between font-semibold text-emerald-deep text-base"><dt>Total</dt><dd>{fcfa(totals.total)}</dd></div>
              </dl>
              <div>
                <label className="label" htmlFor="o-mode">Mode de service</label>
                <select id="o-mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as OrderMode)}>
                  <option value="dine_in">Consommation sur place</option>
                  <option value="room_service">Service en chambre</option>
                  <option value="takeaway">À emporter</option>
                </select>
              </div>
              {mode === 'room_service' && (
                <div>
                  <label className="label" htmlFor="o-room">Numéro de chambre</label>
                  <input id="o-room" required className="field" value={room} onChange={(e) => setRoom(e.target.value)} />
                </div>
              )}
              <div>
                <label className="label" htmlFor="o-name">Nom</label>
                <input id="o-name" required className="field" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="o-phone">Téléphone</label>
                <input id="o-phone" type="tel" required className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <fieldset>
                <legend className="label">Paiement</legend>
                {noPayment && <p className="text-sm text-red-700">Aucun mode de paiement n'est proposé pour le moment.</p>}
                {settings.pay_on_site_enabled && (
                  <label className="flex items-center gap-2 text-sm py-1"><input type="radio" name="opay" checked={method === 'on_site'} onChange={() => setMethod('on_site')} /> Payer à l'hôtel</label>
                )}
                {settings.pay_online_enabled && (
                  <label className="flex items-center gap-2 text-sm py-1"><input type="radio" name="opay" checked={method === 'online'} onChange={() => setMethod('online')} /> Payer en ligne</label>
                )}
              </fieldset>
              {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}
              <button className="btn-gold w-full" disabled={busy || noPayment}>{busy ? 'Envoi…' : 'Valider la commande'}</button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
