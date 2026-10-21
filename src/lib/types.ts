export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type PaymentStatus = 'unpaid' | 'pending' | 'partial' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'online' | 'on_site'
export type OrderStatus = 'new' | 'preparing' | 'served' | 'cancelled'
export type OrderMode = 'dine_in' | 'room_service' | 'takeaway'

export interface HotelSettings {
  name: string
  tagline: string
  phone: string
  /** Numéro WhatsApp au format international sans « + » (ex. 22901XXXXXXXX). Vide tant qu'il n'est pas confirmé. */
  whatsapp: string
  email: string
  address: string
  city: string
  /** Taxe de séjour / TVA en pourcentage appliquée aux chambres et repas. */
  tax_rate: number
  currency: string
  pay_online_enabled: boolean
  pay_on_site_enabled: boolean
  restaurant_hours: string
  reception_hours: string
  invoice_footer: string
  cancellation_policy: string
  logo_url: string
}

export interface RoomCategory {
  id: string
  name: string
}

export interface RoomPhoto {
  id: string
  room_id: string
  url: string
  position: number
  is_main: boolean
}

export interface Room {
  id: string
  category_id: string
  name: string
  description: string
  capacity: number
  beds: number
  amenities: string[]
  price_per_night: number
  is_active: boolean
  photos: RoomPhoto[]
}

export interface Booking {
  id: string
  reference: string
  room_id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  guests: number
  nights: number
  unit_price: number
  subtotal: number
  tax: number
  total: number
  status: BookingStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  notes: string
  created_at: string
}

export interface MenuCategory {
  id: string
  name: string
  position: number
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string
  price: number
  photo_url: string
  is_available: boolean
}

export interface OrderItem {
  item_id: string
  name: string
  unit_price: number
  quantity: number
}

export interface Order {
  id: string
  reference: string
  guest_name: string
  guest_phone: string
  room_number: string
  mode: OrderMode
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  created_at: string
}

export interface Service {
  id: string
  name: string
  description: string
  /** 0 = inclus gratuitement. */
  price: number
  is_active: boolean
  is_billable: boolean
}

export interface InvoiceLine {
  label: string
  quantity: number
  unit_price: number
  total: number
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  method: string
  provider: string
  provider_ref: string
  proof_reference: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  created_at: string
}

/** Facture figée : copie des libellés, prix et coordonnées de l'hôtel au moment de l'émission. */
export interface Invoice {
  id: string
  number: string
  kind: 'booking' | 'order'
  source_reference: string
  customer_name: string
  customer_email: string
  customer_phone: string
  issue_date: string
  lines: InvoiceLine[]
  subtotal: number
  tax_rate: number
  tax: number
  discount: number
  total: number
  paid: number
  balance: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  hotel: Pick<HotelSettings, 'name' | 'address' | 'city' | 'phone' | 'email' | 'invoice_footer' | 'currency'>
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  phone: string
  message: string
  created_at: string
}

export interface BookingRequest {
  room_id: string
  check_in: string
  check_out: string
  guests: number
  guest_name: string
  guest_email: string
  guest_phone: string
  payment_method: PaymentMethod
  notes: string
}

export interface OrderRequest {
  guest_name: string
  guest_phone: string
  room_number: string
  mode: OrderMode
  payment_method: PaymentMethod
  items: { item_id: string; quantity: number }[]
}

export interface BookingResult {
  booking: Booking
  invoice: Invoice
}

export interface OrderResult {
  order: Order
  invoice: Invoice
}

export interface DashboardStats {
  bookings_total: number
  arrivals_today: number
  departures_today: number
  rooms_total: number
  rooms_occupied: number
  orders_total: number
  revenue_confirmed: number
  revenue_pending: number
  recent: { at: string; label: string }[]
}

export type TeamRole = 'owner' | 'staff'

/** Compte autorisé à entrer dans l'administration. Le propriétaire est unique ; les employés sont ajoutés par lui. */
export interface TeamMember {
  user_id: string
  email: string
  role: TeamRole
  created_at: string
  is_self: boolean
}
