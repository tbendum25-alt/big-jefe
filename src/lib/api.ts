import type {
  Booking,
  BookingRequest,
  BookingResult,
  BookingStatus,
  ContactMessage,
  DashboardStats,
  HotelSettings,
  Invoice,
  MenuCategory,
  MenuItem,
  Order,
  OrderRequest,
  OrderResult,
  OrderStatus,
  Room,
  RoomCategory,
  RoomPhoto,
  Service,
  TeamMember,
} from './types'

export type OnlinePaymentResult =
  | { state: 'redirect'; url: string }
  | { state: 'unconfigured'; message: string }

/** Contrat unique de la couche de données : implémenté par Supabase (production) et par un mode démo local. */
export interface Api {
  mode: 'demo' | 'supabase'

  // Paramètres
  getSettings(): Promise<HotelSettings>
  saveSettings(settings: HotelSettings): Promise<void>

  // Chambres
  listCategories(): Promise<RoomCategory[]>
  saveCategory(cat: Partial<RoomCategory> & { name: string }): Promise<void>
  deleteCategory(id: string): Promise<void>
  listRooms(includeInactive?: boolean): Promise<Room[]>
  getRoom(id: string): Promise<Room | null>
  saveRoom(room: Omit<Room, 'photos' | 'id'> & { id?: string }): Promise<string>
  deleteRoom(id: string): Promise<void>
  addRoomPhoto(roomId: string, image: Blob): Promise<RoomPhoto>
  deleteRoomPhoto(photo: RoomPhoto): Promise<void>
  setMainPhoto(roomId: string, photoId: string): Promise<void>
  movePhoto(roomId: string, photoId: string, direction: -1 | 1): Promise<void>
  availableRoomIds(checkIn: string, checkOut: string): Promise<string[]>

  // Réservations
  createBooking(req: BookingRequest): Promise<BookingResult>
  lookupBooking(reference: string, email: string): Promise<BookingResult | null>
  listBookings(): Promise<Booking[]>
  updateBookingStatus(id: string, status: BookingStatus): Promise<void>

  // Restaurant
  listMenuCategories(): Promise<MenuCategory[]>
  saveMenuCategory(cat: Partial<MenuCategory> & { name: string }): Promise<void>
  deleteMenuCategory(id: string): Promise<void>
  listMenuItems(includeUnavailable?: boolean): Promise<MenuItem[]>
  saveMenuItem(item: Omit<MenuItem, 'id'> & { id?: string }): Promise<void>
  deleteMenuItem(id: string): Promise<void>
  uploadMenuPhoto(image: Blob): Promise<string>
  createOrder(req: OrderRequest): Promise<OrderResult>
  listOrders(): Promise<Order[]>
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>

  // Services
  listServices(includeInactive?: boolean): Promise<Service[]>
  saveService(service: Omit<Service, 'id'> & { id?: string }): Promise<void>
  deleteService(id: string): Promise<void>

  // Factures et paiements
  listInvoices(): Promise<Invoice[]>
  recordManualPayment(invoiceId: string, amount: number, method: string, proofReference: string): Promise<void>
  startOnlinePayment(invoiceId: string, customerEmail: string): Promise<OnlinePaymentResult>

  // Contact
  sendContact(msg: Omit<ContactMessage, 'id' | 'created_at'>): Promise<void>
  listMessages(): Promise<ContactMessage[]>

  // Tableau de bord
  stats(): Promise<DashboardStats>

  // Authentification du propriétaire
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  isOwner(): Promise<boolean>
  changePassword(newPassword: string): Promise<void>

  // Équipe : un propriétaire unique, des employés ajoutés par lui
  /** Vrai tant qu'aucun propriétaire n'existe et que la configuration initiale est ouverte. */
  needsSetup(): Promise<boolean>
  /** Crée le compte propriétaire (une seule fois, protégé par le code de configuration). */
  setupOwner(email: string, password: string, code: string): Promise<void>
  listTeam(): Promise<TeamMember[]>
  addTeamMember(email: string, password: string): Promise<void>
  removeTeamMember(userId: string): Promise<void>
}
