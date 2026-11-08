-- Host da Lontano · Controllo di sicurezza del database (SOLO LETTURA)
-- Da eseguire in Supabase → SQL Editor. Non modifica nulla: legge soltanto la configurazione.
-- Copia i risultati e conservali: servono a documentare lo schema, che oggi non è nel repository.

-- 1. Ogni tabella hdl_* deve avere RLS attivo (rls_attivo = true).
select c.relname as tabella, c.relrowsecurity as rls_attivo, c.relforcerowsecurity as rls_forzato
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'hdl_%'
order by 1;

-- 2. Regole di accesso: ogni regola deve richiedere l'appartenenza a hdl_admin_accounts,
--    non solo il ruolo "authenticated". Attenzione a regole con qual/with_check = 'true'.
select tablename as tabella, policyname as regola, roles as ruoli, cmd as operazione,
       qual as condizione_lettura, with_check as condizione_scrittura
from pg_policies
where schemaname = 'public' and tablename like 'hdl_%'
order by tablename, policyname;

-- 3. Permessi del ruolo anonimo (anon): idealmente nessuna riga, salvo EXECUTE sulla funzione della guida.
select table_name as tabella, privilege_type as permesso
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and table_name like 'hdl_%'
order by 1, 2;

-- 4. Funzioni hdl_*: chi può eseguirle e se girano con i privilegi del proprietario (security definer).
--    Le funzioni security definer devono avere search_path fissato (config non vuota).
select p.proname as funzione, p.prosecdef as security_definer, p.proconfig as config,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puo_eseguire,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as autenticati_possono_eseguire
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'hdl_%'
order by 1;

-- 5. Trigger e vincoli (sovrapposizione compensi, data incasso, calcolo aliquota).
select event_object_table as tabella, trigger_name as trigger, action_timing as quando, event_manipulation as evento
from information_schema.triggers
where event_object_schema = 'public' and event_object_table like 'hdl_%'
order by 1, 2;

-- 6. Amministratori autorizzati (devono essere solo i tuoi account).
select a.user_id, u.email, u.created_at, u.last_sign_in_at
from public.hdl_admin_accounts a left join auth.users u on u.id = a.user_id;

-- 7. Utenti registrati che NON sono amministratori: se ce ne sono e non li conosci,
--    disattiva le registrazioni pubbliche (Authentication → Sign In / Providers → "Allow new users to sign up").
select u.id, u.email, u.created_at
from auth.users u left join public.hdl_admin_accounts a on a.user_id = u.id
where a.user_id is null;

-- Per esportare lo schema completo nel repository (dal tuo computer, con Supabase CLI):
--   supabase link --project-ref kgbkevncksvpfgqsvoqg
--   supabase db pull
-- e poi committa la cartella supabase/migrations/ creata.
