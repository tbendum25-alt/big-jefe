import { computeTotals } from './pricing'
import type { HotelSettings, Invoice, InvoiceLine, PaymentMethod } from './types'

export function hotelSnapshot(s: HotelSettings): Invoice['hotel'] {
  return {
    name: s.name,
    address: s.address,
    city: s.city,
    phone: s.phone,
    email: s.email,
    invoice_footer: s.invoice_footer,
    currency: s.currency,
  }
}

export interface BuildInvoiceInput {
  id: string
  number: string
  kind: Invoice['kind']
  sourceReference: string
  customer: { name: string; email: string; phone: string }
  lines: InvoiceLine[]
  settings: HotelSettings
  method: PaymentMethod
  discount?: number
  issueDate?: string
}

/**
 * Construit une facture figée. Les libellés, prix, taux de taxe et coordonnées de l'hôtel
 * sont copiés : modifier un tarif plus tard ne change jamais une facture déjà émise.
 * Une facture neuve n'est jamais « payée » : le paiement doit être vérifié ensuite.
 */
export function buildInvoice(input: BuildInvoiceInput): Invoice {
  const subtotal = input.lines.reduce((sum, l) => sum + l.total, 0)
  const discount = input.discount ?? 0
  const { tax, total } = computeTotals(Math.max(subtotal - discount, 0), input.settings.tax_rate)
  return {
    id: input.id,
    number: input.number,
    kind: input.kind,
    source_reference: input.sourceReference,
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    customer_phone: input.customer.phone,
    issue_date: input.issueDate ?? new Date().toISOString().slice(0, 10),
    lines: input.lines.map((l) => ({ ...l })),
    subtotal,
    tax_rate: input.settings.tax_rate,
    tax,
    discount,
    total,
    paid: 0,
    balance: total,
    payment_method: input.method,
    payment_status: 'unpaid',
    hotel: hotelSnapshot(input.settings),
  }
}

/** Recalcule le montant payé et le solde à partir des paiements réellement confirmés. */
export function applyPayments(invoice: Invoice, succeededAmounts: number[], hasPending: boolean): Invoice {
  const paid = succeededAmounts.reduce((a, b) => a + b, 0)
  const balance = Math.max(invoice.total - paid, 0)
  const payment_status =
    paid >= invoice.total && invoice.total > 0 ? 'paid' : paid > 0 ? 'partial' : hasPending ? 'pending' : 'unpaid'
  return { ...invoice, paid, balance, payment_status }
}
