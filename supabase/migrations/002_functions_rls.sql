-- BIG JEFE — fonctions serveur, règles d'accès (RLS) et stockage des photos.

-- ---------------------------------------------------------------------------
-- Numérotation des factures : FAC-AAAA-0001, sans trou ni doublon
-- ---------------------------------------------------------------------------
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  insert into invoice_counters (year, last) values (y, 1)
  on conflict (year) do update set last = invoice_counters.last + 1
  returning last into n;
  return 'FAC-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;
revoke all on function public.next_invoice_number() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Disponibilités
-- ---------------------------------------------------------------------------
create or replace function public.available_room_ids(p_in date, p_out date)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from rooms r
  where r.is_active
    and not exists (
      select 1 from bookings b
      where b.room_id = r.id
        and b.status in ('pending', 'confirmed')
        and daterange(b.check_in, b.check_out, '[)') && daterange(p_in, p_out, '[)')
    );
$$;
grant execute on function public.available_room_ids(date, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Création d'une réservation : les prix sont relus en base, jamais pris du navigateur.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s hotel_settings;
  r rooms;
  b bookings;
  inv invoices;
  v_in date := (p ->> 'check_in')::date;
  v_out date := (p ->> 'check_out')::date;
  v_guests int := coalesce((p ->> 'guests')::int, 0);
  v_method text := p ->> 'payment_method';
  v_name text := trim(coalesce(p ->> 'guest_name', ''));
  v_email text := trim(coalesce(p ->> 'guest_email', ''));
  v_phone text := trim(coalesce(p ->> 'guest_phone', ''));
  v_nights int;
  v_sub int;
  v_tax int;
  v_total int;
  v_ref text;
begin
  select * into s from hotel_settings where id = 1;
  select * into r from rooms where id = (p ->> 'room_id')::uuid and is_active;
  if not found then
    raise exception 'Cette chambre n''est plus disponible à la réservation.';
  end if;
  if v_in is null or v_out is null or v_in < current_date then
    raise exception 'Dates de séjour invalides.';
  end if;
  v_nights := v_out - v_in;
  if v_nights < 1 or v_nights > 60 then
    raise exception 'Le séjour doit durer entre 1 et 60 nuits.';
  end if;
  if v_guests < 1 or v_guests > r.capacity then
    raise exception 'Cette chambre accueille % personne(s) au maximum.', r.capacity;
  end if;
  if length(v_name) < 2 or position('@' in v_email) < 2 or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then
    raise exception 'Renseignez votre nom, un e-mail valide et un numéro de téléphone.';
  end if;
  if v_method = 'on_site' and not s.pay_on_site_enabled then
    raise exception 'Le paiement à l''hôtel n''est pas proposé.';
  elsif v_method = 'online' and not s.pay_online_enabled then
    raise exception 'Le paiement en ligne n''est pas encore activé.';
  elsif v_method not in ('online', 'on_site') then
    raise exception 'Mode de paiement invalide.';
  end if;

  v_sub := v_nights * r.price_per_night;
  v_tax := round(v_sub * s.tax_rate / 100);
  v_total := v_sub + v_tax;
  v_ref := 'BJ-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  begin
    insert into bookings (reference, room_id, guest_name, guest_email, guest_phone, check_in, check_out, guests,
                          unit_price, subtotal, tax, total, payment_method, notes)
    values (v_ref, r.id, v_name, v_email, v_phone, v_in, v_out, v_guests,
            r.price_per_night, v_sub, v_tax, v_total, v_method, left(coalesce(p ->> 'notes', ''), 1000))
    returning * into b;
  exception when exclusion_violation then
    raise exception 'Cette chambre vient d''être réservée sur ces dates.';
  end;

  insert into invoices (number, kind, source_reference, customer_name, customer_email, customer_phone,
                        lines, subtotal, tax_rate, tax, total, balance, payment_method, hotel)
  values (next_invoice_number(), 'booking', v_ref, v_name, v_email, v_phone,
          jsonb_build_array(jsonb_build_object(
            'label', r.name || ' — ' || v_nights || ' nuit' || case when v_nights > 1 then 's' else '' end,
            'quantity', v_nights, 'unit_price', r.price_per_night, 'total', v_sub)),
          v_sub, s.tax_rate, v_tax, v_total, v_total, v_method,
          jsonb_build_object('name', s.name, 'address', s.address, 'city', s.city, 'phone', s.phone,
                             'email', s.email, 'invoice_footer', s.invoice_footer, 'currency', s.currency))
  returning * into inv;

  return jsonb_build_object('booking', to_jsonb(b), 'invoice', to_jsonb(inv));
end;
$$;
grant execute on function public.create_booking(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Création d'une commande de restaurant
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s hotel_settings;
  o orders;
  inv invoices;
  line jsonb;
  dish menu_items;
  v_qty int;
  v_items jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_sub int := 0;
  v_tax int;
  v_total int;
  v_ref text;
  v_name text := trim(coalesce(p ->> 'guest_name', ''));
  v_phone text := trim(coalesce(p ->> 'guest_phone', ''));
  v_mode text := p ->> 'mode';
  v_room text := trim(coalesce(p ->> 'room_number', ''));
  v_method text := p ->> 'payment_method';
begin
  select * into s from hotel_settings where id = 1;
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'Votre panier est vide.';
  end if;
  if length(v_name) < 2 or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then
    raise exception 'Renseignez votre nom et un numéro de téléphone.';
  end if;
  if v_mode not in ('dine_in', 'room_service', 'takeaway') then
    raise exception 'Mode de service invalide.';
  end if;
  if v_mode = 'room_service' and v_room = '' then
    raise exception 'Indiquez votre numéro de chambre.';
  end if;
  if v_method = 'on_site' and not s.pay_on_site_enabled then
    raise exception 'Le paiement à l''hôtel n''est pas proposé.';
  elsif v_method = 'online' and not s.pay_online_enabled then
    raise exception 'Le paiement en ligne n''est pas encore activé.';
  elsif v_method not in ('online', 'on_site') then
    raise exception 'Mode de paiement invalide.';
  end if;

  for line in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (line ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then
      raise exception 'Quantité invalide.';
    end if;
    select * into dish from menu_items where id = (line ->> 'item_id')::uuid and is_available;
    if not found then
      raise exception 'Un plat de votre panier n''est plus disponible.';
    end if;
    v_items := v_items || jsonb_build_object('item_id', dish.id, 'name', dish.name, 'unit_price', dish.price, 'quantity', v_qty);
    v_lines := v_lines || jsonb_build_object('label', dish.name, 'quantity', v_qty, 'unit_price', dish.price, 'total', dish.price * v_qty);
    v_sub := v_sub + dish.price * v_qty;
  end loop;

  v_tax := round(v_sub * s.tax_rate / 100);
  v_total := v_sub + v_tax;
  v_ref := 'CMD-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into orders (reference, guest_name, guest_phone, room_number, mode, items, subtotal, tax, total, payment_method)
  values (v_ref, v_name, v_phone, v_room, v_mode, v_items, v_sub, v_tax, v_total, v_method)
  returning * into o;

  insert into invoices (number, kind, source_reference, customer_name, customer_phone,
                        lines, subtotal, tax_rate, tax, total, balance, payment_method, hotel)
  values (next_invoice_number(), 'order', v_ref, v_name, v_phone, v_lines, v_sub, s.tax_rate, v_tax, v_total, v_total, v_method,
          jsonb_build_object('name', s.name, 'address', s.address, 'city', s.city, 'phone', s.phone,
                             'email', s.email, 'invoice_footer', s.invoice_footer, 'currency', s.currency))
  returning * into inv;

  return jsonb_build_object('order', to_jsonb(o), 'invoice', to_jsonb(inv));
end;
$$;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consultation d'une réservation par le client (référence + e-mail)
-- ---------------------------------------------------------------------------
create or replace function public.lookup_booking(p_reference text, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b bookings;
  inv invoices;
begin
  select * into b from bookings
  where lower(reference) = lower(trim(p_reference)) and lower(guest_email) = lower(trim(p_email));
  if not found then
    return null;
  end if;
  select * into inv from invoices where source_reference = b.reference;
  return jsonb_build_object('booking', to_jsonb(b), 'invoice', to_jsonb(inv));
end;
$$;
grant execute on function public.lookup_booking(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Paiements : l'état d'une facture dérive uniquement des paiements réellement confirmés.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total int;
  v_ref text;
  v_paid int;
  v_pending boolean;
  v_refunded boolean;
  v_status text;
begin
  select total, source_reference into v_total, v_ref from invoices where id = inv_id;
  select coalesce(sum(amount) filter (where status = 'succeeded'), 0),
         coalesce(bool_or(status = 'pending'), false),
         coalesce(bool_or(status = 'refunded'), false)
    into v_paid, v_pending, v_refunded
  from payments where invoice_id = inv_id;
  v_status := case
    when v_paid >= v_total and v_total > 0 then 'paid'
    when v_paid > 0 then 'partial'
    when v_refunded then 'refunded'
    when v_pending then 'pending'
    else 'unpaid' end;
  update invoices set paid = v_paid, balance = greatest(v_total - v_paid, 0), payment_status = v_status where id = inv_id;
  update bookings set payment_status = v_status where reference = v_ref;
  update orders set payment_status = v_status where reference = v_ref;
  return null;
end;
$$;

create trigger payments_refresh_invoice
after insert or update or delete on public.payments
for each row execute function public.refresh_invoice();

-- Enregistrement d'un paiement manuel (espèces, Mobile Money reçu, etc.) : propriétaire + preuve obligatoires.
create or replace function public.record_manual_payment(p_invoice uuid, p_amount int, p_method text, p_proof text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if not public.is_owner() then
    raise exception 'Accès réservé au propriétaire.';
  end if;
  if length(trim(coalesce(p_proof, ''))) = 0 then
    raise exception 'Indiquez la référence de preuve du paiement (reçu, référence Mobile Money…).';
  end if;
  select balance into v_balance from invoices where id = p_invoice for update;
  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if p_amount < 1 or p_amount > v_balance then
    raise exception 'Le montant doit être compris entre 1 et %.', v_balance;
  end if;
  insert into payments (invoice_id, amount, method, provider, proof_reference, status, recorded_by)
  values (p_invoice, p_amount, p_method, 'manual', trim(p_proof), 'succeeded', auth.uid());
end;
$$;
grant execute on function public.record_manual_payment(uuid, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tableau de bord (propriétaire)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_owner() then
    raise exception 'Accès réservé au propriétaire.';
  end if;
  select jsonb_build_object(
    'bookings_total', (select count(*) from bookings),
    'arrivals_today', (select count(*) from bookings where check_in = current_date and status in ('pending', 'confirmed')),
    'departures_today', (select count(*) from bookings where check_out = current_date and status in ('pending', 'confirmed')),
    'rooms_total', (select count(*) from rooms where is_active),
    'rooms_occupied', (select count(distinct room_id) from bookings
                       where status in ('pending', 'confirmed') and check_in <= current_date and current_date < check_out),
    'orders_total', (select count(*) from orders),
    'revenue_confirmed', (select coalesce(sum(amount), 0) from payments where status = 'succeeded'),
    'revenue_pending', (select coalesce(sum(balance), 0) from invoices),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'label', label) order by at desc), '[]'::jsonb)
               from (
                 select created_at as at, 'Réservation ' || reference || ' — ' || guest_name as label from bookings
                 union all
                 select created_at, 'Commande ' || reference || ' — ' || guest_name from orders
                 order by at desc limit 15
               ) t)
  ) into v;
  return v;
end;
$$;
grant execute on function public.dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Règles d'accès (Row Level Security)
-- ---------------------------------------------------------------------------
alter table public.hotel_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.room_categories enable row level security;
alter table public.rooms enable row level security;
alter table public.room_photos enable row level security;
alter table public.bookings enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.services enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.contact_messages enable row level security;

-- Lecture publique du catalogue
create policy "settings lisibles" on public.hotel_settings for select using (true);
create policy "categories lisibles" on public.room_categories for select using (true);
create policy "chambres actives lisibles" on public.rooms for select using (is_active or public.is_owner());
create policy "photos lisibles" on public.room_photos for select using (true);
create policy "menu categories lisibles" on public.menu_categories for select using (true);
create policy "plats disponibles lisibles" on public.menu_items for select using (is_available or public.is_owner());
create policy "services actifs lisibles" on public.services for select using (is_active or public.is_owner());

-- Écriture : propriétaire uniquement
create policy "settings proprietaire" on public.hotel_settings for update using (public.is_owner()) with check (public.is_owner());
create policy "categories proprietaire" on public.room_categories for all using (public.is_owner()) with check (public.is_owner());
create policy "chambres proprietaire" on public.rooms for all using (public.is_owner()) with check (public.is_owner());
create policy "photos proprietaire" on public.room_photos for all using (public.is_owner()) with check (public.is_owner());
create policy "menu categories proprietaire" on public.menu_categories for all using (public.is_owner()) with check (public.is_owner());
create policy "plats proprietaire" on public.menu_items for all using (public.is_owner()) with check (public.is_owner());
create policy "services proprietaire" on public.services for all using (public.is_owner()) with check (public.is_owner());

-- Données clients : lecture propriétaire seulement, aucune insertion directe (passage par les fonctions ci-dessus)
create policy "reservations proprietaire lecture" on public.bookings for select using (public.is_owner());
create policy "reservations proprietaire maj" on public.bookings for update using (public.is_owner()) with check (public.is_owner());
create policy "commandes proprietaire lecture" on public.orders for select using (public.is_owner());
create policy "commandes proprietaire maj" on public.orders for update using (public.is_owner()) with check (public.is_owner());
create policy "factures proprietaire lecture" on public.invoices for select using (public.is_owner());
create policy "paiements proprietaire lecture" on public.payments for select using (public.is_owner());
create policy "admin_users lecture de soi" on public.admin_users for select using (user_id = auth.uid());

-- Contact : tout le monde peut écrire un message (champs bornés par les contraintes), seul le propriétaire lit
create policy "contact insertion" on public.contact_messages for insert with check (true);
create policy "contact lecture proprietaire" on public.contact_messages for select using (public.is_owner());

-- Le propriétaire ne peut modifier que le statut / les notes : jamais les montants ni l'état de paiement.
revoke update on public.bookings from anon, authenticated;
grant update (status, notes) on public.bookings to authenticated;
revoke update on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;
revoke insert, update, delete on public.invoices from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke all on public.invoice_counters from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stockage des photos (public en lecture, écriture réservée au propriétaire)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hotel-media', 'hotel-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "photos publiques" on storage.objects for select using (bucket_id = 'hotel-media');
create policy "photos ajout proprietaire" on storage.objects for insert with check (bucket_id = 'hotel-media' and public.is_owner());
create policy "photos maj proprietaire" on storage.objects for update using (bucket_id = 'hotel-media' and public.is_owner());
create policy "photos suppression proprietaire" on storage.objects for delete using (bucket_id = 'hotel-media' and public.is_owner());
