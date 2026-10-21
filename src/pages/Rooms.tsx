import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorBox, Empty, Loader, Photo, Reveal, SectionTitle } from '../components/ui'
import { api } from '../lib'
import { fcfa } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { nightsBetween, todayIso } from '../lib/pricing'

export default function Rooms() {
  const [params, setParams] = useSearchParams()
  const checkIn = params.get('in') ?? ''
  const checkOut = params.get('out') ?? ''
  const guests = Number(params.get('guests') ?? 1) || 1
  const [category, setCategory] = useState('')

  const rooms = useAsync(() => api.listRooms(), [])
  const categories = useAsync(() => api.listCategories(), [])
  const [available, setAvailable] = useState<string[] | null>(null)
  const datesValid = Boolean(checkIn && checkOut && nightsBetween(checkIn, checkOut) >= 1)

  useEffect(() => {
    let alive = true
    if (!datesValid) {
      setAvailable(null)
      return
    }
    api
      .availableRoomIds(checkIn, checkOut)
      .then((ids) => alive && setAvailable(ids))
      .catch(() => alive && setAvailable(null))
    return () => {
      alive = false
    }
  }, [checkIn, checkOut, datesValid])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const shown = useMemo(
    () =>
      (rooms.data ?? []).filter(
        (r) => (!category || r.category_id === category) && r.capacity >= guests,
      ),
    [rooms.data, category, guests],
  )
  const catName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? ''
  const query = params.toString()

  return (
    <div className="pt-32 mx-auto max-w-7xl px-5">
      <SectionTitle eyebrow="Hébergement" title="Chambres et suites" />

      <div className="card p-4 md:p-5 grid gap-3 md:grid-cols-4 mb-10">
        <div>
          <label className="label" htmlFor="r-in">Arrivée</label>
          <input id="r-in" type="date" className="field" min={todayIso()} value={checkIn} onChange={(e) => setParam('in', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="r-out">Départ</label>
          <input id="r-out" type="date" className="field" min={checkIn || todayIso()} value={checkOut} onChange={(e) => setParam('out', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="r-guests">Personnes</label>
          <input id="r-guests" type="number" min={1} max={10} className="field" value={guests} onChange={(e) => setParam('guests', String(Math.max(1, Number(e.target.value) || 1)))} />
        </div>
        <div>
          <label className="label" htmlFor="r-cat">Catégorie</label>
          <select id="r-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {rooms.loading && <Loader />}
      {rooms.error && <ErrorBox message={rooms.error} onRetry={rooms.reload} />}
      {!rooms.loading && !rooms.error && shown.length === 0 && (
        <Empty>Aucune chambre ne correspond à votre recherche. Essayez un autre nombre de personnes ou une autre catégorie.</Empty>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((r, i) => {
          const isFree = available ? available.includes(r.id) : null
          return (
            <Reveal key={r.id} delay={(i % 3) * 0.08}>
              <article className="group card overflow-hidden h-full flex flex-col hover:shadow-xl transition-shadow">
                <Link to={`/chambres/${r.id}${query ? `?${query}` : ''}`} className="block">
                  <Photo src={(r.photos.find((p) => p.is_main) ?? r.photos[0])?.url} alt={r.name} className="h-60" fallbackLabel={r.name} />
                </Link>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-xs uppercase tracking-widest text-[#8a6d12] font-semibold">{catName(r.category_id)}</p>
                  <h3 className="text-2xl font-semibold text-emerald-deep">{r.name}</h3>
                  <p className="mt-1 text-sm text-[#4b5d56] line-clamp-3">{r.description}</p>
                  <p className="mt-3 text-xs text-[#4b5d56]">
                    {r.capacity} pers. max · {r.beds} lit{r.beds > 1 ? 's' : ''} · {r.amenities.slice(0, 3).join(' · ')}
                  </p>
                  <div className="mt-auto pt-5 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-semibold text-lg" style={{ color: '#8a6d12' }}>{fcfa(r.price_per_night)}</p>
                      <p className="text-xs text-[#4b5d56]">par nuit</p>
                    </div>
                    <div className="text-right">
                      {isFree !== null && (
                        <p className={`text-xs font-semibold mb-1 ${isFree ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isFree ? 'Disponible sur vos dates' : 'Indisponible sur vos dates'}
                        </p>
                      )}
                      {isFree === false ? (
                        <span className="btn-dark opacity-50 pointer-events-none">Indisponible</span>
                      ) : (
                        <Link to={`/chambres/${r.id}${query ? `?${query}` : ''}`} className="btn-dark">
                          Réserver
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}
