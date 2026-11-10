// Host da Lontano · Email automatiche per le richieste del modulo del sito.
// Chiamata SOLO dal Database Webhook di Supabase (INSERT su hdl_leads), protetta da un
// segreto condiviso. Invia:
//   1. una conferma al proprietario (se ha lasciato l'email);
//   2. un avviso a Giuseppe con i dati della richiesta.
// Segreti richiesti (Supabase > Edge Functions > Secrets): RESEND_API_KEY, LEAD_WEBHOOK_SECRET.
// Pubblicare con "Verify JWT" disattivato.
const FROM = "Giuseppe · Host da Lontano <giuseppe@hostdalontano.com>";
const OWNER = "giuseppe@hostdalontano.com";
const SITE = "https://hostdalontano.com";
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

const INTEREST: Record<string, { label: string; promise: string }> = {
  gestione: { label: "gestione online", promise: "con la prima analisi gratuita del tuo annuncio" },
  sito: { label: "sito per la casa", promise: "con le informazioni sul sito dedicato alla tua casa" },
  entrambi: { label: "gestione online e sito", promise: "con la prima analisi gratuita e le informazioni sul sito dedicato" },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max) : "";
}

async function send(apiKey: string, mail: Record<string, unknown>): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(10000),
  });
  return res.ok;
}

export function confirmationEmail(name: string, location: string, interest: string) {
  const info = INTEREST[interest] || INTEREST.gestione;
  const first = name.split(" ")[0] || name;
  const subject = "Ho ricevuto la tua richiesta · Host da Lontano";
  const text = [
    `Ciao ${first},`,
    "",
    `grazie per avermi scritto. Ho ricevuto la tua richiesta per la casa a ${location} e ti rispondo personalmente entro 24 ore, ${info.promise}.`,
    "",
    "Se vuoi aggiungere qualcosa, come il link del tuo annuncio o qualche foto, rispondi pure a questa email.",
    "",
    "A presto,",
    "Giuseppe",
    "Host da Lontano · " + SITE,
    "",
    "Hai ricevuto questa email perché hai compilato il modulo su hostdalontano.com. Se non sei stato tu, ignorala: non riceverai altri messaggi.",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#15271e;max-width:560px">
<p>Ciao ${esc(first)},</p>
<p>grazie per avermi scritto. Ho ricevuto la tua richiesta per la casa a <strong>${esc(location)}</strong> e ti rispondo personalmente <strong>entro 24 ore</strong>, ${esc(info.promise)}.</p>
<p>Se vuoi aggiungere qualcosa, come il link del tuo annuncio o qualche foto, rispondi pure a questa email.</p>
<p>A presto,<br>Giuseppe<br><a href="${SITE}" style="color:#2c6650">Host da Lontano</a></p>
<p style="font-size:12px;color:#64746a;border-top:1px solid #dce5de;padding-top:10px;margin-top:22px">Hai ricevuto questa email perché hai compilato il modulo su hostdalontano.com. Se non sei stato tu, ignorala: non riceverai altri messaggi. <a href="${SITE}/privacy.html" style="color:#64746a">Privacy</a></p>
</div>`;
  return { subject, text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("LEAD_WEBHOOK_SECRET") || "";
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!secret || !apiKey) return json({ error: "not configured" }, 503);
  if (!sameSecret(req.headers.get("x-webhook-secret") || "", secret)) return json({ error: "unauthorized" }, 401);

  const raw = await req.text().catch(() => "");
  if (raw.length > 20000) return json({ error: "too large" }, 413);
  let event: { type?: string; table?: string; schema?: string; record?: Record<string, unknown> } = {};
  try { event = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }
  if (event.type !== "INSERT" || event.table !== "hdl_leads" || !event.record) return json({ skipped: "not a new lead" });
  const r = event.record;
  if (r.source !== "sito") return json({ skipped: "not from website" });

  const name = clean(r.full_name, 120) || "proprietario";
  const location = clean(r.location, 160) || "—";
  const interest = typeof r.interest === "string" && INTEREST[r.interest] ? r.interest : "gestione";
  const email = clean(r.email, 240);
  const results: Record<string, boolean> = {};

  if (email && EMAIL_RE.test(email)) {
    const mail = confirmationEmail(name, location, interest);
    results.confirmation = await send(apiKey, { from: FROM, to: [email], reply_to: OWNER, ...mail });
  }

  const notice = [
    "Nuova richiesta dal sito.",
    "",
    "Nome: " + name,
    "Zona: " + location,
    "Interesse: " + INTEREST[interest].label,
    "Email: " + (email || "non indicata"),
    "",
    "Dettagli e note nel gestionale: " + SITE + "/strumenti/accesso.html",
  ].join("\n");
  results.notice = await send(apiKey, {
    from: FROM,
    to: [OWNER],
    subject: "Nuova richiesta: " + name + " · " + location,
    text: notice,
    ...(email && EMAIL_RE.test(email) ? { reply_to: email } : {}),
  });
  return json({ ok: Object.values(results).every(Boolean), results });
});
