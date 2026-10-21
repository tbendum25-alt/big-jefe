import { useState, type FormEvent } from 'react'
import { PhotoPicker } from '../../components/PhotoPicker'
import { ErrorBox, Loader, Photo } from '../../components/ui'
import { api } from '../../lib'
import { fcfa } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { scrollToForm } from '../../lib/scroll'
import type { Room } from '../../lib/types'

type Draft = Omit<Room, 'photos' | 'id'> & { id?: string }

const blank = (categoryId: string): Draft => ({
  category_id: categoryId,
  name: '',
  description: '',
  capacity: 2,
  beds: 1,
  amenities: [],
  price_per_night: 0,
  is_active: true,
})

export default function AdminRooms() {
  const rooms = useAsync(() => api.listRooms(true), [])
  const cats = useAsync(() => api.listCategories(), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [amenities, setAmenities] = useState('')
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      rooms.reload()
      cats.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  const edit = (r?: Room) => {
    const d = r ? { ...r } : blank(cats.data?.[0]?.id ?? '')
    if (r) delete (d as Partial<Room>).photos
    setDraft(d)
    scrollToForm()
    setAmenities((d.amenities ?? []).join(', '))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const id = await api.saveRoom({
        ...draft,
        amenities: amenities.split(',').map((a) => a.trim()).filter(Boolean),
      })
      rooms.reload()
      // On reste sur la chambre pour pouvoir ajouter des photos juste après la création.
      setDraft({ ...draft, id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (rooms.loading || cats.loading) return <Loader />
  if (rooms.error) return <ErrorBox message={rooms.error} onRetry={rooms.reload} />

  const current = draft?.id ? rooms.data?.find((r) => r.id === draft.id) : undefined

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl text-emerald-deep font-semibold">Chambres</h1>
        <button className="btn-dark" onClick={() => edit()}>+ Ajouter une chambre</button>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}

      <section className="card p-5">
        <h2 className="text-2xl text-emerald-deep font-semibold mb-3">Catégories</h2>
        <ul className="flex flex-wrap gap-2 mb-4">
          {(cats.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-full border border-gold/60 px-3 py-1 text-sm">
              {c.name}
              <button
                className="text-red-700 text-xs"
                aria-label={`Supprimer la catégorie ${c.name}`}
                onClick={() => confirm(`Supprimer « ${c.name} » ?`) && act(() => api.deleteCategory(c.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newCat.trim()) return
            void act(() => api.saveCategory({ name: newCat.trim() })).then(() => setNewCat(''))
          }}
        >
          <input className="field" placeholder="Nouvelle catégorie" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Nom de la nouvelle catégorie" />
          <button className="btn-dark">Ajouter</button>
        </form>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(rooms.data ?? []).map((r) => (
          <article key={r.id} className={`card overflow-hidden ${r.is_active ? '' : 'opacity-60'}`}>
            <Photo src={(r.photos.find((p) => p.is_main) ?? r.photos[0])?.url} alt={r.name} className="h-40" zoom={false} fallbackLabel={r.name} />
            <div className="p-4">
              <h3 className="text-xl font-semibold text-emerald-deep">{r.name} {!r.is_active && <span className="text-xs">(désactivée)</span>}</h3>
              <p className="text-sm">{fcfa(r.price_per_night)} / nuit · {r.photos.length} photo(s)</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-dark !py-1.5 !px-4 text-sm" onClick={() => edit(r)}>Modifier</button>
                <button
                  className="text-sm text-red-700 underline"
                  onClick={() => confirm(`Supprimer la chambre « ${r.name} » ?`) && act(() => api.deleteRoom(r.id))}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {draft && (
        <section id="admin-form" className="card p-6 space-y-6 scroll-mt-4" aria-label="Modifier la chambre">
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <h2 className="md:col-span-2 text-2xl text-emerald-deep font-semibold">{draft.id ? 'Modifier la chambre' : 'Nouvelle chambre'}</h2>
            <div>
              <label className="label" htmlFor="rm-name">Nom</label>
              <input id="rm-name" required className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="rm-cat">Catégorie</label>
              <select id="rm-cat" required className="field" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="rm-desc">Description</label>
              <textarea id="rm-desc" rows={3} className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="rm-price">Prix par nuit (FCFA)</label>
              <input id="rm-price" type="number" min={0} step={500} required className="field" value={draft.price_per_night} onChange={(e) => setDraft({ ...draft, price_per_night: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="rm-cap">Capacité</label>
                <input id="rm-cap" type="number" min={1} required className="field" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div>
                <label className="label" htmlFor="rm-beds">Lits</label>
                <input id="rm-beds" type="number" min={1} required className="field" value={draft.beds} onChange={(e) => setDraft({ ...draft, beds: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="rm-am">Équipements (séparés par des virgules)</label>
              <input id="rm-am" className="field" value={amenities} onChange={(e) => setAmenities(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
              Chambre active (visible et réservable)
            </label>
            <div className="md:col-span-2 flex gap-3">
              <button className="btn-gold" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              <button type="button" className="btn-dark" onClick={() => setDraft(null)}>Fermer</button>
            </div>
          </form>

          {draft.id && current && (
            <div>
              <h3 className="text-xl text-emerald-deep font-semibold mb-3">Photos</h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                {current.photos.map((p, i) => (
                  <li key={p.id} className="rounded-xl border border-[#e8e2cf] p-2 text-xs space-y-2">
                    <img src={p.url} alt={`Photo ${i + 1} de ${current.name}`} className="h-28 w-full object-cover rounded-lg" />
                    <div className="flex flex-wrap gap-2 items-center">
                      {p.is_main ? (
                        <span className="rounded-full bg-gold/30 px-2 py-0.5 font-semibold">Principale</span>
                      ) : (
                        <button className="underline" onClick={() => act(() => api.setMainPhoto(current.id, p.id))}>Définir principale</button>
                      )}
                      <button className="underline" disabled={i === 0} onClick={() => act(() => api.movePhoto(current.id, p.id, -1))} aria-label="Déplacer vers le début">←</button>
                      <button className="underline" disabled={i === current.photos.length - 1} onClick={() => act(() => api.movePhoto(current.id, p.id, 1))} aria-label="Déplacer vers la fin">→</button>
                      <button className="text-red-700 underline" onClick={() => confirm('Supprimer cette photo ?') && act(() => api.deleteRoomPhoto(p))}>Supprimer</button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#5d6e67] mb-2">Les photos sont publiées sur le site dès que vous cliquez sur « Publier ».</p>
              <PhotoPicker
                multiple
                onPublish={async (images) => {
                  for (const img of images) await api.addRoomPhoto(current.id, img)
                  rooms.reload()
                }}
              />
            </div>
          )}
          {!draft.id && <p className="text-sm text-[#5d6e67]">Enregistrez la chambre pour pouvoir ajouter des photos.</p>}
        </section>
      )}
    </div>
  )
}
