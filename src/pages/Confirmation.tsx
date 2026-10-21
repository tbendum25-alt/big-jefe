import { useLocation, Link } from 'react-router-dom'
import { BookingSummary } from '../components/BookingSummary'
import { Empty } from '../components/ui'
import type { BookingResult } from '../lib/types'

function lastBooking(state: unknown): BookingResult | null {
  if (state && typeof state === 'object' && 'booking' in state) return state as BookingResult
  try {
    const raw = sessionStorage.getItem('bigjefe.lastBooking')
    return raw ? (JSON.parse(raw) as BookingResult) : null
  } catch {
    return null
  }
}

export default function Confirmation() {
  const { state } = useLocation()
  const result = lastBooking(state)
  return (
    <div className="pt-32 mx-auto max-w-3xl px-5">
      {result ? (
        <>
          <h1 className="text-5xl text-emerald-deep font-semibold text-center">Demande envoyée</h1>
          <p className="text-center mt-3 mb-8 text-[#35463f]">
            Merci {result.booking.guest_name.split(' ')[0]}. Conservez votre numéro de réservation : avec votre e-mail, il
            vous permet de retrouver votre facture à tout moment dans « Ma réservation ».
          </p>
          <BookingSummary booking={result.booking} invoice={result.invoice} />
        </>
      ) : (
        <Empty>
          Aucune réservation à afficher. <Link className="underline" to="/ma-reservation">Retrouver ma réservation</Link>
        </Empty>
      )}
    </div>
  )
}
