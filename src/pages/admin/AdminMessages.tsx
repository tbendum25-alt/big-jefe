import { Empty, ErrorBox, Loader } from '../../components/ui'
import { api } from '../../lib'
import { dateTimeFr } from '../../lib/format'
import { useAsync } from '../../lib/hooks'

export default function AdminMessages() {
  const messages = useAsync(() => api.listMessages(), [])
  if (messages.loading) return <Loader />
  if (messages.error) return <ErrorBox message={messages.error} onRetry={messages.reload} />
  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-emerald-deep font-semibold">Messages</h1>
      {(messages.data ?? []).length === 0 && <Empty>Aucun message reçu.</Empty>}
      <ul className="space-y-3">
        {(messages.data ?? []).map((m) => (
          <li key={m.id} className="card p-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <p className="font-semibold text-emerald-deep">{m.name}</p>
              <p className="text-[#5d6e67]">{dateTimeFr(m.created_at)}</p>
            </div>
            <p className="text-xs text-[#5d6e67]">
              <a className="underline" href={`mailto:${m.email}`}>{m.email}</a>
              {m.phone && ` · ${m.phone}`}
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap">{m.message}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
