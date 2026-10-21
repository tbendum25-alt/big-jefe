import { beforeEach, describe, expect, it } from 'vitest'
import { applyPayments, buildInvoice } from '../src/lib/invoice'
import { defaultSettings } from '../src/lib/demoData'

// Simule localStorage pour exécuter le mode démonstration dans Node.
const memory = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
} as Storage

const { demoApi, DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD } = await import('../src/lib/demoApi')

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

const request = (overrides = {}) => ({
  room_id: 'room-101',
  check_in: future(10),
  check_out: future(12),
  guests: 2,
  guest_name: 'Awa Koffi',
  guest_email: 'awa@example.com',
  guest_phone: '0197000000',
  payment_method: 'on_site' as const,
  notes: '',
  ...overrides,
})

beforeEach(() => memory.clear())

describe('réservations (mode démonstration)', () => {
  it('crée une réservation et une facture figée, jamais payée au départ', async () => {
    const { booking, invoice } = await demoApi.createBooking(request())
    expect(booking.status).toBe('pending')
    expect(booking.nights).toBe(2)
    expect(booking.total).toBe(70000)
    expect(invoice.payment_status).toBe('unpaid')
    expect(invoice.paid).toBe(0)
    expect(invoice.balance).toBe(70000)
    expect(invoice.number).toMatch(/^FAC-\d{4}-0001$/)
  })

  it('empêche une double réservation de la même chambre', async () => {
    await demoApi.createBooking(request())
    await expect(demoApi.createBooking(request({ check_in: future(11), check_out: future(13) }))).rejects.toThrow(/réservée|disponible/)
  })

  it('autorise une arrivée le jour du départ du client précédent', async () => {
    await demoApi.createBooking(request())
    await expect(demoApi.createBooking(request({ check_in: future(12), check_out: future(14) }))).resolves.toBeTruthy()
  })

  it('refuse un nombre de personnes supérieur à la capacité', async () => {
    await expect(demoApi.createBooking(request({ guests: 5 }))).rejects.toThrow(/personne/)
  })

  it("n'accepte pas un prix venant du navigateur", async () => {
    const { booking } = await demoApi.createBooking({ ...request(), unit_price: 1, total: 1 } as never)
    expect(booking.unit_price).toBe(35000)
  })

  it('refuse le paiement en ligne tant qu’il est désactivé', async () => {
    await expect(demoApi.createBooking(request({ payment_method: 'online' }))).rejects.toThrow(/en ligne/)
  })

  it('retrouve une réservation par référence et e-mail uniquement', async () => {
    const { booking } = await demoApi.createBooking(request())
    expect(await demoApi.lookupBooking(booking.reference, 'awa@example.com')).not.toBeNull()
    expect(await demoApi.lookupBooking(booking.reference, 'autre@example.com')).toBeNull()
  })
})

describe('paiements et factures', () => {
  it("exige une preuve pour enregistrer un paiement et l'accès propriétaire", async () => {
    const { invoice } = await demoApi.createBooking(request())
    await expect(demoApi.recordManualPayment(invoice.id, 1000, 'Espèces', 'RC-1')).rejects.toThrow(/propriétaire/)
    await demoApi.signIn(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD)
    await expect(demoApi.recordManualPayment(invoice.id, 1000, 'Espèces', '  ')).rejects.toThrow(/preuve/)
  })

  it('ne marque « payée » que lorsque les paiements couvrent le total', async () => {
    const { booking, invoice } = await demoApi.createBooking(request())
    await demoApi.signIn(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD)
    await demoApi.recordManualPayment(invoice.id, 20000, 'Espèces', 'RC-1')
    let found = (await demoApi.listInvoices())[0]
    expect(found.payment_status).toBe('partial')
    expect(found.balance).toBe(50000)
    await demoApi.recordManualPayment(invoice.id, 50000, 'Mobile Money', 'MM-889')
    found = (await demoApi.listInvoices())[0]
    expect(found.payment_status).toBe('paid')
    expect(found.balance).toBe(0)
    expect((await demoApi.listBookings()).find((b) => b.id === booking.id)?.payment_status).toBe('paid')
  })

  it('refuse un montant supérieur au solde', async () => {
    const { invoice } = await demoApi.createBooking(request())
    await demoApi.signIn(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD)
    await expect(demoApi.recordManualPayment(invoice.id, 999999, 'Espèces', 'RC-2')).rejects.toThrow(/montant/i)
  })

  it('ne modifie pas une facture émise quand le tarif de la chambre change', async () => {
    const { invoice } = await demoApi.createBooking(request())
    await demoApi.signIn(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD)
    const room = (await demoApi.listRooms(true)).find((r) => r.id === 'room-101')!
    const { photos: _photos, ...fields } = room
    void _photos
    await demoApi.saveRoom({ ...fields, price_per_night: 99000 })
    const stored = (await demoApi.listInvoices()).find((i) => i.id === invoice.id)!
    expect(stored.total).toBe(70000)
    expect(stored.lines[0].unit_price).toBe(35000)
  })
})

