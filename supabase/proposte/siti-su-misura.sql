-- Host da Lontano · "Siti su misura" + tipo di richiesta nel modulo del sito
-- AGGIUNGE soltanto: una tabella nuova, una colonna nuova in hdl_leads e una versione
-- aggiornata della funzione del modulo. Non cancella e non modifica dati esistenti.
-- Eseguire una sola volta nel SQL Editor di Supabase.

-- 1. Progetti "Sito su misura" ---------------------------------------------------------
create table if not exists public.hdl_site_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.hdl_clients(id) on delete set null,
  property_id uuid references public.hdl_properties(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  stage text not null default 'richiesta'
    check (stage in ('richiesta', 'materiali', 'costruzione', 'revisione', 'online', 'sospeso')),
  mat_foto boolean not null default false,
  mat_testi boolean not null default false,
  mat_regole boolean not null default false,
  mat_logo boolean not null default false,
  mat_dominio boolean not null default false,
  languages text[] not null default array['it', 'en', 'de']
    check (languages <@ array['it', 'en', 'de']),
  domain text check (domain is null or length(domain) <= 253),
  site_url text check (site_url is null or (length(site_url) <= 1000 and site_url ~* '^https?://')),
  preview_url text check (preview_url is null or (length(preview_url) <= 1000 and preview_url ~* '^https?://')),
  price numeric(10, 2) check (price is null or price >= 0),
  payment_status text not null default 'da_pagare'
    check (payment_status in ('da_pagare', 'acconto', 'pagato')),
  recurring_cost numeric(10, 2) check (recurring_cost is null or recurring_cost >= 0),
  renewal_date date,
  due_date date,
  notes text check (notes is null or length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hdl_site_projects enable row level security;

drop policy if exists "Approved admin manages site projects" on public.hdl_site_projects;
create policy "Approved admin manages site projects" on public.hdl_site_projects
  for all to authenticated
  using (exists (select 1 from public.hdl_admin_accounts a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.hdl_admin_accounts a where a.user_id = (select auth.uid())));

revoke all on public.hdl_site_projects from anon;
grant select, insert, update, delete on public.hdl_site_projects to authenticated;

-- 2. Tipo di richiesta nei contatti ---------------------------------------------------
alter table public.hdl_leads
  add column if not exists interest text not null default 'gestione';
alter table public.hdl_leads drop constraint if exists hdl_leads_interest_check;
alter table public.hdl_leads
  add constraint hdl_leads_interest_check check (interest in ('gestione', 'sito', 'entrambi'));

-- 3. Funzione del modulo con il tipo di richiesta -------------------------------------
-- Sostituisce la versione a 5 parametri con una a 6 (l'ultimo è facoltativo).
drop function if exists public.hdl_submit_lead(text, text, text, text, text);

create or replace function public.hdl_submit_lead(
  p_name text,
  p_location text,
  p_email text default null,
  p_link text default null,
  p_note text default null,
  p_interest text default 'gestione'
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_location text := trim(coalesce(p_location, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_link text := nullif(trim(coalesce(p_link, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_interest text := coalesce(nullif(trim(coalesce(p_interest, '')), ''), 'gestione');
begin
  if length(v_name) < 1 or length(v_name) > 120 then raise exception 'Nome non valido'; end if;
  if length(v_location) < 1 or length(v_location) > 160 then raise exception 'Zona non valida'; end if;
  if v_email is not null and (length(v_email) > 240 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Email non valida';
  end if;
  if v_link is not null and (length(v_link) > 1000 or v_link !~* '^https?://') then raise exception 'Link non valido'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'Nota troppo lunga'; end if;
  if v_interest not in ('gestione', 'sito', 'entrambi') then raise exception 'Tipo di richiesta non valido'; end if;

  -- Limite anti-spam: massimo 20 richieste dal sito per ora, 3 per la stessa email al giorno.
  if (select count(*) from public.hdl_leads where source = 'sito' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Troppe richieste, riprova più tardi';
  end if;
  if v_email is not null and (select count(*) from public.hdl_leads
      where source = 'sito' and lower(email) = lower(v_email) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Richiesta già ricevuta';
  end if;

  insert into public.hdl_leads (full_name, email, location, source, stage, interest, notes)
  values (
    v_name, v_email, v_location, 'sito', 'new', v_interest,
    concat_ws(E'\n', 'Richiesta dal modulo del sito.',
      case when v_link is not null then 'Annuncio: ' || v_link end,
      v_note)
  );
  return true;
end;
$$;

revoke all on function public.hdl_submit_lead(text, text, text, text, text, text) from public;
grant execute on function public.hdl_submit_lead(text, text, text, text, text, text) to anon, authenticated;

-- Controllo finale: deve mostrare la tabella nuova con RLS attivo e la colonna interest.
select 'tabella' as cosa, c.relname as nome, c.relrowsecurity::text as rls_attivo
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'hdl_site_projects'
union all
select 'colonna', table_name || '.' || column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'hdl_leads' and column_name = 'interest';
