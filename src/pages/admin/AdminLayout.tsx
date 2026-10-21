import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Loader } from '../../components/ui'
import { api } from '../../lib'
import { useSettings } from '../../lib/hooks'
import { checkEmail, checkPassword, MIN_PASSWORD } from '../../lib/team'

function Setup({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = checkEmail(email) ?? checkPassword(password) ?? (password !== confirm ? 'Les deux mots de passe sont différents.' : null)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      await api.setupOwner(email.trim(), password, code.trim())
      await api.signIn(email.trim(), password)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-emerald-night flex items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="card w-full max-w-md p-8 space-y-4" aria-label="Première configuration">
        <h1 className="text-4xl text-emerald-deep font-semibold text-center">Première configuration</h1>
        <p className="text-sm text-[#4b5d56]">
          Créez le compte propriétaire. Cette page se ferme définitivement dès que le compte existe. Le code de configuration est celui défini
          à l'installation (variable <strong>SETUP_CODE</strong>).
        </p>
        <div>
          <label className="label" htmlFor="s-email">E-mail du propriétaire</label>
          <input id="s-email" type="email" required className="field" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="s-pass">Mot de passe ({MIN_PASSWORD} caractères minimum)</label>
          <input id="s-pass" type="password" required className="field" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="s-confirm">Confirmer le mot de passe</label>
          <input id="s-confirm" type="password" required className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="s-code">Code de configuration</label>
          <input id="s-code" type="password" required className="field" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-gold w-full" disabled={busy}>{busy ? 'Création…' : 'Créer le compte propriétaire'}</button>
        <button type="button" className="w-full text-sm underline text-[#4b5d56]" onClick={onBack}>Retour à la connexion</button>
        <Link to="/" className="block text-center text-sm underline text-[#4b5d56]">← Retour au site</Link>
      </form>
    </div>
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  useEffect(() => {
    api.needsSetup().then(setSetupOpen).catch(() => setSetupOpen(false))
  }, [])
  if (setupMode) return <Setup onDone={onDone} onBack={() => setSetupMode(false)} />
  return <LoginForm onDone={onDone} setupOpen={setupOpen} onSetup={() => setSetupMode(true)} />
}

function LoginForm({ onDone, setupOpen, onSetup }: { onDone: () => void; setupOpen: boolean; onSetup: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.signIn(email, password)
      if (await api.isOwner()) onDone()
      else {
        await api.signOut()
        setError("Ce compte n'est pas autorisé à administrer l'hôtel.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-emerald-night flex items-center justify-center px-5">
      <form onSubmit={submit} className="card w-full max-w-md p-8 space-y-4" aria-label="Connexion propriétaire">
        <h1 className="text-4xl text-emerald-deep font-semibold text-center">Espace propriétaire</h1>
        <div>
          <label className="label" htmlFor="l-email">E-mail</label>
          <input id="l-email" type="email" required className="field" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="l-pass">Mot de passe</label>
          <input id="l-pass" type="password" required className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-gold w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        {setupOpen && (
          <button type="button" className="w-full text-sm underline text-[#4b5d56]" onClick={onSetup}>
            Première utilisation ? Créer le compte propriétaire
          </button>
        )}
        <Link to="/" className="block text-center text-sm underline text-[#4b5d56]">← Retour au site</Link>
      </form>
    </div>
  )
}

const nav = [
  { to: '/admin', label: 'Tableau de bord', end: true },
  { to: '/admin/reservations', label: 'Réservations' },
  { to: '/admin/chambres', label: 'Chambres' },
  { to: '/admin/restaurant', label: 'Restaurant' },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/factures', label: 'Factures' },
  { to: '/admin/messages', label: 'Messages' },
  { to: '/admin/equipe', label: 'Équipe' },
  { to: '/admin/parametres', label: 'Paramètres' },
]

export default function AdminLayout() {
  const { settings } = useSettings()
  const [state, setState] = useState<'checking' | 'out' | 'in'>('checking')
  const navigate = useNavigate()

  useEffect(() => {
    api
      .isOwner()
      .then((ok) => setState(ok ? 'in' : 'out'))
      .catch(() => setState('out'))
  }, [])

  if (state === 'checking') return <Loader />
  if (state === 'out') return <Login onDone={() => setState('in')} />

  return (
    <div className="min-h-screen bg-ivory md:flex">
      <aside className="md:w-60 bg-emerald-night text-ivory md:min-h-screen p-4 md:p-6 shrink-0">
        <p className="font-display text-3xl text-gold font-bold">{settings.name}</p>
        <p className="text-xs text-ivory/60 mb-4">Administration</p>
        <nav className="flex md:flex-col gap-1 overflow-x-auto" aria-label="Administration">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-gold text-emerald-night font-semibold' : 'hover:bg-white/10'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 flex md:flex-col gap-2 text-sm">
          <NavLink to="/" className="text-ivory/70 hover:text-gold">← Voir le site</NavLink>
          <button
            className="text-left text-ivory/70 hover:text-gold"
            onClick={async () => {
              await api.signOut()
              setState('out')
              navigate('/')
            }}
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
