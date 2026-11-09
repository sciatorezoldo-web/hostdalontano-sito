-- Host da Lontano · Radar collegato ai calendari Airbnb e Booking (iCal)
-- Aggiunge due colonne facoltative a hdl_property_tools. NON cancella e NON modifica dati esistenti.
-- Le regole di accesso (RLS) della tabella valgono anche per le nuove colonne: solo l'amministratore.
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.hdl_property_tools
  add column if not exists ical_airbnb text,
  add column if not exists ical_booking text;

alter table public.hdl_property_tools
  drop constraint if exists hdl_property_tools_ical_airbnb_check,
  drop constraint if exists hdl_property_tools_ical_booking_check;

alter table public.hdl_property_tools
  add constraint hdl_property_tools_ical_airbnb_check
    check (ical_airbnb is null or (length(ical_airbnb) <= 1000 and ical_airbnb ~ '^https://(www\.)?airbnb\.[a-z.]{2,8}/')),
  add constraint hdl_property_tools_ical_booking_check
    check (ical_booking is null or (length(ical_booking) <= 1000 and ical_booking ~ '^https://([a-z0-9-]+\.)*booking\.com/'));

-- Controllo: devono comparire le due colonne nuove.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'hdl_property_tools' and column_name like 'ical\_%';
