/** Montant en FCFA : « 45 000 FCFA ». */
export function fcfa(amount: number): string {
  const rounded = Math.round(amount)
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${rounded < 0 ? '-' : ''}${grouped} FCFA`
}

export function dateFr(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function dateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Garde uniquement les chiffres d'un numéro (pour les liens WhatsApp / tel). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function whatsappLink(whatsappDigits: string, text = ''): string {
  const n = digitsOnly(whatsappDigits)
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
  unpaid: 'Non payé',
  partial: 'Partiel',
  paid: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé',
  new: 'Nouvelle',
  preparing: 'En préparation',
  served: 'Servie',
}

export const modeLabels: Record<string, string> = {
  dine_in: 'Sur place',
  room_service: 'Service en chambre',
  takeaway: 'À emporter',
}
