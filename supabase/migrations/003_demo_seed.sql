-- BIG JEFE — DONNÉES DE DÉMONSTRATION (optionnel).
-- Tarifs, plats, services et descriptions fictifs : à modifier ou supprimer depuis l'administration.

update public.hotel_settings set
  name = 'BIG JEFE',
  tagline = 'L''élégance de l''hospitalité béninoise',
  phone = '0129226464',
  whatsapp = '',  -- à renseigner après confirmation du numéro international
  email = 'tbendum25@gmail.com',
  address = 'Haie Vive, Cotonou (adresse exacte à confirmer)',
  city = 'Cotonou, Bénin',
  restaurant_hours = 'Tous les jours, 7h00 – 22h30',
  reception_hours = 'Réception ouverte 24h/24',
  invoice_footer = 'Merci de votre confiance. Facture établie par BIG JEFE.',
  cancellation_policy = 'Annulation gratuite jusqu''à 48 heures avant l''arrivée. Passé ce délai, la première nuit peut être facturée.'
where id = 1;

insert into public.room_categories (name) values
  ('Chambre standard'), ('Chambre supérieure'), ('Chambre deluxe'), ('Suite');

insert into public.rooms (category_id, name, description, capacity, beds, amenities, price_per_night)
select c.id, v.name, v.description, v.capacity, v.beds, v.amenities, v.price
from (values
  ('Chambre standard', 'Chambre Standard', 'Une chambre calme et confortable, idéale pour un séjour d''affaires ou une escale.', 2, 1, array['Climatisation','Wi-Fi','Télévision','Salle de bain privée'], 35000),
  ('Chambre supérieure', 'Chambre Supérieure', 'Plus d''espace, un coin salon et une literie haut de gamme pour un séjour reposant.', 3, 2, array['Climatisation','Wi-Fi','Télévision','Minibar','Coin salon'], 50000),
  ('Chambre deluxe', 'Chambre Deluxe', 'Une chambre spacieuse aux finitions soignées, pensée pour le confort au quotidien.', 3, 1, array['Climatisation','Wi-Fi','Télévision','Minibar','Baignoire','Balcon'], 75000),
  ('Suite', 'Suite Prestige', 'Notre suite la plus généreuse : chambre séparée, salon privé et service attentionné.', 4, 2, array['Climatisation','Wi-Fi','Salon privé','Minibar','Baignoire','Balcon'], 120000)
) as v(cat, name, description, capacity, beds, amenities, price)
join public.room_categories c on c.name = v.cat;

insert into public.menu_categories (name, position) values
  ('Entrées', 1), ('Plats', 2), ('Desserts', 3), ('Boissons', 4);

insert into public.menu_items (category_id, name, description, price)
select c.id, v.name, v.description, v.price
from (values
  ('Entrées', 'Salade de saison', 'Légumes frais et vinaigrette maison.', 4000),
  ('Entrées', 'Soupe du jour', 'Préparée chaque matin.', 3500),
  ('Plats', 'Poisson grillé', 'Poisson du jour grillé, accompagnement au choix.', 9500),
  ('Plats', 'Poulet braisé', 'Mariné aux épices, servi avec alloco.', 8000),
  ('Desserts', 'Fruits frais', 'Assortiment de fruits de saison.', 3000),
  ('Boissons', 'Eau minérale', 'Bouteille 1,5 L.', 1000),
  ('Boissons', 'Jus de fruit pressé', 'Selon la disponibilité du jour.', 2500)
) as v(cat, name, description, price)
join public.menu_categories c on c.name = v.cat;

insert into public.services (name, description, price, is_billable) values
  ('Wi-Fi', 'Connexion Wi-Fi dans tout l''établissement.', 0, false),
  ('Parking', 'Stationnement sécurisé pour les clients.', 0, false),
  ('Blanchisserie', 'Lavage et repassage de vos vêtements.', 5000, true),
  ('Transfert aéroport', 'Accueil et transport depuis l''aéroport.', 15000, true);
