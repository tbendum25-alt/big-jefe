import type { Api } from './api'
import { supabase } from './supabase'
import type {
  Booking,
  BookingResult,
  ContactMessage,
  DashboardStats,
  HotelSettings,
  Invoice,
  MenuCategory,
  MenuItem,
  Order,
  OrderResult,
  Room,
  RoomCategory,
  RoomPhoto,
  Service,
  TeamMember,
} from './types'

function db() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.")
  return supabase
}

/** Transforme une erreur Postgres/Supabase en message lisible (les messages métier viennent des fonctions SQL). */
function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

/** Les e-mails sont envoyés par une fonction serveur ; une panne de messagerie ne doit jamais bloquer le site. */
function notify(body: Record<string, unknown>) {
  void db()
    .functions.invoke('send-email', { body })
    .catch(() => undefined)
}

/** Appelle la fonction serveur « admin-team » (création de comptes : réservé au serveur, jamais au navigateur). */
async function teamCall<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().functions.invoke('admin-team', { body: { action, ...payload } })
  if (error) {
    let message = ''
    try {
      const body = (await (error as { context?: Response }).context?.json()) as { error?: string } | undefined
      message = body?.error ?? ''
    } catch {
      /* réponse sans détail */
    }
    throw new Error(message || "Le service de gestion de l'équipe est indisponible pour le moment.")
  }
  return data as T
}

type RoomRow = Omit<Room, 'photos'> & { room_photos: RoomPhoto[] | null }

const toRoom = (row: RoomRow): Room => {
  const { room_photos, ...room } = row
  return { ...room, photos: [...(room_photos ?? [])].sort((a, b) => a.position - b.position) }
}

