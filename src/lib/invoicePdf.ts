import type { jsPDF } from 'jspdf'
import { dateFr } from './format'
import type { Invoice } from './types'

const EMERALD: [number, number, number] = [6, 78, 59]
const NIGHT: [number, number, number] = [2, 44, 34]
const GOLD: [number, number, number] = [212, 175, 55]
const IVORY: [number, number, number] = [248, 245, 236]

// jsPDF (police Helvetica) ne sait pas afficher les espaces insécables fines : on formate à part.
const money = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`

const paymentLabel: Record<string, string> = {
  unpaid: 'NON PAYÉE',
  pending: 'PAIEMENT EN ATTENTE DE VÉRIFICATION',
  partial: 'PAIEMENT PARTIEL',
  paid: 'PAYÉE',
  failed: 'PAIEMENT ÉCHOUÉ',
  refunded: 'REMBOURSÉE',
}

/**
 * Construit le PDF à partir des données FIGÉES de la facture (lignes, taux, coordonnées de l'hôtel).
 * La mention « PAYÉE » n'apparaît que si des paiements confirmés couvrent le total.
 */
export async function buildInvoicePdf(invoice: Invoice): Promise<jsPDF> {
  // Chargés à la demande : le PDF n'alourdit pas le site public.
  const [{ jsPDF: PDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new PDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()

  // En-tête vert émeraude + filet or
  doc.setFillColor(...NIGHT)
  doc.rect(0, 0, w, 38, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 38, w, 1.4, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(26)
  doc.text(invoice.hotel.name.toUpperCase(), 16, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...IVORY)
  const contact = [invoice.hotel.address, invoice.hotel.city, invoice.hotel.phone, invoice.hotel.email].filter(Boolean)
  doc.text(contact.join('  •  '), 16, 29, { maxWidth: w - 32 })

  // Titre et numéro
  doc.setTextColor(...EMERALD)
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.text('FACTURE', 16, 56)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`N° ${invoice.number}`, 16, 63)
  doc.text(`Date : ${dateFr(invoice.issue_date)}`, 16, 69)
  doc.text(`${invoice.kind === 'booking' ? 'Réservation' : 'Commande'} : ${invoice.source_reference}`, 16, 75)

  // Client
  doc.setFont('helvetica', 'bold')
  doc.text('Facturé à', w - 90, 56)
  doc.setFont('helvetica', 'normal')
  const client = [invoice.customer_name, invoice.customer_email, invoice.customer_phone].filter(Boolean)
  doc.text(client, w - 90, 63)

  // Lignes
  autoTable(doc, {
    startY: 86,
    head: [['Désignation', 'Qté', 'Prix unitaire', 'Total']],
    body: invoice.lines.map((l) => [l.label, String(l.quantity), money(l.unit_price), money(l.total)]),
    headStyles: { fillColor: EMERALD, textColor: IVORY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 248, 241] },
    columnStyles: {
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 38 },
    },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: 16, right: 16 },
  })

  // Totaux
  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const rows: [string, string][] = [['Sous-total', money(invoice.subtotal)]]
  if (invoice.discount > 0) rows.push(['Réduction', `- ${money(invoice.discount)}`])
  if (invoice.tax_rate > 0) rows.push([`Taxes (${invoice.tax_rate} %)`, money(invoice.tax)])
  rows.push(['Total à payer', money(invoice.total)])
  rows.push(['Montant payé', money(invoice.paid)])
  rows.push(['Solde restant', money(invoice.balance)])
  autoTable(doc, {
    startY: lastY + 6,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right', cellWidth: 42 } },
    margin: { left: w / 2 - 10, right: 16 },
    didParseCell: (d) => {
      // La ligne « Total à payer » ressort en vert émeraude.
      if (d.row.index === rows.length - 3) {
        d.cell.styles.textColor = EMERALD
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Statut de paiement
  const afterTotals = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const statusColor: [number, number, number] = invoice.payment_status === 'paid' ? EMERALD : [150, 90, 0]
  doc.setTextColor(...statusColor)
  doc.text(`Statut : ${paymentLabel[invoice.payment_status] ?? invoice.payment_status}`, 16, afterTotals + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(
    `Mode de paiement choisi : ${invoice.payment_method === 'online' ? 'en ligne' : "à l'hôtel"}`,
    16,
    afterTotals + 18,
  )

  // Pied de page
  const h = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...GOLD)
  doc.line(16, h - 22, w - 16, h - 22)
  doc.setFontSize(8.5)
  doc.setTextColor(110, 110, 110)
  doc.text(invoice.hotel.invoice_footer || `Merci de votre confiance — ${invoice.hotel.name}`, w / 2, h - 15, {
    align: 'center',
    maxWidth: w - 32,
  })
  return doc
}

export async function downloadInvoicePdf(invoice: Invoice) {
  const doc = await buildInvoicePdf(invoice)
  doc.save(`${invoice.number}.pdf`)
}
