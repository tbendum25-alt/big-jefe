import type { Api } from './api'
import { blobToDataUrl, shrinkForDemo } from './image'
import { applyPayments, buildInvoice } from './invoice'
import { checkEmail, checkPassword } from './team'
import {
  bookingLines,
  nightsBetween,
  rangesOverlap,
  todayIso,
  validateStay,
} from './pricing'
import {
  defaultSettings,
  demoCategories,
  demoMenuCategories,
  demoMenuItems,
  demoRooms,
  demoServices,
} from './demoData'
import type {
  Booking,
  ContactMessage,
  HotelSettings,
  Invoice,
  MenuCategory,
  MenuItem,
  Order,
  Payment,
  Room,
  RoomCategory,
  RoomPhoto,
  Service,
} from './types'

/**
 * Mode démonstration : tout est stocké dans le navigateur (localStorage).
 * Il sert à essayer le site sans compte Supabase. Il n'offre AUCUNE sécurité réelle
 * et ne remplace pas la production (voir README).
 */
interface Store {
  settings: HotelSettings
  categories: RoomCategory[]
  rooms: Omit<Room, 'photos'>[]
  photos: RoomPhoto[]
  bookings: Booking[]
  menuCategories: MenuCategory[]
  menuItems: MenuItem[]
  orders: Order[]
  services: Service[]
  invoices: Invoice[]
  payments: Payment[]
  messages: ContactMessage[]
  owner: boolean
  /** E-mail du compte connecté (session de démonstration). */
  ownerEmail: string
  team: DemoMember[]
  activity: { at: string; label: string }[]
}

interface DemoMember {
  user_id: string
  email: string
  password: string
  role: 'owner' | 'staff'
  created_at: string
}

const KEY = 'bigjefe.demo.v1'
export const DEMO_OWNER_EMAIL = 'bigjefe@demo.new'
export const DEMO_OWNER_PASSWORD = 'bigjefe91'

function fresh(): Store {
  return {
    settings: { ...defaultSettings },
    categories: demoCategories.map((c) => ({ ...c })),
    rooms: demoRooms.map((r) => ({ ...r })),
    photos: [],
    bookings: [],
    menuCategories: demoMenuCategories.map((c) => ({ ...c })),
    menuItems: demoMenuItems.map((i) => ({ ...i })),
    orders: [],
    services: demoServices.map((s) => ({ ...s })),
    invoices: [],
    payments: [],
    messages: [],
    owner: false,
    ownerEmail: '',
    team: [
      { user_id: 'demo-owner', email: DEMO_OWNER_EMAIL, password: DEMO_OWNER_PASSWORD, role: 'owner', created_at: new Date().toISOString() },
    ],
    activity: [],
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...fresh(), ...JSON.parse(raw) }
  } catch {
    /* stockage indisponible ou corrompu : on repart d'un état neuf */
  }
  return fresh()
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    throw new Error("Le stockage du navigateur est plein (mode démonstration : environ 5 Mo). Supprimez des photos, ou branchez Supabase pour un stockage illimité.")
  }
}

const uid = () => crypto.randomUUID()
const rand = (n: number) =>
  Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const stamp = () => todayIso().replace(/-/g, '').slice(2)

function log(store: Store, label: string) {
  store.activity.unshift({ at: new Date().toISOString(), label })
  store.activity = store.activity.slice(0, 20)
}

function withPhotos(store: Store, room: Omit<Room, 'photos'>): Room {
  const photos = store.photos.filter((p) => p.room_id === room.id).sort((a, b) => a.position - b.position)
  return { ...room, photos }
}

function nextInvoiceNumber(store: Store): string {
  const year = new Date().getFullYear()
  const n = store.invoices.filter((i) => i.number.startsWith(`FAC-${year}`)).length + 1
  return `FAC-${year}-${String(n).padStart(4, '0')}`
}

function refreshInvoice(store: Store, invoiceId: string) {
  const idx = store.invoices.findIndex((i) => i.id === invoiceId)
  if (idx < 0) return
  const pay = store.payments.filter((p) => p.invoice_id === invoiceId)
  const updated = applyPayments(
    store.invoices[idx],
    pay.filter((p) => p.status === 'succeeded').map((p) => p.amount),
    pay.some((p) => p.status === 'pending'),
  )
  store.invoices[idx] = updated
  const booking = store.bookings.find((b) => b.reference === updated.source_reference)
  if (booking) booking.payment_status = updated.payment_status
  const order = store.orders.find((o) => o.reference === updated.source_reference)
  if (order) order.payment_status = updated.payment_status
}

