import type { InvoiceLine, PaymentStatus } from './types'

const DAY = 86_400_000

/** Interprète une date ISO « AAAA-MM-JJ » en UTC pour éviter les décalages de fuseau. */
export function parseDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const n = Math.round((parseDay(checkOut) - parseDay(checkIn)) / DAY)
  return Number.isFinite(n) ? n : 0
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Deux séjours se chevauchent si l'un commence avant la fin de l'autre ; le jour de départ reste libre. */
export function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return parseDay(aIn) < parseDay(bOut) && parseDay(bIn) < parseDay(aOut)
}

export interface Totals {
  subtotal: number
  tax: number
  total: number
}

/** Les montants sont en FCFA entiers : la taxe est arrondie à l'unité. */
export function computeTotals(subtotal: number, taxRatePercent: number): Totals {
  const tax = Math.round((subtotal * taxRatePercent) / 100)
  return { subtotal, tax, total: subtotal + tax }
}

export function bookingLines(roomName: string, nights: number, unitPrice: number): InvoiceLine[] {
  return [
    {
      label: `${roomName} — ${nights} nuit${nights > 1 ? 's' : ''}`,
      quantity: nights,
      unit_price: unitPrice,
      total: nights * unitPrice,
    },
  ]
}

export function paymentStatusFor(total: number, paid: number, hasPending: boolean): PaymentStatus {
  if (paid >= total && total > 0) return 'paid'
  if (paid > 0) return 'partial'
  if (hasPending) return 'pending'
  return 'unpaid'
}

export function validateStay(
  checkIn: string,
  checkOut: string,
  guests: number,
  capacity: number,
  today: string = todayIso(),
): string | null {
  if (!checkIn || !checkOut) return "Choisissez vos dates d'arrivée et de départ."
  if (parseDay(checkIn) < parseDay(today)) return "La date d'arrivée ne peut pas être dans le passé."
  if (nightsBetween(checkIn, checkOut) < 1) return 'Le départ doit être au moins un jour après l’arrivée.'
  if (nightsBetween(checkIn, checkOut) > 60) return 'Le séjour ne peut pas dépasser 60 nuits.'
  if (guests < 1) return 'Indiquez au moins une personne.'
  if (guests > capacity) return `Cette chambre accueille ${capacity} personne${capacity > 1 ? 's' : ''} au maximum.`
  return null
}
