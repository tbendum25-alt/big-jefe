import { ErrorBox, Loader } from '../../components/ui'
import { api } from '../../lib'
import { dateTimeFr, fcfa } from '../../lib/format'
import { useAsync } from '../../lib/hooks'

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="label !mb-1">{label}</p>
      <p className="font-display text-4xl text-emerald-deep font-bold">{value}</p>
      {hint && <p className="text-xs text-[#5d6e67] mt-1">{hint}</p>}
    </div>
  )
}

export default function Dashboard() {
  const stats = useAsync(() => api.stats(), [])
  if (stats.loading) return <Loader />
  if (stats.error || !stats.data) return <ErrorBox message={stats.error ?? 'Données indisponibles.'} onRetry={stats.reload} />
  const s = stats.data
  return (
    <div className="space-y-8">
      <h1 className="text-4xl text-emerald-deep font-semibold">Tableau de bord</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Réservations" value={s.bookings_total} />
        <Stat label="Arrivées aujourd'hui" value={s.arrivals_today} />
        <Stat label="Départs aujourd'hui" value={s.departures_today} />
        <Stat label="Commandes restaurant" value={s.orders_total} />
        <Stat label="Chambres occupées" value={`${s.rooms_occupied} / ${s.rooms_total}`} hint={`${Math.max(s.rooms_total - s.rooms_occupied, 0)} disponible(s)`} />
        <Stat label="Revenus confirmés" value={fcfa(s.revenue_confirmed)} hint="Paiements vérifiés uniquement" />
        <Stat label="Montants en attente" value={fcfa(s.revenue_pending)} hint="Soldes de factures non encore payés" />
      </div>
      <section>
        <h2 className="text-2xl text-emerald-deep font-semibold mb-3">Dernières activités</h2>
        {s.recent.length === 0 ? (
          <p className="text-sm text-[#5d6e67]">Aucune activité pour le moment.</p>
        ) : (
          <ul className="card divide-y divide-[#eee8d5]">
            {s.recent.map((r, i) => (
              <li key={i} className="px-4 py-3 text-sm flex justify-between gap-4">
                <span>{r.label}</span>
                <span className="text-[#5d6e67] whitespace-nowrap">{dateTimeFr(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
