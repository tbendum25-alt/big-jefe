import { useState } from 'react'
import { Empty, ErrorBox, Loader, StatusBadge } from '../../components/ui'
import { api } from '../../lib'
import { dateFr, dateTimeFr, fcfa, modeLabels, statusLabels } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import type { BookingStatus, OrderStatus } from '../../lib/types'

export default function AdminBookings() {
  const [tab, setTab] = useState<'bookings' | 'orders'>('bookings')
  const bookings = useAsync(() => api.listBookings(), [])
  const orders = useAsync(() => api.listOrders(), [])
  const rooms = useAsync(() => api.listRooms(true), [])
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<void>, reload: () => void) => {
    setError('')
    try {
      await fn()
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-emerald-deep font-semibold">Réservations et commandes</h1>
      <div className="flex gap-2" role="tablist">
        {(['bookings', 'orders'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'btn-dark' : 'btn-outline !text-emerald-deep !border-emerald-deep'}
            onClick={() => setTab(t)}
          >
            {t === 'bookings' ? 'Réservations' : 'Commandes du restaurant'}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}

      {tab === 'bookings' && (
        <>
          {bookings.loading && <Loader />}
          {bookings.error && <ErrorBox message={bookings.error} onRetry={bookings.reload} />}
          {!bookings.loading && (bookings.data ?? []).length === 0 && <Empty>Aucune réservation pour le moment.</Empty>}
          <div className="space-y-3">
            {(bookings.data ?? []).map((b) => (
              <article key={b.id} className="card p-4 grid gap-3 lg:grid-cols-[1.3fr_1.4fr_auto] items-center">
                <div>
                  <p className="font-display text-2xl text-emerald-deep font-bold">{b.reference}</p>
                  <p className="text-sm">{b.guest_name}</p>
                  <p className="text-xs text-[#5d6e67]">{b.guest_email} · {b.guest_phone}</p>
                </div>
                <div className="text-sm">
                  <p>{rooms.data?.find((r) => r.id === b.room_id)?.name ?? 'Chambre'} · {b.guests} pers.</p>
                  <p>{dateFr(b.check_in)} → {dateFr(b.check_out)} ({b.nights} n.)</p>
                  <p className="font-semibold">{fcfa(b.total)}</p>
                  {b.notes && <p className="text-xs italic text-[#5d6e67]">« {b.notes} »</p>}
                  <p className="text-xs text-[#5d6e67]">Reçue le {dateTimeFr(b.created_at)}</p>
                </div>
                <div className="flex flex-col gap-2 items-start lg:items-end">
                  <div className="flex gap-2">
                    <StatusBadge status={b.status} label={statusLabels[b.status]} />
                    <StatusBadge status={b.payment_status} label={statusLabels[b.payment_status]} />
                  </div>
                  <label className="sr-only" htmlFor={`bs-${b.id}`}>Statut de la réservation</label>
                  <select
                    id={`bs-${b.id}`}
                    className="field !py-1.5 text-sm"
                    value={b.status}
                    onChange={(e) => run(() => api.updateBookingStatus(b.id, e.target.value as BookingStatus), bookings.reload)}
                  >
                    {(['pending', 'confirmed', 'cancelled', 'completed'] as const).map((s) => (
                      <option key={s} value={s}>{statusLabels[s]}</option>
                    ))}
                  </select>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <>
          {orders.loading && <Loader />}
          {orders.error && <ErrorBox message={orders.error} onRetry={orders.reload} />}
          {!orders.loading && (orders.data ?? []).length === 0 && <Empty>Aucune commande pour le moment.</Empty>}
          <div className="space-y-3">
            {(orders.data ?? []).map((o) => (
              <article key={o.id} className="card p-4 grid gap-3 lg:grid-cols-[1.3fr_1.4fr_auto] items-center">
                <div>
                  <p className="font-display text-2xl text-emerald-deep font-bold">{o.reference}</p>
                  <p className="text-sm">{o.guest_name} · {o.guest_phone}</p>
                  <p className="text-xs text-[#5d6e67]">
                    {modeLabels[o.mode]}{o.room_number ? ` · chambre ${o.room_number}` : ''} · {dateTimeFr(o.created_at)}
                  </p>
                </div>
                <div className="text-sm">
                  <ul>{o.items.map((i) => <li key={i.item_id}>{i.quantity} × {i.name}</li>)}</ul>
                  <p className="font-semibold mt-1">{fcfa(o.total)}</p>
                </div>
                <div className="flex flex-col gap-2 items-start lg:items-end">
                  <div className="flex gap-2">
                    <StatusBadge status={o.status} label={statusLabels[o.status]} />
                    <StatusBadge status={o.payment_status} label={statusLabels[o.payment_status]} />
                  </div>
                  <label className="sr-only" htmlFor={`os-${o.id}`}>Statut de la commande</label>
                  <select
                    id={`os-${o.id}`}
                    className="field !py-1.5 text-sm"
                    value={o.status}
                    onChange={(e) => run(() => api.updateOrderStatus(o.id, e.target.value as OrderStatus), orders.reload)}
                  >
                    {(['new', 'preparing', 'served', 'cancelled'] as const).map((s) => (
                      <option key={s} value={s}>{statusLabels[s]}</option>
                    ))}
                  </select>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