function requireOwner(store: Store) {
  if (!store.owner) throw new Error('Connexion du propriétaire requise.')
}

function currentMember(store: Store): DemoMember {
  requireOwner(store)
  const me = store.team.find((m) => m.email === store.ownerEmail)
  if (!me) throw new Error('Connexion du propriétaire requise.')
  return me
}

function requireTeamOwner(store: Store): DemoMember {
  const me = currentMember(store)
  if (me.role !== 'owner') throw new Error("Seul le propriétaire peut gérer l'équipe.")
  return me
}

export const demoApi: Api = {
  mode: 'demo',

  async getSettings() {
    return load().settings
  },
  async saveSettings(settings) {
    const s = load()
    requireOwner(s)
    s.settings = settings
    save(s)
  },

  async listCategories() {
    return load().categories
  },
  async saveCategory(cat) {
    const s = load()
    requireOwner(s)
    if (cat.id) s.categories = s.categories.map((c) => (c.id === cat.id ? { ...c, name: cat.name } : c))
    else s.categories.push({ id: uid(), name: cat.name })
    save(s)
  },
  async deleteCategory(id) {
    const s = load()
    requireOwner(s)
    if (s.rooms.some((r) => r.category_id === id)) throw new Error('Cette catégorie contient encore des chambres.')
    s.categories = s.categories.filter((c) => c.id !== id)
    save(s)
  },

  async listRooms(includeInactive = false) {
    const s = load()
    return s.rooms.filter((r) => includeInactive || r.is_active).map((r) => withPhotos(s, r))
  },
  async getRoom(id) {
    const s = load()
    const room = s.rooms.find((r) => r.id === id)
    return room ? withPhotos(s, room) : null
  },
  async saveRoom(room) {
    const s = load()
    requireOwner(s)
    if (room.price_per_night < 0 || !Number.isFinite(room.price_per_night)) throw new Error('Prix invalide.')
    const id = room.id ?? uid()
    const entry = { ...room, id }
    if (room.id) s.rooms = s.rooms.map((r) => (r.id === id ? entry : r))
    else s.rooms.push(entry)
    log(s, `Chambre « ${room.name} » enregistrée`)
    save(s)
    return id
  },
  async deleteRoom(id) {
    const s = load()
    requireOwner(s)
    if (s.bookings.some((b) => b.room_id === id && b.status !== 'cancelled' && b.status !== 'completed'))
      throw new Error('Des réservations actives existent pour cette chambre : désactivez-la plutôt.')
    s.rooms = s.rooms.filter((r) => r.id !== id)
    s.photos = s.photos.filter((p) => p.room_id !== id)
    save(s)
  },
  async addRoomPhoto(roomId, image) {
    const s = load()
    requireOwner(s)
    const existing = s.photos.filter((p) => p.room_id === roomId)
    const photo: RoomPhoto = {
      id: uid(),
      room_id: roomId,
      url: await blobToDataUrl(await shrinkForDemo(image)),
      position: existing.length,
      is_main: existing.length === 0,
    }
    s.photos.push(photo)
    save(s)
    return photo
  },
  async deleteRoomPhoto(photo) {
    const s = load()
    requireOwner(s)
    s.photos = s.photos.filter((p) => p.id !== photo.id)
    const rest = s.photos.filter((p) => p.room_id === photo.room_id).sort((a, b) => a.position - b.position)
    rest.forEach((p, i) => (p.position = i))
    if (rest.length && !rest.some((p) => p.is_main)) rest[0].is_main = true
    save(s)
  },
  async setMainPhoto(roomId, photoId) {
    const s = load()
    requireOwner(s)
    s.photos.forEach((p) => {
      if (p.room_id === roomId) p.is_main = p.id === photoId
    })
    save(s)
  },
  async movePhoto(roomId, photoId, direction) {
    const s = load()
    requireOwner(s)
    const list = s.photos.filter((p) => p.room_id === roomId).sort((a, b) => a.position - b.position)
    const i = list.findIndex((p) => p.id === photoId)
    const j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    const tmp = list[i].position
    list[i].position = list[j].position
    list[j].position = tmp
    save(s)
  },
  async availableRoomIds(checkIn, checkOut) {
    const s = load()
    return s.rooms
      .filter((r) => r.is_active)
      .filter(
        (r) =>
          !s.bookings.some(
            (b) =>
              b.room_id === r.id &&
              b.status !== 'cancelled' &&
              b.status !== 'completed' &&
              rangesOverlap(checkIn, checkOut, b.check_in, b.check_out),
          ),
      )
      .map((r) => r.id)
  },

  async createBooking(req) {
    const s = load()
    const room = s.rooms.find((r) => r.id === req.room_id && r.is_active)
    if (!room) throw new Error("Cette chambre n'est plus disponible à la réservation.")
    const problem = validateStay(req.check_in, req.check_out, req.guests, room.capacity)
    if (problem) throw new Error(problem)
    if (!req.guest_name.trim() || !req.guest_email.includes('@') || req.guest_phone.replace(/\D/g, '').length < 8)
      throw new Error('Renseignez votre nom, un e-mail valide et un numéro de téléphone.')
    if (req.payment_method === 'on_site' && !s.settings.pay_on_site_enabled)
      throw new Error("Le paiement à l'hôtel n'est pas proposé.")
    if (req.payment_method === 'online' && !s.settings.pay_online_enabled)
      throw new Error("Le paiement en ligne n'est pas encore activé.")
    // Contrôle des disponibilités juste avant l'écriture (équivalent de la contrainte d'exclusion en base).
    const free = await this.availableRoomIds(req.check_in, req.check_out)
    if (!free.includes(room.id)) throw new Error('Cette chambre vient d’être réservée sur ces dates.')

    const nights = nightsBetween(req.check_in, req.check_out)
    const lines = bookingLines(room.name, nights, room.price_per_night) // prix relu côté « serveur », jamais du client
    const reference = `BJ-${stamp()}-${rand(4)}`
    const invoice = buildInvoice({
      id: uid(),
      number: nextInvoiceNumber(s),
      kind: 'booking',
      sourceReference: reference,
      customer: { name: req.guest_name.trim(), email: req.guest_email.trim(), phone: req.guest_phone.trim() },
      lines,
      settings: s.settings,
      method: req.payment_method,
    })
    const booking: Booking = {
      id: uid(),
      reference,
      room_id: room.id,
      guest_name: req.guest_name.trim(),
      guest_email: req.guest_email.trim(),
      guest_phone: req.guest_phone.trim(),
      check_in: req.check_in,
      check_out: req.check_out,
      guests: req.guests,
      nights,
      unit_price: room.price_per_night,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method: req.payment_method,
      notes: req.notes.trim(),
      created_at: new Date().toISOString(),
    }
    s.bookings.unshift(booking)
    s.invoices.unshift(invoice)
    log(s, `Nouvelle réservation ${reference} — ${booking.guest_name}`)
    save(s)
    return { booking, invoice }
  },
  async lookupBooking(reference, email) {
    const s = load()
    const booking = s.bookings.find(
      (b) => b.reference.toLowerCase() === reference.trim().toLowerCase() && b.guest_email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (!booking) return null
    const invoice = s.invoices.find((i) => i.source_reference === booking.reference)
    return invoice ? { booking, invoice } : null
  },
  async listBookings() {
    const s = load()
    requireOwner(s)
    return s.bookings
  },
  async updateBookingStatus(id, status) {
    const s = load()
    requireOwner(s)
    const b = s.bookings.find((x) => x.id === id)
    if (!b) return
    b.status = status
    log(s, `Réservation ${b.reference} : ${status}`)
    save(s)
  },

  async listMenuCategories() {
    return load().menuCategories.sort((a, b) => a.position - b.position)
  },
  async saveMenuCategory(cat) {
    const s = load()
    requireOwner(s)
    if (cat.id) s.menuCategories = s.menuCategories.map((c) => (c.id === cat.id ? { ...c, name: cat.name } : c))
    else s.menuCategories.push({ id: uid(), name: cat.name, position: s.menuCategories.length + 1 })
    save(s)
  },
  async deleteMenuCategory(id) {
    const s = load()
    requireOwner(s)
    if (s.menuItems.some((i) => i.category_id === id)) throw new Error('Cette catégorie contient encore des plats.')
    s.menuCategories = s.menuCategories.filter((c) => c.id !== id)
    save(s)
  },
  async listMenuItems(includeUnavailable = false) {
    return load().menuItems.filter((i) => includeUnavailable || i.is_available)
  },
  async saveMenuItem(item) {
    const s = load()
    requireOwner(s)
    if (item.price < 0 || !Number.isFinite(item.price)) throw new Error('Prix invalide.')
    if (item.id) s.menuItems = s.menuItems.map((i) => (i.id === item.id ? ({ ...item, id: item.id } as MenuItem) : i))
    else s.menuItems.push({ ...item, id: uid() })
    save(s)
  },
  async deleteMenuItem(id) {
    const s = load()
    requireOwner(s)
    s.menuItems = s.menuItems.filter((i) => i.id !== id)
    save(s)
  },
  async uploadMenuPhoto(image) {
    requireOwner(load())
    return blobToDataUrl(await shrinkForDemo(image))
  },
  async createOrder(req) {
    const s = load()
    if (!req.items.length) throw new Error('Votre panier est vide.')
    if (!req.guest_name.trim() || req.guest_phone.replace(/\D/g, '').length < 8)
      throw new Error('Renseignez votre nom et un numéro de téléphone.')
    if (req.mode === 'room_service' && !req.room_number.trim()) throw new Error('Indiquez votre numéro de chambre.')
    if (req.payment_method === 'on_site' && !s.settings.pay_on_site_enabled)
      throw new Error("Le paiement à l'hôtel n'est pas proposé.")
    if (req.payment_method === 'online' && !s.settings.pay_online_enabled)
      throw new Error("Le paiement en ligne n'est pas encore activé.")
    const items = req.items.map((line) => {
      const dish = s.menuItems.find((i) => i.id === line.item_id && i.is_available)
      if (!dish) throw new Error('Un plat de votre panier n’est plus disponible.')
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 50) throw new Error('Quantité invalide.')
      return { item_id: dish.id, name: dish.name, unit_price: dish.price, quantity: line.quantity }
    })
    const reference = `CMD-${stamp()}-${rand(4)}`
    const invoice = buildInvoice({
      id: uid(),
      number: nextInvoiceNumber(s),
      kind: 'order',
      sourceReference: reference,
      customer: { name: req.guest_name.trim(), email: '', phone: req.guest_phone.trim() },
      lines: items.map((i) => ({ label: i.name, quantity: i.quantity, unit_price: i.unit_price, total: i.quantity * i.unit_price })),
      settings: s.settings,
      method: req.payment_method,
    })
    const order: Order = {
      id: uid(),
      reference,
      guest_name: req.guest_name.trim(),
      guest_phone: req.guest_phone.trim(),
      room_number: req.room_number.trim(),
      mode: req.mode,
      items,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      status: 'new',
      payment_status: 'unpaid',
      payment_method: req.payment_method,
      created_at: new Date().toISOString(),
    }
    s.orders.unshift(order)
    s.invoices.unshift(invoice)
    log(s, `Nouvelle commande ${reference} — ${order.guest_name}`)
    save(s)
    return { order, invoice }
  },
  async listOrders() {
    const s = load()
    requireOwner(s)
    return s.orders
  },
  async updateOrderStatus(id, status) {
    const s = load()
    requireOwner(s)
    const o = s.orders.find((x) => x.id === id)
    if (!o) return
    o.status = status
    save(s)
  },

  async listServices(includeInactive = false) {
    return load().services.filter((x) => includeInactive || x.is_active)
  },
  async saveService(service) {
    const s = load()
    requireOwner(s)
    if (service.price < 0 || !Number.isFinite(service.price)) throw new Error('Prix invalide.')
    if (service.id) s.services = s.services.map((x) => (x.id === service.id ? ({ ...service, id: service.id } as Service) : x))
    else s.services.push({ ...service, id: uid() })
    save(s)
  },
  async deleteService(id) {
    const s = load()
    requireOwner(s)
    s.services = s.services.filter((x) => x.id !== id)
    save(s)
  },

  async listInvoices() {
    const s = load()
    requireOwner(s)
    return s.invoices
  },
  async recordManualPayment(invoiceId, amount, method, proofReference) {
    const s = load()
    requireOwner(s)
    // Pas de paiement « confirmé » sans pièce justificative (reçu, référence Mobile Money, numéro de caisse…).
    if (!proofReference.trim()) throw new Error('Indiquez la référence de preuve du paiement (reçu, référence Mobile Money…).')
    const inv = s.invoices.find((i) => i.id === invoiceId)
    if (!inv) throw new Error('Facture introuvable.')
    if (!(amount > 0) || amount > inv.balance) throw new Error(`Le montant doit être compris entre 1 et ${inv.balance}.`)
    s.payments.push({
      id: uid(),
      invoice_id: invoiceId,
      amount,
      method,
      provider: 'manual',
      provider_ref: '',
      proof_reference: proofReference.trim(),
      status: 'succeeded',
      created_at: new Date().toISOString(),
    })
    refreshInvoice(s, invoiceId)
    log(s, `Paiement de ${amount} FCFA enregistré sur ${inv.number}`)
    save(s)
  },
  async startOnlinePayment() {
    return {
      state: 'unconfigured',
      message:
        "Le paiement en ligne n'est pas connecté en mode démonstration. Après configuration de FedaPay ou Kkiapay (voir le README), cette étape ouvrira la page de paiement sécurisée.",
    }
  },

  async sendContact(msg) {
    const s = load()
    if (!msg.name.trim() || !msg.email.includes('@') || msg.message.trim().length < 5)
      throw new Error('Renseignez votre nom, un e-mail valide et votre message.')
    s.messages.unshift({ ...msg, id: uid(), created_at: new Date().toISOString() })
    save(s)
  },
  async listMessages() {
    const s = load()
    requireOwner(s)
    return s.messages
  },

  async stats() {
    const s = load()
    requireOwner(s)
    const today = todayIso()
    const active = s.bookings.filter((b) => b.status !== 'cancelled')
    const occupied = new Set(
      active.filter((b) => b.status !== 'completed' && b.check_in <= today && today < b.check_out).map((b) => b.room_id),
    )
    return {
      bookings_total: s.bookings.length,
      arrivals_today: active.filter((b) => b.check_in === today).length,
      departures_today: active.filter((b) => b.check_out === today).length,
      rooms_total: s.rooms.filter((r) => r.is_active).length,
      rooms_occupied: occupied.size,
      orders_total: s.orders.length,
      revenue_confirmed: s.payments.filter((p) => p.status === 'succeeded').reduce((a, p) => a + p.amount, 0),
      revenue_pending: s.invoices.reduce((a, i) => a + i.balance, 0),
      recent: s.activity,
    }
  },

  async signIn(email, password) {
    const s = load()
    const member = s.team.find((m) => m.email === email.trim().toLowerCase() && m.password === password)
    if (!member) throw new Error('Identifiants incorrects.')
    s.owner = true
    s.ownerEmail = member.email
    save(s)
  },
  async signOut() {
    const s = load()
    s.owner = false
    s.ownerEmail = ''
    save(s)
  },
  async isOwner() {
    return load().owner
  },
  async changePassword(newPassword) {
    const s = load()
    const me = currentMember(s)
    const problem = checkPassword(newPassword)
    if (problem) throw new Error(problem)
    me.password = newPassword
    save(s)
  },

  async needsSetup() {
    return false
  },
  async setupOwner() {
    throw new Error('La configuration initiale n\'est pas disponible en mode démonstration.')
  },
  async listTeam() {
    const s = load()
    currentMember(s)
    return s.team.map((m) => ({
      user_id: m.user_id,
      email: m.email,
      role: m.role,
      created_at: m.created_at,
      is_self: m.email === s.ownerEmail,
    }))
  },
  async addTeamMember(email, password) {
    const s = load()
    requireTeamOwner(s)
    const problem = checkEmail(email) ?? checkPassword(password)
    if (problem) throw new Error(problem)
    const mail = email.trim().toLowerCase()
    if (s.team.some((m) => m.email === mail)) throw new Error('Un compte existe déjà avec cet e-mail.')
    s.team.push({ user_id: uid(), email: mail, password, role: 'staff', created_at: new Date().toISOString() })
    save(s)
  },
  async removeTeamMember(userId) {
    const s = load()
    const me = requireTeamOwner(s)
    const target = s.team.find((m) => m.user_id === userId)
    if (!target) throw new Error('Compte introuvable.')
    if (target.user_id === me.user_id || target.role === 'owner') throw new Error('Le compte propriétaire ne peut pas être retiré.')
    s.team = s.team.filter((m) => m.user_id !== userId)
    save(s)
  },
}

export function resetDemoData() {
  localStorage.removeItem(KEY)
}
