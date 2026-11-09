# Host da Lontano

Sito statico di https://hostdalontano.com, pubblicato con **GitHub Pages** dal ramo `main` (dominio nel file `CNAME`).
Nessuna build: GitHub Pages pubblica i file così come sono.

- Pagine pubbliche: `index.html`, `impressum.html`, `privacy.html`, `404.html`, `robots.txt`, `sitemap.xml`.
- Gestionale privato: `strumenti/accesso.html` e `strumenti/gestionale-app.js` (login e dati su Supabase, protetti dalle regole RLS del database).
  - Pulsante **Copia di sicurezza**: scarica tutti i dati in un file JSON. Il piano gratuito di Supabase non offre backup ripristinabili: scaricarla almeno una volta al mese e conservarla in privato.
  - Le pagine del gestionale e della guida non funzionano se inserite dentro un altro sito (protezione contro il clickjacking).
- Guida ospiti: `strumenti/guida.html` + `strumenti/guida.js` (nessuno script inline, CSP senza `unsafe-inline`).
- Guida per gli ospiti: `strumenti/guida.html` (legge solo le guide pubblicate, tramite link revocabile).
- Funzione server per Claude: `supabase/functions/hdl-claude-assistant/` (spenta finché non viene autorizzata). Dopo ogni modifica va ridistribuita: `supabase functions deploy hdl-claude-assistant --no-verify-jwt`.
- Radar collegato ai calendari Airbnb e Booking (iCal, sola lettura): funzione `supabase/functions/hdl-ical-sync/` (da pubblicare con verify JWT disattivato, come l'altra) e colonne create da `supabase/proposte/radar-calendari-ical.sql`. Finché il file SQL non è eseguito, il gestionale nasconde i campi dei calendari. L'aggiornamento sostituisce le date dei 28 giorni con quelle dei portali; va poi salvato.
- Siti su misura: sezione del gestionale (tabella `hdl_site_projects`) e domanda «Cosa ti interessa» nel modulo (colonna `hdl_leads.interest`). SQL: `supabase/proposte/siti-su-misura.sql`, da eseguire PRIMA di pubblicare il codice che li usa.
- Controllo sicurezza del database: `supabase/verifica-sicurezza.sql` (solo lettura, da eseguire nel SQL Editor di Supabase).
- Proposta (spenta): salvare le richieste del modulo nel gestionale. Istruzioni e SQL in `supabase/proposte/salva-richieste-sito.sql`; si attiva con `SAVE_LEADS = true` in `index.html`.

Il repository è pubblico: non inserire mai chiavi segrete, password o dati di clienti nei file.

Quando modifichi `strumenti/gestionale-app.js`, aumenta il numero `?v=` in `strumenti/accesso.html` per evitare che i browser usino la versione vecchia.
