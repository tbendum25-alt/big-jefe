-- Équipe de l'administration : un propriétaire unique + des employés ajoutés par lui (fonction « admin-team »).
-- Peut être rejouée sans danger.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_users' and column_name = 'role'
  ) then
    alter table public.admin_users
      add column role text not null default 'staff' check (role in ('owner', 'staff'));
    -- Comptes déjà présents avant cette migration : le premier devient le propriétaire, les autres des employés.
    update public.admin_users set role = 'owner'
      where user_id = (select user_id from public.admin_users order by user_id limit 1);
  end if;
end $$;

alter table public.admin_users add column if not exists created_at timestamptz not null default now();

-- Un seul propriétaire à la fois (empêche aussi deux « premières configurations » simultanées).
create unique index if not exists admin_users_single_owner on public.admin_users ((role)) where role = 'owner';