async function upload(path: string, image: Blob): Promise<string> {
  const { error } = await db().storage.from('hotel-media').upload(path, image, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  fail(error)
  return db().storage.from('hotel-media').getPublicUrl(path).data.publicUrl
}

function storagePathFromUrl(url: string): string | null {
  const marker = '/hotel-media/'
  const i = url.indexOf(marker)
  return i >= 0 ? url.slice(i + marker.length) : null
}

export const supabaseApi: Api = {
  mode: 'supabase',

  async getSettings() {
    const { data, error } = await db().from('hotel_settings').select('*').eq('id', 1).single()
    fail(error)
    return data as HotelSettings
  },
  async saveSettings(settings) {
    const { error } = await db().from('hotel_settings').update(settings).eq('id', 1)
    fail(error)
  },

  async listCategories() {
    const { data, error } = await db().from('room_categories').select('*').order('name')
    fail(error)
    return (data ?? []) as RoomCategory[]
  },
  async saveCategory(cat) {
    const { error } = cat.id
      ? await db().from('room_categories').update({ name: cat.name }).eq('id', cat.id)
      : await db().from('room_categories').insert({ name: cat.name })
    fail(error)
  },
  async deleteCategory(id) {
    const { error } = await db().from('room_categories').delete().eq('id', id)
    fail(error)
  },

  async listRooms(includeInactive = false) {
    let q = db().from('rooms').select('*, room_photos(*)').order('price_per_night')
    if (!includeInactive) q = q.eq('is_active', true)
    const { data, error } = await q
    fail(error)
    return ((data ?? []) as RoomRow[]).map(toRoom)
  },
  async getRoom(id) {
    const { data, error } = await db().from('rooms').select('*, room_photos(*)').eq('id', id).maybeSingle()
    fail(error)
    return data ? toRoom(data as RoomRow) : null
  },
  async saveRoom(room) {
    const { id, ...fields } = room
    if (id) {
      const { error } = await db().from('rooms').update(fields).eq('id', id)
      fail(error)
      return id
    }
    const { data, error } = await db().from('rooms').insert(fields).select('id').single()
    fail(error)
    return (data as { id: string }).id
  },
  async deleteRoom(id) {
    const { data: photos } = await db().from('room_photos').select('storage_path').eq('room_id', id)
    const { error } = await db().from('rooms').delete().eq('id', id)
    fail(error)
    const paths = (photos ?? []).map((p: { storage_path: string }) => p.storage_path).filter(Boolean)
    if (paths.length) await db().storage.from('hotel-media').remove(paths)
  },
  async addRoomPhoto(roomId, image) {
    const path = `rooms/${roomId}/${crypto.randomUUID()}.webp`
    const url = await upload(path, image)
    const { count } = await db().from('room_photos').select('id', { count: 'exact', head: true }).eq('room_id', roomId)
    const { data, error } = await db()
      .from('room_photos')
      .insert({ room_id: roomId, url, storage_path: path, position: count ?? 0, is_main: (count ?? 0) === 0 })
      .select('*')
      .single()
    fail(error)
    return data as RoomPhoto
  },
  async deleteRoomPhoto(photo) {
    const { error } = await db().from('room_photos').delete().eq('id', photo.id)
    fail(error)
    const path = storagePathFromUrl(photo.url)
    if (path) await db().storage.from('hotel-media').remove([path])
    const { data } = await db().from('room_photos').select('*').eq('room_id', photo.room_id).order('position')
    const rest = (data ?? []) as RoomPhoto[]
    for (const [i, p] of rest.entries()) {
      if (p.position !== i) await db().from('room_photos').update({ position: i }).eq('id', p.id)
    }
    if (rest.length && !rest.some((p) => p.is_main)) {
      await db().from('room_photos').update({ is_main: true }).eq('id', rest[0].id)
    }
  },
  async setMainPhoto(roomId, photoId) {
    const a = await db().from('room_photos').update({ is_main: false }).eq('room_id', roomId)
    fail(a.error)
    const b = await db().from('room_photos').update({ is_main: true }).eq('id', photoId)
    fail(b.error)
  },
  async movePhoto(roomId, photoId, direction) {
    const { data, error } = await db().from('room_photos').select('*').eq('room_id', roomId).order('position')
    fail(error)
    const list = (data ?? []) as RoomPhoto[]
    const i = list.findIndex((p) => p.id === photoId)
    const j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    await db().from('room_photos').update({ position: list[j].position }).eq('id', list[i].id)
    await db().from('room_photos').update({ position: list[i].position }).eq('id', list[j].id)
  },
  async availableRoomIds(checkIn, checkOut) {
    const { data, error } = await db().rpc('available_room_ids', { p_in: checkIn, p_out: checkOut })
    fail(error)
    return (data ?? []) as string[]
  },

  async createBooking(req) {
    const { data, error } = await db().rpc('create_booking', { p: req })
    fail(error)
    const result = data as BookingResult
    notify({ kind: 'booking', reference: result.booking.reference, email: result.booking.guest_email })
    return result
  },
  async lookupBooking(reference, email) {
    const { data, error } = await db().rpc('lookup_booking', { p_reference: reference, p_email: email })
    fail(error)
    return (data as BookingResult | null) ?? null
  },
  async listBookings() {
    const { data, error } = await db().from('bookings').select('*').order('created_at', { ascending: false })
    fail(error)
    return (data ?? []) as Booking[]
  },
  async updateBookingStatus(id, status) {
    const { error } = await db().from('bookings').update({ status }).eq('id', id)
    fail(error)
  },

  async listMenuCategories() {
    const { data, error } = await db().from('menu_categories').select('*').order('position')
    fail(error)
    return (data ?? []) as MenuCategory[]
  },
  async saveMenuCategory(cat) {
    if (cat.id) {
      const { error } = await db().from('menu_categories').update({ name: cat.name }).eq('id', cat.id)
      fail(error)
    } else {
      const { count } = await db().from('menu_categories').select('id', { count: 'exact', head: true })
      const { error } = await db().from('menu_categories').insert({ name: cat.name, position: (count ?? 0) + 1 })
      fail(error)
    }
  },
  async deleteMenuCategory(id) {
    const { error } = await db().from('menu_categories').delete().eq('id', id)
    fail(error)
  },
  async listMenuItems(includeUnavailable = false) {
    let q = db().from('menu_items').select('*').order('name')
    if (!includeUnavailable) q = q.eq('is_available', true)
    const { data, error } = await q
    fail(error)
    return (data ?? []) as MenuItem[]
  },
  async saveMenuItem(item) {
    const { id, ...fields } = item
    const { error } = id ? await db().from('menu_items').update(fields).eq('id', id) : await db().from('menu_items').insert(fields)
    fail(error)
  },
  async deleteMenuItem(id) {
    const { error } = await db().from('menu_items').delete().eq('id', id)
    fail(error)
  },
  async uploadMenuPhoto(image) {
    return upload(`menu/${crypto.randomUUID()}.webp`, image)
  },
  async createOrder(req) {
    const { data, error } = await db().rpc('create_order', { p: req })
    fail(error)
    const result = data as OrderResult
    notify({ kind: 'order', reference: result.order.reference })
    return result
  },
  async listOrders() {
    const { data, error } = await db().from('orders').select('*').order('created_at', { ascending: false })
    fail(error)
    return (data ?? []) as Order[]
  },
  async updateOrderStatus(id, status) {
    const { error } = await db().from('orders').update({ status }).eq('id', id)
    fail(error)
  },

  async listServices(includeInactive = false) {
    let q = db().from('services').select('*').order('name')
    if (!includeInactive) q = q.eq('is_active', true)
    const { data, error } = await q
    fail(error)
    return (data ?? []) as Service[]
  },
  async saveService(service) {
    const { id, ...fields } = service
    const { error } = id ? await db().from('services').update(fields).eq('id', id) : await db().from('services').insert(fields)
    fail(error)
  },
  async deleteService(id) {
    const { error } = await db().from('services').delete().eq('id', id)
    fail(error)
  },

  async listInvoices() {
    const { data, error } = await db().from('invoices').select('*').order('number', { ascending: false })
    fail(error)
    return (data ?? []) as Invoice[]
  },
  async recordManualPayment(invoiceId, amount, method, proofReference) {
    const { error } = await db().rpc('record_manual_payment', {
      p_invoice: invoiceId,
      p_amount: amount,
      p_method: method,
      p_proof: proofReference,
    })
    fail(error)
  },
  async startOnlinePayment(invoiceId, customerEmail) {
    const { data, error } = await db().functions.invoke('fedapay-create', {
      body: { invoice_id: invoiceId, email: customerEmail },
    })
    const url = (data as { url?: string } | null)?.url
    if (error || !url) {
      return {
        state: 'unconfigured',
        message:
          "Le paiement en ligne n'est pas disponible pour le moment (prestataire non configuré). Vous pouvez régler à l'hôtel ou contacter la réception.",
      }
    }
    return { state: 'redirect', url }
  },

  async sendContact(msg) {
    const id = crypto.randomUUID()
    const { error } = await db().from('contact_messages').insert({ id, ...msg })
    fail(error)
    notify({ kind: 'contact', message_id: id })
  },
  async listMessages() {
    const { data, error } = await db().from('contact_messages').select('*').order('created_at', { ascending: false })
    fail(error)
    return (data ?? []) as ContactMessage[]
  },

  async stats() {
    const { data, error } = await db().rpc('dashboard_stats')
    fail(error)
    return data as DashboardStats
  },

  async signIn(email, password) {
    const { error } = await db().auth.signInWithPassword({ email, password })
    if (error) throw new Error('Identifiants incorrects.')
  },
  async signOut() {
    await db().auth.signOut()
  },
  async isOwner() {
    const { data } = await db().auth.getSession()
    const uid = data.session?.user.id
    if (!uid) return false
    const { data: row } = await db().from('admin_users').select('user_id').eq('user_id', uid).maybeSingle()
    return Boolean(row)
  },
  async changePassword(newPassword) {
    const { error } = await db().auth.updateUser({ password: newPassword })
    if (error) throw new Error('Le mot de passe n\'a pas pu être modifié. Reconnectez-vous puis réessayez.')
  },

  async needsSetup() {
    try {
      return (await teamCall<{ needs_setup: boolean }>('status')).needs_setup
    } catch {
      return false
    }
  },
  async setupOwner(email, password, code) {
    await teamCall('setup', { email, password, code })
  },
  async listTeam() {
    return (await teamCall<{ members: TeamMember[] }>('list')).members
  },
  async addTeamMember(email, password) {
    await teamCall('add', { email, password })
  },
  async removeTeamMember(userId) {
    await teamCall('remove', { user_id: userId })
  },
}
