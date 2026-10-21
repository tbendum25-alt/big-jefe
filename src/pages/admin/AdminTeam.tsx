import { useState, type FormEvent } from 'react'
import { Empty, ErrorBox, Loader } from '../../components/ui'
import { api } from '../../lib'
import { dateTimeFr } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { checkEmail, checkPassword, generatePassword, MIN_PASSWORD } from '../../lib/team'

export default function AdminTeam() {
  const team = useAsync(() => api.listTeam(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [mine, setMine] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const members = team.data ?? []
  const isOwner = members.find((m) => m.is_self)?.role === 'owner'

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      team.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const problem = checkEmail(email) ?? checkPassword(password)
    if (problem) return setError(problem)
    const created = { email: email.trim(), password }
    await run(async () => {
      await api.addTeamMember(created.email, created.password)
      setEmail('')
      setPassword(generatePassword())
    }, `Compte créé. Transmettez à ${created.email} son e-mail et ce mot de passe temporaire : ${created.password} (il pourra le changer depuis cette page).`)
  }

  const changeMine = async (e: FormEvent) => {
    e.preventDefault()
    const problem = checkPassword(mine)
    if (problem) return setError(problem)
    await run(async () => {
      await api.changePassword(mine)
      setMine('')
    }, 'Votre mot de passe a été modifié.')
  }

  if (team.loading) return <Loader />
  if (team.error) return <ErrorBox message={team.error} onRetry={team.reload} />

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-4xl text-emerald-deep font-semibold">Équipe</h1>
        <p className="text-sm text-[#4b5d56] mt-1">
          Le propriétaire crée les comptes de ses employés. Il n'existe aucune inscription publique : personne ne peut se
          donner accès à l'administration.
        </p>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>}
      {notice && <p className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-3" role="status">{notice}</p>}

      <section aria-label="Comptes de l'administration">
        {members.length === 0 && <Empty>Aucun compte.</Empty>}
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-deep">
                  {m.email} {m.is_self && <span className="text-xs font-normal text-[#5d6e67]">(vous)</span>}
                </p>
                <p className="text-xs text-[#5d6e67]">
                  {m.role === 'owner' ? 'Propriétaire' : 'Employé'}
                  {m.created_at && ` · depuis le ${dateTimeFr(m.created_at)}`}
                </p>
              </div>
              {isOwner && m.role === 'staff' && (
                <button
                  className="text-red-700 underline text-sm"
                  disabled={busy}
                  onClick={() =>
                    confirm(`Retirer l'accès de ${m.email} ? Son compte sera supprimé.`) &&
                    run(() => api.removeTeamMember(m.user_id), 'Accès retiré.')
                  }
                >
                  Retirer l'accès
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <form onSubmit={add} className="card p-5 space-y-4" aria-label="Ajouter un employé">
          <h2 className="text-2xl text-emerald-deep font-semibold">Ajouter un employé</h2>
          <div>
            <label className="label" htmlFor="t-email">E-mail de l'employé</label>
            <input id="t-email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="t-pass">Mot de passe temporaire ({MIN_PASSWORD} caractères minimum)</label>
            <div className="flex gap-2">
              <input id="t-pass" type="text" required className="field font-mono" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setPassword(generatePassword())}>
                Générer
              </button>
            </div>
          </div>
          <p className="text-xs text-[#5d6e67]">
            L'employé aura accès à toute l'administration, sauf la gestion de l'équipe. Il pourra changer son mot de passe depuis cette page.
          </p>
          <button className="btn-dark" disabled={busy}>{busy ? 'Création…' : 'Créer le compte'}</button>
        </form>
      ) : (
        <p className="text-sm text-[#4b5d56]">Seul le propriétaire peut ajouter ou retirer des comptes.</p>
      )}

      <form onSubmit={changeMine} className="card p-5 space-y-4" aria-label="Changer mon mot de passe">
        <h2 className="text-2xl text-emerald-deep font-semibold">Changer mon mot de passe</h2>
        <div>
          <label className="label" htmlFor="t-mine">Nouveau mot de passe</label>
          <input id="t-mine" type="password" required className="field" autoComplete="new-password" value={mine} onChange={(e) => setMine(e.target.value)} />
        </div>
        <button className="btn-dark" disabled={busy}>Modifier</button>
      </form>
    </div>
  )
}
