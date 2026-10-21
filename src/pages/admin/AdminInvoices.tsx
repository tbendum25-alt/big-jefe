import { useMemo, useState, type FormEvent } from 'react'
import { Empty, ErrorBox, Loader, StatusBadge } from '../../components/ui'
import { api } from '../../lib'
import { dateFr, fcfa, statusLabels } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { downloadInvoicePdf } from '../../lib/invoicePdf'
import type { Invoice } from '../../lib/types'

export default function AdminInvoices() {
  const invoices = useAsync(() => api.listInvoices(), [])
  const [q, setQ] = useState('')
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState('Espèces')
  const [proof, setProof] = useState('')
  const [error, setError] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (invoices.data ?? []).filter(
      (i) =>
        !needle ||
        [i.number, i.customer_name, i.source_reference, i.customer_email].some((v) => v.toLowerCase().includes(needle)),
    )
  }, [invoices.data, q])

  const record = async (e: FormEvent) => {
    e.preventDefault()
    if (!paying) return
    setError('')
    try {
      await api.recordManualPayment(paying.id, amount, method, proof)
      setPaying(null)
      setProof('')
      invoices.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    }
  }

  if (invoices.loading) return <Loader />
  if (invoices.error) return <ErrorBox message={invoices.error} onRetry={invoices.reload} />

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-emerald-deep font-semibold">Factures</h1>
      <input className="field max-w-md" placeholder="Rechercher (numéro, client, référence…)" aria-label="Rechercher une facture" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <Empty>Aucune facture trouvée.</Empty>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-left bg-ivory">
            <tr>
              <th className="p-3">N°</th><th className="p-3">Client</th><th className="p-3">Date</th>
              <th className="p-3 text-right">Total</th><th className="p-3 text-right">Payé</th><th className="p-3">Statut</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} className="border-t border-[#eee8d5]">
                <td className="p-3 font-semibold">{i.number}<br /><span className="text-xs font-normal text-[#5d6e67]">{i.source_reference}</span></td>
                <td className="p-3">{i.customer_name}</td>
                <td className="p-3">{dateFr(i.issue_date)}</td>
                <td className="p-3 text-right">{fcfa(i.total)}</td>
                <td className="p-3 text-right">{fcfa(i.paid)}</td>
                <td className="p-3"><StatusBadge status={i.payment_status} label={statusLabels[i.payment_status]} /></td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button className="underline mr-3" onClick={() => downloadInvoicePdf(i)}>PDF</button>
                  {i.balance > 0 && (
                    <button className="underline" onClick={() => { setPaying(i); setAmount(i.balance); setError('') }}>
                      Enregistrer un paiement
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paying && (
        <form onSubmit={record} className="card p-6 grid gap-4 md:grid-cols-3" aria-label="Enregistrer un paiement">
          <h2 className="md:col-span-3 text-2xl text-emerald-deep font-semibold">Paiement — {paying.number}</h2>
          <p className="md:col-span-3 text-sm text-[#4b5d56]">
            Solde restant : {fcfa(paying.balance)}. Un paiement n'est enregistré comme confirmé qu'avec une preuve (numéro de reçu,
            référence Mobile Money, numéro de caisse…).
          </p>
          <div>
            <label className="label" htmlFor="p-amount">Montant reçu (FCFA)</label>
            <input id="p-amount" type="number" min={1} max={paying.balance} required className="field" value={amount} onChange={(e) => setAmount(Math.round(Number(e.target.value) || 0))} />
          </div>
          <div>
            <label className="label" htmlFor="p-method">Moyen</label>
            <select id="p-method" className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {['Espèces', 'Mobile Money', 'Carte bancaire', 'Virement'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-proof">Référence de preuve</label>
            <input id="p-proof" required className="field" value={proof} onChange={(e) => setProof(e.target.value)} />
          </div>
          {error && <p className="md:col-span-3 text-sm text-red-700" role="alert">{error}</p>}
          <div className="md:col-span-3 flex gap-3">
            <button className="btn-gold">Enregistrer le paiement</button>
            <button type="button" className="btn-dark" onClick={() => setPaying(null)}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  )
}
