-- Host da Lontano · PROPOSTA: salvare le richieste del modulo "Analisi gratuita" nel gestionale
-- Stato: NON ancora applicata. Il sito continua a funzionare solo via email finché
-- in index.html la costante SAVE_LEADS resta false.
--
-- Come attivarla:
--   1. Esegui prima supabase/verifica-sicurezza.sql e controlla che hdl_leads abbia RLS attivo
--      e che il ruolo anon NON possa leggere la tabella.
--   2. Esegui questo file nel SQL Editor di Supabase.
--   3. Aggiorna privacy.html (testo suggerito in fondo a questo file).
--   4. In index.html imposta SAVE_LEADS = true.
--
-- Il visitatore anonimo NON riceve alcun permesso sulla tabella: può solo chiamare questa
-- funzione, che valida i campi, limita il numero di richieste e inserisce una riga "Nuovo".

create or replace function public.hdl_submit_lead(
  p_name text,
  p_location text,
  p_email text default null,
  p_link text default null,
  p_note text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_location text := trim(coalesce(p_location, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_link text := nullif(trim(coalesce(p_link, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if length(v_name) < 1 or length(v_name) > 120 then raise exception 'Nome non valido'; end if;
  if length(v_location) < 1 or length(v_location) > 160 then raise exception 'Zona non valida'; end if;
  if v_email is not null and (length(v_email) > 240 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Email non valida';
  end if;
  if v_link is not null and (length(v_link) > 1000 or v_link !~* '^https?://') then raise exception 'Link non valido'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'Nota troppo lunga'; end if;

  -- Limite anti-spam globale: massimo 20 richieste dal sito per ora, 3 per la stessa email al giorno.
  if (select count(*) from hdl_leads where source = 'sito' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Troppe richieste, riprova più tardi';
  end if;
  if v_email is not null and (select count(*) from hdl_leads
      where source = 'sito' and lower(email) = lower(v_email) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Richiesta già ricevuta';
  end if;

  insert into hdl_leads (full_name, email, location, source, stage, notes)
  values (
    v_name, v_email, v_location, 'sito', 'new',
    concat_ws(E'\n', 'Richiesta dal modulo del sito.',
      case when v_link is not null then 'Annuncio: ' || v_link end,
      v_note)
  );
  return true;
end;
$$;

revoke all on function public.hdl_submit_lead(text, text, text, text, text) from public;
grant execute on function public.hdl_submit_lead(text, text, text, text, text) to anon, authenticated;

-- Per tornare indietro:
--   drop function public.hdl_submit_lead(text, text, text, text, text);

-- Testo suggerito per privacy.html (sezione 3, da sostituire alla frase sul modulo):
-- IT: «Il modulo pubblico salva nome, zona dell'immobile, link dell'annuncio, email facoltativa e note
--      nel gestionale riservato (Supabase, regione UE) per poter rispondere alla richiesta. In alternativa
--      puoi scriverci direttamente via email.»
-- DE: «Das öffentliche Formular speichert Name, Lage der Unterkunft, Inseratslink, optionale E-Mail-Adresse
--      und Anmerkungen im internen Verwaltungsbereich (Supabase, EU-Region), um Ihre Anfrage zu beantworten.
--      Alternativ können Sie uns direkt per E-Mail schreiben.»