describe('commandes du restaurant', () => {
  it('recalcule les prix côté serveur et crée une facture', async () => {
    const { order, invoice } = await demoApi.createOrder({
      guest_name: 'Awa',
      guest_phone: '0197000000',
      room_number: '',
      mode: 'dine_in',
      payment_method: 'on_site',
      items: [{ item_id: 'mi-3', quantity: 2 }],
    })
    expect(order.total).toBe(19000)
    expect(invoice.lines[0]).toMatchObject({ quantity: 2, unit_price: 9500, total: 19000 })
  })

  it('refuse un panier vide et le service en chambre sans numéro', async () => {
    const base = { guest_name: 'Awa', guest_phone: '0197000000', room_number: '', payment_method: 'on_site' as const }
    await expect(demoApi.createOrder({ ...base, mode: 'dine_in', items: [] })).rejects.toThrow(/vide/)
    await expect(demoApi.createOrder({ ...base, mode: 'room_service', items: [{ item_id: 'mi-3', quantity: 1 }] })).rejects.toThrow(/chambre/)
  })
})

describe('factures (logique pure)', () => {
  const lines = [{ label: 'Chambre', quantity: 2, unit_price: 10000, total: 20000 }]
  it('applique la taxe et fige les coordonnées de l’hôtel', () => {
    const inv = buildInvoice({
      id: '1',
      number: 'FAC-2026-0001',
      kind: 'booking',
      sourceReference: 'BJ-1',
      customer: { name: 'A', email: 'a@a.a', phone: '1' },
      lines,
      settings: { ...defaultSettings, tax_rate: 10 },
      method: 'on_site',
    })
    expect(inv.tax).toBe(2000)
    expect(inv.total).toBe(22000)
    expect(inv.hotel.name).toBe('BIG JEFE')
    expect(inv.payment_status).toBe('unpaid')
  })

  it("passe à « en attente » sans jamais marquer payée", () => {
    const inv = buildInvoice({
      id: '1',
      number: 'F',
      kind: 'order',
      sourceReference: 'R',
      customer: { name: 'A', email: '', phone: '' },
      lines,
      settings: defaultSettings,
      method: 'online',
    })
    expect(applyPayments(inv, [], true).payment_status).toBe('pending')
    expect(applyPayments(inv, [20000], false).payment_status).toBe('paid')
  })
})

describe('équipe de l\'administration (mode démonstration)', () => {
  const owner = () => demoApi.signIn(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD)

  it('refuse l\'accès aux comptes sans connexion', async () => {
    await expect(demoApi.listTeam()).rejects.toThrow()
    await expect(demoApi.addTeamMember('emp@example.com', 'motdepasse-solide')).rejects.toThrow()
  })

  it('le propriétaire ajoute un employé qui peut ensuite se connecter', async () => {
    await owner()
    await demoApi.addTeamMember('Emp@Example.com', 'motdepasse-solide')
    const team = await demoApi.listTeam()
    expect(team.map((m) => m.role).sort()).toEqual(['owner', 'staff'])
    await demoApi.signOut()
    await demoApi.signIn('emp@example.com', 'motdepasse-solide')
    expect(await demoApi.isOwner()).toBe(true)
  })

  it('un employé ne peut ni ajouter ni retirer de comptes', async () => {
    await owner()
    await demoApi.addTeamMember('emp@example.com', 'motdepasse-solide')
    await demoApi.signOut()
    await demoApi.signIn('emp@example.com', 'motdepasse-solide')
    await expect(demoApi.addTeamMember('autre@example.com', 'motdepasse-solide')).rejects.toThrow(/propriétaire/)
    const owner0 = (await demoApi.listTeam()).find((m) => m.role === 'owner')!
    await expect(demoApi.removeTeamMember(owner0.user_id)).rejects.toThrow(/propriétaire/)
  })

  it('refuse un mot de passe trop court, un e-mail invalide ou un doublon', async () => {
    await owner()
    await expect(demoApi.addTeamMember('emp@example.com', 'court')).rejects.toThrow(/caractères/)
    await expect(demoApi.addTeamMember('pas-un-mail', 'motdepasse-solide')).rejects.toThrow(/e-mail/)
    await demoApi.addTeamMember('emp@example.com', 'motdepasse-solide')
    await expect(demoApi.addTeamMember('emp@example.com', 'motdepasse-solide')).rejects.toThrow(/existe déjà/)
  })

  it('retire un employé mais jamais le propriétaire', async () => {
    await owner()
    await demoApi.addTeamMember('emp@example.com', 'motdepasse-solide')
    const team = await demoApi.listTeam()
    const staff = team.find((m) => m.role === 'staff')!
    const boss = team.find((m) => m.role === 'owner')!
    await expect(demoApi.removeTeamMember(boss.user_id)).rejects.toThrow()
    await demoApi.removeTeamMember(staff.user_id)
    expect(await demoApi.listTeam()).toHaveLength(1)
    await demoApi.signOut()
    await expect(demoApi.signIn('emp@example.com', 'motdepasse-solide')).rejects.toThrow()
  })

  it('change son mot de passe', async () => {
    await owner()
    await demoApi.changePassword('nouveau-mot-de-passe')
    await demoApi.signOut()
    await expect(demoApi.signIn(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD)).rejects.toThrow()
    await demoApi.signIn(DEMO_OWNER_EMAIL, 'nouveau-mot-de-passe')
  })
})
