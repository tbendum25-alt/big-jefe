import { useState, type FormEvent } from 'react'
import { ErrorBox, Loader } from '../../components/ui'
import { api } from '../../lib'
import { fcfa } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { scrollToForm } from '../../lib/scroll'
import type { Service } from '../../lib/types'

type Draft = Omit<Service, 'id'> & { id?: string }

export default function AdminServices() {
  const services = useAsync(() => api.listServices(true), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      services.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    await act(async () => {
      await api.saveService({ ...draft, price: draft.is_billable ? draft.price : 0 })
      setDraft(null)
    })
  }

  if (services.loading) return <Loader />
  if (services.error) return <ErrorBox message={services.error} onRetry={services.reload} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl text-emerald-deep font-semibold">Services</h1>
        <button className="btn-dark" onClick={() => { setDraft({ name: '', description: '', price: 0, is_active: true, is_billable: false }); scrollToForm() }}>+ Ajouter un service</button>
      </div>
      <p className="text-sm text-[#4b5d56]">N'activez que les services que l'hôtel propose réellement : seuls les services actifs sont visibles sur le site.</p>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {(services.data ?? []).map((s) => (
          <li key={s.id} className={`card p-4 ${s.is_active ? '' : 'opacity-60'}`}>
            <div className="flex justify-between gap-2">
              <h2 className="text-xl font-semibold text-emerald-deep">{s.name}</h2>
              <span className="text-sm">{s.is_billable ? fcfa(s.price) : 'Inclus'}</span>
            </div>
            <p className="text-sm text-[#4b5d56]">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm items-center">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={s.is_active} onChange={(e) => act(() => api.saveService({ ...s, is_active: e.target.checked }))} />
                Actif
              </label>
              <button className="underline" onClick={() => { setDraft({ ...s }); scrollToForm() }}>Modifier</button>
              <button className="text-red-700 underline" onClick={() => confirm(`Supprimer « ${s.name} » ?`) && act(() => api.deleteService(s.id))}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
      {draft && (
        <form id="admin-form" onSubmit={save} className="card p-6 grid gap-4 md:grid-cols-2 scroll-mt-4" aria-label="Modifier le service">
          <h2 className="md:col-span-2 text-2xl text-emerald-deep font-semibold">{draft.id ? 'Modifier le service' : 'Nouveau service'}</h2>
          <div>
            <label className="label" htmlFor="s-name">Nom</label>
            <input id="s-name" required className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-price">Prix (FCFA)</label>
            <input id="s-price" type="number" min={0} step={500} disabled={!draft.is_billable} className="field" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="s-desc">Description</label>
            <textarea id="s-desc" rows={2} className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_billable} onChange={(e) => setDraft({ ...draft, is_billable: e.target.checked })} />
            Service payant (ajouté à la facture)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
            Actif (visible sur le site)
          </label>
          <div className="md:col-span-2 flex gap-3">
            <button className="btn-gold">Enregistrer</button>
            <button type="button" className="btn-dark" onClick={() => setDraft(null)}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  )
}
