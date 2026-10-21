import { useEffect, useState, type FormEvent } from 'react'
import { PhotoPicker } from '../../components/PhotoPicker'
import { ErrorBox, Loader } from '../../components/ui'
import { api } from '../../lib'
import { resetDemoData } from '../../lib/demoApi'
import { digitsOnly } from '../../lib/format'
import { useAsync, useSettings } from '../../lib/hooks'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { HotelSettings } from '../../lib/types'

export default function AdminSettings() {
  const { reload } = useSettings()
  const loaded = useAsync(() => api.getSettings(), [])
  const [s, setS] = useState<HotelSettings | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (loaded.data) setS(loaded.data)
  }, [loaded.data])

  if (loaded.loading || !s) return <Loader />
  if (loaded.error) return <ErrorBox message={loaded.error} onRetry={loaded.reload} />

  const set = <K extends keyof HotelSettings>(key: K, value: HotelSettings[K]) => setS({ ...s, [key]: value })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    setError('')
    const wa = digitsOnly(s.whatsapp)
    if (wa && (wa.length < 10 || wa.length > 15)) {
      return setError('Le numéro WhatsApp doit être au format international, sans « + » ni espaces (ex. 229XXXXXXXXXX).')
    }
    if (s.tax_rate < 0 || s.tax_rate > 100) return setError('Le taux de taxe doit être compris entre 0 et 100.')
    try {
      await api.saveSettings({ ...s, whatsapp: wa })
      await reload()
      setMsg('Paramètres enregistrés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    }
  }

  const text = (key: keyof HotelSettings, label: string, type = 'text') => (
    <div>
      <label className="label" htmlFor={`st-${key}`}>{label}</label>
      <input id={`st-${key}`} type={type} className="field" value={String(s[key])} onChange={(e) => set(key, e.target.value as never)} />
    </div>
  )

  return (
    <form onSubmit={save} className="space-y-8 max-w-4xl">
      <h1 className="text-4xl text-emerald-deep font-semibold">Paramètres de l'hôtel</h1>

      <section className="card p-6 grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-2xl text-emerald-deep font-semibold">Identité</h2>
        {text('name', "Nom de l'hôtel")}
        {text('tagline', 'Slogan')}
        {text('address', 'Adresse')}
        {text('city', 'Ville / pays')}
        {text('phone', 'Téléphone')}
        {text('email', 'E-mail de réception des messages', 'email')}
        <div className="md:col-span-2">
          <label className="label" htmlFor="st-whatsapp">Numéro WhatsApp (format international, sans « + »)</label>
          <input id="st-whatsapp" className="field" inputMode="numeric" placeholder="ex. 229XXXXXXXXXX" value={s.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          <p className="text-xs text-[#5d6e67] mt-1">
            Le bouton WhatsApp du site n'apparaît qu'une fois ce numéro renseigné. Vérifiez-le soigneusement avant de l'enregistrer.
          </p>
        </div>
        {text('reception_hours', 'Horaires de la réception')}
        {text('restaurant_hours', 'Horaires du restaurant')}
        <div className="md:col-span-2">
          <p className="label">Logo (facultatif)</p>
          {s.logo_url && <img src={s.logo_url} alt="Logo actuel" className="h-16 mb-2" />}
          <p className="text-xs text-[#5d6e67] mb-2">Après avoir choisi le logo, cliquez sur « Enregistrer les paramètres » en bas de la page.</p>
          <PhotoPicker
            label="Utiliser ce logo"
            onPublish={async ([image]) => {
              const url = await api.uploadMenuPhoto(image)
              set('logo_url', url)
            }}
          />
        </div>
      </section>

      <section className="card p-6 grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-2xl text-emerald-deep font-semibold">Tarifs, paiements et factures</h2>
        <div>
          <label className="label" htmlFor="st-tax">Taux de taxe (%) appliqué aux chambres et repas</label>
          <input id="st-tax" type="number" min={0} max={100} step={0.5} className="field" value={s.tax_rate} onChange={(e) => set('tax_rate', Number(e.target.value) || 0)} />
          <p className="text-xs text-[#5d6e67] mt-1">0 = aucune taxe ajoutée. Les factures déjà émises ne sont jamais modifiées.</p>
        </div>
        <div />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.pay_on_site_enabled} onChange={(e) => set('pay_on_site_enabled', e.target.checked)} />
          Proposer le paiement à l'hôtel
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.pay_online_enabled} onChange={(e) => set('pay_online_enabled', e.target.checked)} />
          Proposer le paiement en ligne (après configuration du prestataire)
        </label>
        <div className="md:col-span-2">
          <label className="label" htmlFor="st-cancel">Conditions d'annulation</label>
          <textarea id="st-cancel" rows={2} className="field" value={s.cancellation_policy} onChange={(e) => set('cancellation_policy', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="st-footer">Mentions en bas des factures (informations légales, RCCM, IFU…)</label>
          <textarea id="st-footer" rows={2} className="field" value={s.invoice_footer} onChange={(e) => set('invoice_footer', e.target.value)} />
        </div>
      </section>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}
      {msg && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3" role="status">{msg}</p>}
      <button className="btn-gold">Enregistrer les paramètres</button>

      {!isSupabaseConfigured && (
        <section className="card p-6">
          <h2 className="text-xl text-emerald-deep font-semibold">Mode démonstration</h2>
          <p className="text-sm text-[#4b5d56] my-2">Efface toutes les données d'essai enregistrées dans ce navigateur.</p>
          <button
            type="button"
            className="btn-dark"
            onClick={() => {
              if (confirm("Effacer toutes les données de démonstration ?")) {
                resetDemoData()
                window.location.href = '/admin'
              }
            }}
          >
            Réinitialiser la démonstration
          </button>
        </section>
      )}
    </form>
  )
}
