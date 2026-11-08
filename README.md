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
- Controllo sicurezza del database: `supabase/verifica-sicurezza.sql` (solo lettura, da eseguire nel SQL Editor di Supabase).

Il repository è pubblico: non inserire mai chiavi segrete, password o dati di clienti nei file.

Quando modifichi `strumenti/gestionale-app.js`, aumenta il numero `?v=` in `strumenti/accesso.html` per evitare che i browser usino la versione vecchia.
