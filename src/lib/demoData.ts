import type { HotelSettings, MenuCategory, MenuItem, Room, RoomCategory, Service } from './types'

/** Valeurs par défaut — le propriétaire les modifie dans Administration > Paramètres. */
export const defaultSettings: HotelSettings = {
  name: 'BIG JEFE',
  tagline: "L'élégance de l'hospitalité béninoise",
  phone: '0129226464',
  // Laissé vide volontairement : le numéro international doit être confirmé par le propriétaire avant publication.
  whatsapp: '',
  email: 'tbendum25@gmail.com',
  address: 'Haie Vive, Cotonou (adresse exacte à confirmer)',
  city: 'Cotonou, Bénin',
  tax_rate: 0,
  currency: 'XOF',
  pay_online_enabled: false,
  pay_on_site_enabled: true,
  restaurant_hours: 'Tous les jours, 7h00 – 22h30',
  reception_hours: 'Réception ouverte 24h/24',
  invoice_footer: 'Merci de votre confiance. Facture établie par BIG JEFE.',
  cancellation_policy:
    "Annulation gratuite jusqu'à 48 heures avant l'arrivée. Passé ce délai, la première nuit peut être facturée.",
  logo_url: '',
}

export const demoCategories: RoomCategory[] = [
  { id: 'cat-standard', name: 'Chambre standard' },
  { id: 'cat-superieure', name: 'Chambre supérieure' },
  { id: 'cat-deluxe', name: 'Chambre deluxe' },
  { id: 'cat-suite', name: 'Suite' },
]

// DONNÉES DE DÉMONSTRATION : tarifs, descriptions et équipements fictifs, à remplacer par les vrais.
export const demoRooms: Omit<Room, 'photos'>[] = [
  {
    id: 'room-101',
    category_id: 'cat-standard',
    name: 'Chambre Standard',
    description: 'Une chambre calme et confortable, idéale pour un séjour d’affaires ou une escale.',
    capacity: 2,
    beds: 1,
    amenities: ['Climatisation', 'Wi-Fi', 'Télévision', 'Salle de bain privée'],
    price_per_night: 35000,
    is_active: true,
  },
  {
    id: 'room-201',
    category_id: 'cat-superieure',
    name: 'Chambre Supérieure',
    description: 'Plus d’espace, un coin salon et une literie haut de gamme pour un séjour reposant.',
    capacity: 3,
    beds: 2,
    amenities: ['Climatisation', 'Wi-Fi', 'Télévision', 'Minibar', 'Coin salon'],
    price_per_night: 50000,
    is_active: true,
  },
  {
    id: 'room-301',
    category_id: 'cat-deluxe',
    name: 'Chambre Deluxe',
    description: 'Une chambre spacieuse aux finitions soignées, pensée pour le confort au quotidien.',
    capacity: 3,
    beds: 1,
    amenities: ['Climatisation', 'Wi-Fi', 'Télévision', 'Minibar', 'Baignoire', 'Balcon'],
    price_per_night: 75000,
    is_active: true,
  },
  {
    id: 'room-401',
    category_id: 'cat-suite',
    name: 'Suite Prestige',
    description: 'Notre suite la plus généreuse : chambre séparée, salon privé et service attentionné.',
    capacity: 4,
    beds: 2,
    amenities: ['Climatisation', 'Wi-Fi', 'Salon privé', 'Minibar', 'Baignoire', 'Balcon'],
    price_per_night: 120000,
    is_active: true,
  },
]

export const demoMenuCategories: MenuCategory[] = [
  { id: 'mc-entrees', name: 'Entrées', position: 1 },
  { id: 'mc-plats', name: 'Plats', position: 2 },
  { id: 'mc-desserts', name: 'Desserts', position: 3 },
  { id: 'mc-boissons', name: 'Boissons', position: 4 },
]

// DONNÉES DE DÉMONSTRATION : le propriétaire configure le vrai menu depuis l'administration.
export const demoMenuItems: MenuItem[] = [
  { id: 'mi-1', category_id: 'mc-entrees', name: 'Salade de saison', description: 'Légumes frais et vinaigrette maison.', price: 4000, photo_url: '', is_available: true },
  { id: 'mi-2', category_id: 'mc-entrees', name: 'Soupe du jour', description: 'Préparée chaque matin.', price: 3500, photo_url: '', is_available: true },
  { id: 'mi-3', category_id: 'mc-plats', name: 'Poisson grillé', description: 'Poisson du jour grillé, accompagnement au choix.', price: 9500, photo_url: '', is_available: true },
  { id: 'mi-4', category_id: 'mc-plats', name: 'Poulet braisé', description: 'Mariné aux épices, servi avec alloco.', price: 8000, photo_url: '', is_available: true },
  { id: 'mi-5', category_id: 'mc-desserts', name: 'Fruits frais', description: 'Assortiment de fruits de saison.', price: 3000, photo_url: '', is_available: true },
  { id: 'mi-6', category_id: 'mc-boissons', name: 'Eau minérale', description: 'Bouteille 1,5 L.', price: 1000, photo_url: '', is_available: true },
  { id: 'mi-7', category_id: 'mc-boissons', name: 'Jus de fruit pressé', description: 'Selon la disponibilité du jour.', price: 2500, photo_url: '', is_available: true },
]

export const demoServices: Service[] = [
  { id: 'sv-1', name: 'Wi-Fi', description: 'Connexion Wi-Fi dans tout l’établissement.', price: 0, is_active: true, is_billable: false },
  { id: 'sv-2', name: 'Parking', description: 'Stationnement sécurisé pour les clients.', price: 0, is_active: true, is_billable: false },
  { id: 'sv-3', name: 'Blanchisserie', description: 'Lavage et repassage de vos vêtements.', price: 5000, is_active: true, is_billable: true },
  { id: 'sv-4', name: 'Transfert aéroport', description: 'Accueil et transport depuis l’aéroport.', price: 15000, is_active: true, is_billable: true },
]
