-- Host da Lontano · Concierge completo (guida in IT/EN/DE, mappa, sezioni nuove)
-- AGGIUNGE soltanto: due colonne facoltative in hdl_property_tools e una nuova funzione
-- di lettura per la guida ospiti (hdl_read_guest_guide_v2). La funzione esistente
-- hdl_read_guest_guide NON viene modificata: la nuova la richiama, quindi valgono
-- esattamente le stesse regole (solo link validi e guide attivate).
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.hdl_property_tools
  add column if not exists maps_url text,
  add column if not exists guide_extra jsonb not null default '{}'::jsonb;

alter table public.hdl_property_tools
  drop constraint if exists hdl_property_tools_maps_url_check,
  drop constraint if exists hdl_property_tools_guide_extra_check;

alter table public.hdl_property_tools
  add constraint hdl_property_tools_maps_url_check
    check (maps_url is null or (length(maps_url) <= 1000 and maps_url ~* '^https://')),
  add constraint hdl_property_tools_guide_extra_check
    check (jsonb_typeof(guide_extra) = 'object' and length(guide_extra::text) <= 60000);

-- Nuova lettura pubblica della guida: stessi dati di prima + mappa + testi aggiuntivi.
-- Si adatta al tipo del parametro della funzione esistente (uuid o text).
do $do$
declare
  arg_type text;
begin
  select split_part(pg_get_function_identity_arguments('public.hdl_read_guest_guide'::regproc), ' ', 2)
    into arg_type;
  if arg_type is null or arg_type = '' then
    raise exception 'Funzione hdl_read_guest_guide non trovata: non proseguo.';
  end if;
  execute format($f$
    create or replace function public.hdl_read_guest_guide_v2(guide_token %1$s)
    returns setof jsonb
    language sql
    stable
    security definer
    set search_path = ''
    as $b$
      select to_jsonb(v) || jsonb_build_object(
               'guest_maps_url', x.maps_url,
               'guest_extra', coalesce(x.guide_extra, '{}'::jsonb))
      from public.hdl_read_guest_guide(guide_token) v
      left join lateral (
        select t.maps_url, t.guide_extra
        from public.hdl_guest_shares s
        join public.hdl_property_tools t on t.property_id = s.property_id
        where s.share_token::text = guide_token::text and s.is_published
        limit 1
      ) x on true
    $b$;
  $f$, arg_type);
  execute format('revoke all on function public.hdl_read_guest_guide_v2(%s) from public', arg_type);
  execute format('grant execute on function public.hdl_read_guest_guide_v2(%s) to anon, authenticated', arg_type);
end
$do$;

-- Controllo: devono comparire le due colonne e la funzione nuova.
select 'colonna' as cosa, column_name as nome
from information_schema.columns
where table_schema = 'public' and table_name = 'hdl_property_tools' and column_name in ('maps_url', 'guide_extra')
union all
select 'funzione', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'hdl_read_guest_guide_v2';
