import { describe, expect, it } from 'vitest'
import { computeTotals, nightsBetween, rangesOverlap, validateStay } from '../src/lib/pricing'
import { fcfa, whatsappLink } from '../src/lib/format'

describe('nuits et chevauchements', () => {
  it('compte les nuits entre deux dates', () => {
    expect(nightsBetween('2026-11-01', '2026-11-04')).toBe(3)
    expect(nightsBetween('2026-11-01', '2026-11-01')).toBe(0)
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3)
  })

  it('autorise un départ et une arrivée le même jour', () => {
    expect(rangesOverlap('2026-11-01', '2026-11-04', '2026-11-04', '2026-11-06')).toBe(false)
  })

  it('détecte les séjours qui se chevauchent', () => {
    expect(rangesOverlap('2026-11-01', '2026-11-04', '2026-11-03', '2026-11-06')).toBe(true)
    expect(rangesOverlap('2026-11-02', '2026-11-03', '2026-11-01', '2026-11-05')).toBe(true)
  })
})

describe('montants', () => {
  it('calcule la taxe arrondie à l’unité', () => {
    expect(computeTotals(35000, 0)).toEqual({ subtotal: 35000, tax: 0, total: 35000 })
    expect(computeTotals(33333, 18)).toEqual({ subtotal: 33333, tax: 6000, total: 39333 })
  })

  it('formate les montants en FCFA', () => {
    expect(fcfa(1234567)).toBe('1 234 567 FCFA')
    expect(fcfa(0)).toBe('0 FCFA')
  })
})

describe('validation du séjour', () => {
  const today = '2026-10-13'
  it('refuse une arrivée dans le passé', () => {
    expect(validateStay('2026-10-01', '2026-10-03', 2, 3, today)).toMatch(/passé/)
  })
  it('refuse un départ avant ou le jour de l’arrivée', () => {
    expect(validateStay('2026-11-05', '2026-11-05', 2, 3, today)).not.toBeNull()
  })
  it('refuse plus de personnes que la capacité', () => {
    expect(validateStay('2026-11-05', '2026-11-07', 4, 3, today)).toMatch(/3 personnes/)
  })
  it('accepte un séjour valide', () => {
    expect(validateStay('2026-11-05', '2026-11-07', 2, 3, today)).toBeNull()
  })
})

describe('WhatsApp', () => {
  it('nettoie le numéro dans le lien', () => {
    expect(whatsappLink('+229 01 29 22 64 64')).toBe('https://wa.me/2290129226464')
  })
})
