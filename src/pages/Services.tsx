import { Empty, ErrorBox, Loader, Reveal, SectionTitle } from '../components/ui'
import { api } from '../lib'
import { fcfa } from '../lib/format'
import { useAsync } from '../lib/hooks'

export default function Services() {
  const services = useAsync(() => api.listServices(), [])
  return (
    <div className="pt-32 mx-auto max-w-5xl px-5">
      <SectionTitle eyebrow="Confort" title="Services et équipements" />
      {services.loading && <Loader />}
      {services.error && <ErrorBox message={services.error} onRetry={services.reload} />}
      {!services.loading && !services.error && (services.data ?? []).length === 0 && <Empty>Nos services seront bientôt présentés ici.</Empty>}
      <div className="grid gap-5 sm:grid-cols-2">
        {(services.data ?? []).map((s, i) => (
          <Reveal key={s.id} delay={(i % 2) * 0.08}>
            <article className="card p-6 h-full">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-semibold text-emerald-deep">{s.name}</h2>
                <span className="text-sm font-semibold whitespace-nowrap pt-1" style={{ color: '#8a6d12' }}>
                  {s.is_billable && s.price > 0 ? fcfa(s.price) : 'Inclus'}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#4b5d56]">{s.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-sm text-center text-[#4b5d56]">
        Les services payants sont ajoutés à votre facture sur demande à la réception.
      </p>
    </div>
  )
}
