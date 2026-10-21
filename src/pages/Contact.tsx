import { useState, type FormEvent } from 'react'
import { Reveal, SectionTitle } from '../components/ui'
import { api } from '../lib'
import { whatsappLink } from '../lib/format'
import { useSettings } from '../lib/hooks'

export default function Contact() {
  const { settings } = useSettings()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const hasWhatsapp = settings.whatsapp.replace(/\D/g, '').length > 0
  const mapQuery = encodeURIComponent(`${settings.name} ${settings.address} ${settings.city}`)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setState('sending')
    try {
      await api.sendContact({ name, email, phone, message })
      setState('sent')
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch (err) {
      setState('idle')
      setError(err instanceof Error ? err.message : "L'envoi a échoué. Réessayez ou appelez-nous.")
    }
  }

  return (
    <div className="pt-32 mx-auto max-w-6xl px-5">
      <SectionTitle eyebrow="Contact" title="Nous contacter" />
      <div className="grid gap-10 md:grid-cols-2">
        <Reveal>
          <div className="card p-6 space-y-5 text-sm">
            <div>
              <p className="label">Adresse</p>
              <p>{settings.address}</p>
              <p>{settings.city}</p>
            </div>
            <div>
              <p className="label">Téléphone</p>
              <a className="underline" href={`tel:${settings.phone.replace(/\s/g, '')}`}>{settings.phone}</a>
            </div>
            <div>
              <p className="label">E-mail</p>
              <a className="underline" href={`mailto:${settings.email}`}>{settings.email}</a>
            </div>
            <div>
              <p className="label">Horaires</p>
              <p>{settings.reception_hours}</p>
              <p>Restaurant : {settings.restaurant_hours}</p>
            </div>
            {hasWhatsapp && (
              <a className="btn-gold" href={whatsappLink(settings.whatsapp, `Bonjour ${settings.name},`)} target="_blank" rel="noopener noreferrer">
                Écrire sur WhatsApp
              </a>
            )}
            <a
              className="btn-dark"
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir dans Google Maps
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          {state === 'sent' ? (
            <div className="card p-8 text-center" role="status">
              <h2 className="text-3xl text-emerald-deep font-semibold">Message envoyé</h2>
              <p className="mt-2 text-[#35463f]">Merci, nous vous répondons dans les meilleurs délais.</p>
              <button className="btn-dark mt-5" onClick={() => setState('idle')}>Envoyer un autre message</button>
            </div>
          ) : (
            <form onSubmit={submit} className="card p-6 space-y-4" aria-label="Formulaire de contact">
              <div>
                <label className="label" htmlFor="c-name">Nom</label>
                <input id="c-name" required maxLength={120} className="field" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-email">E-mail</label>
                  <input id="c-email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="c-phone">Téléphone</label>
                  <input id="c-phone" type="tel" maxLength={40} className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="c-msg">Message</label>
                <textarea id="c-msg" required minLength={5} maxLength={4000} rows={5} className="field" value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}
              <button className="btn-gold w-full" disabled={state === 'sending'}>{state === 'sending' ? 'Envoi…' : 'Envoyer'}</button>
            </form>
          )}
        </Reveal>
      </div>
    </div>
  )
}
