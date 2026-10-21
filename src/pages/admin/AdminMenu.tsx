import { useState, type FormEvent } from 'react'
import { PhotoPicker } from '../../components/PhotoPicker'
import { ErrorBox, Loader, Photo } from '../../components/ui'
import { api } from '../../lib'
import { fcfa } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { scrollToForm } from '../../lib/scroll'
import type { MenuItem } from '../../lib/types'

type Draft = Omit<MenuItem, 'id'> & { id?: string }

export default function AdminMenu() {
  const cats = useAsync(() => api.listMenuCategories(), [])
  const items = useAsync(() => api.listMenuItems(true), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState('')

  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      cats.reload()
      items.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    await act(async () => {
      await api.saveMenuItem(draft)
      setDraft(null)
    })
  }

  if (cats.loading || items.loading) return <Loader />
  if (items.error) return <ErrorBox message={items.error} onRetry={items.reload} />

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl text-emerald-deep font-semibold">Restaurant</h1>
        <button
          className="btn-dark"
          onClick={() => { setDraft({ category_id: cats.data?.[0]?.id ?? '', name: '', description: '', price: 0, photo_url: '', is_available: true }); scrollToForm() }}
        >
          + Ajouter un plat
        </button>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}

      <section className="card p-5">
        <h2 className="text-2xl text-emerald-deep font-semibold mb-3">Catégories du menu</h2>
        <ul className="flex flex-wrap gap-2 mb-4">
          {(cats.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-full border border-gold/60 px-3 py-1 text-sm">
              {c.name}
              <button className="text-red-700 text-xs" aria-label={`Supprimer ${c.name}`} onClick={() => confirm(`Supprimer « ${c.name} » ?`) && act(() => api.deleteMenuCategory(c.id))}>×</button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newCat.trim()) return
            void act(() => api.saveMenuCategory({ name: newCat.trim() })).then(() => setNewCat(''))
          }}
        >
          <input className="field" placeholder="Nouvelle catégorie" aria-label="Nom de la nouvelle catégorie" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn-dark">Ajouter</button>
        </form>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(items.data ?? []).map((d) => (
          <article key={d.id} className={`card overflow-hidden ${d.is_available ? '' : 'opacity-60'}`}>
            <Photo src={d.photo_url} alt={d.name} className="h-32" zoom={false} fallbackLabel={d.name} />
            <div className="p-4">
              <h3 className="text-lg font-semibold text-emerald-deep">{d.name} {!d.is_available && <span className="text-xs">(indisponible)</span>}</h3>
              <p className="text-sm">{fcfa(d.price)} · {cats.data?.find((c) => c.id === d.category_id)?.name}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <button className="btn-dark !py-1.5 !px-4" onClick={() => { setDraft({ ...d }); scrollToForm() }}>Modifier</button>
                <button className="text-red-700 underline" onClick={() => confirm(`Supprimer « ${d.name} » ?`) && act(() => api.deleteMenuItem(d.id))}>Supprimer</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {draft && (
        <form id="admin-form" onSubmit={save} className="card p-6 grid gap-4 md:grid-cols-2 scroll-mt-4" aria-label="Modifier le plat">
          <h2 className="md:col-span-2 text-2xl text-emerald-deep font-semibold">{draft.id ? 'Modifier le plat' : 'Nouveau plat'}</h2>
          <div>
            <label className="label" htmlFor="d-name">Nom</label>
            <input id="d-name" required className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="d-cat">Catégorie</label>
            <select id="d-cat" required className="field" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
              {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="d-desc">Description</label>
            <textarea id="d-desc" rows={2} className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="d-price">Prix (FCFA)</label>
            <input id="d-price" type="number" min={0} step={100} required className="field" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          </div>
          <label className="flex items-center gap-2 text-sm self-end pb-3">
            <input type="checkbox" checked={draft.is_available} onChange={(e) => setDraft({ ...draft, is_available: e.target.checked })} />
            Disponible à la commande
          </label>
          <div className="md:col-span-2">
            <p className="label">Photo du plat</p>
            {draft.photo_url && <img src={draft.photo_url} alt="Photo actuelle" className="h-24 w-32 object-cover rounded-lg mb-2" />}
            <p className="text-xs text-[#5d6e67] mb-2">Après avoir choisi la photo, cliquez sur « Enregistrer » en bas du formulaire pour la publier sur le site.</p>
            <PhotoPicker
              label="Utiliser cette photo"
              onPublish={async ([image]) => {
                const url = await api.uploadMenuPhoto(image)
                setDraft((d) => (d ? { ...d, photo_url: url } : d))
              }}
            />
          </div>
          <div className="md:col-span-2 flex gap-3">
            <button className="btn-gold">Enregistrer</button>
            <button type="button" className="btn-dark" onClick={() => setDraft(null)}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  )
}
