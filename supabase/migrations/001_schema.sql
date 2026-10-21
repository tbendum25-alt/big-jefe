-- BIG JEFE — schéma de base de données (Supabase / PostgreSQL)
-- À exécuter dans l'éditeur SQL de Supabase, dans l'ordre : 001, 002, 003 (optionnel).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Paramètres de l'hôtel (une seule ligne)
-- ---------------------------------------------------------------------------
create table public.hotel_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'BIG JEFE',
  tagline text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  currency text not null default 'XOF',
  pay_online_enabled boolean not null default false,
  pay_on_site_enabled boolean not null default true,
  restaurant_hours text not null default '',
  reception_hours text not null default '',
  invoice_footer text not null default '',
  cancellation_policy text not null default '',
  logo_url text not null default ''
);
insert into public.hotel_settings (id) values (1);

-- Propriétaire(s) autorisé(s) : on ajoute l'identifiant de l'utilisateur Supabase Auth ici (voir README).
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Chambres
-- ---------------------------------------------------------------------------
create table public.room_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.room_categories (id),
  name text not null,
  description text not null default '',
  capacity int not null check (capacity > 0),
  beds int not null default 1 check (beds > 0),
  amenities text[] not null default '{}',
  price_per_night int not null check (price_per_night >= 0),
  is_active boolean not null default true
);

create table public.room_photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  url text not null,
  storage_path text not null default '',
  position int not null default 0,
  is_main boolean not null default false
);
create index on public.room_photos (room_id, position);

-- ---------------------------------------------------------------------------
-- Réservations — la contrainte d'exclusion interdit physiquement les doubles réservations.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  room_id uuid not null references public.rooms (id),
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  check_in date not null,
  check_out date not null,
  guests int not null check (guests > 0),
  nights int generated always as (check_out - check_in) stored,
  unit_price int not null check (unit_price >= 0),
  subtotal int not null,
  tax int not null,
  total int not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'partial', 'paid', 'failed', 'refunded')),
  payment_method text not null check (payment_method in ('online', 'on_site')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint stay_dates check (check_out > check_in),
  constraint no_double_booking exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

-- ---------------------------------------------------------------------------
-- Restaurant
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id),
  name text not null,
  description text not null default '',
  price int not null check (price >= 0),
  photo_url text not null default '',
  is_available boolean not null default true
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  guest_name text not null,
  guest_phone text not null,
  room_number text not null default '',
  mode text not null check (mode in ('dine_in', 'room_service', 'takeaway')),
  items jsonb not null,
  subtotal int not null,
  tax int not null,
  total int not null,
  status text not null default 'new' check (status in ('new', 'preparing', 'served', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'partial', 'paid', 'failed', 'refunded')),
  payment_method text not null check (payment_method in ('online', 'on_site')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price int not null default 0 check (price >= 0),
  is_active boolean not null default true,
  is_billable boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Factures figées et paiements
-- ---------------------------------------------------------------------------
create table public.invoice_counters (
  year int primary key,
  last int not null default 0
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null check (kind in ('booking', 'order')),
  source_reference text not null unique,
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null default '',
  issue_date date not null default current_date,
  lines jsonb not null,            -- copie figée : libellés, quantités, prix unitaires
  subtotal int not null,
  tax_rate numeric(5,2) not null,
  tax int not null,
  discount int not null default 0,
  total int not null,
  paid int not null default 0,
  balance int not null,
  payment_method text not null,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'partial', 'paid', 'failed', 'refunded')),
  hotel jsonb not null             -- copie figée des coordonnées de l'hôtel
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  amount int not null check (amount > 0),
  method text not null,
  provider text not null default 'manual',
  provider_ref text not null default '',
  proof_reference text not null default '',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  -- Un paiement manuel n'est « confirmé » qu'avec une pièce justificative.
  constraint manual_needs_proof check (provider <> 'manual' or status <> 'succeeded' or length(trim(proof_reference)) > 0)
);
create unique index payments_provider_ref on public.payments (provider, provider_ref) where provider_ref <> '';

-- ---------------------------------------------------------------------------
-- Messages de contact
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email text not null check (position('@' in email) > 1 and length(email) <= 200),
  phone text not null default '' check (length(phone) <= 40),
  message text not null check (length(message) between 5 and 4000),
  created_at timestamptz not null default now()
);
