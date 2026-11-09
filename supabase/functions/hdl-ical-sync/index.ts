// Host da Lontano · Radar: reads the Airbnb and Booking.com iCal calendars of one property.
// Read only: it never writes to the portals and stores nothing. It returns only the busy
// dates; guest names, notes and reservation codes inside the iCal file are ignored.
// Authentication is checked here (deploy with verify_jwt = false, like hdl-claude-assistant).
const BASE = Deno.env.get("SUPABASE_URL") || "https://kgbkevncksvpfgqsvoqg.supabase.co";
const PUBLIC_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX";
const ORIGINS = new Set(["https://hostdalontano.com", "https://www.hostdalontano.com"]);
const MAX_ICAL_BYTES = 2_000_000;
const WINDOW_DAYS = 366;

function json(data: unknown, status = 200, origin = "https://hostdalontano.com"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "vary": "Origin",
    },
  });
}

async function rest(path: string, jwt: string): Promise<Response> {
  return fetch(BASE + path, {
    headers: { apikey: PUBLIC_KEY, Authorization: "Bearer " + jwt },
    signal: AbortSignal.timeout(9000),
  });
}

/** Only the official calendar export hosts of the two portals, over HTTPS. */
export function allowedCalendarUrl(raw: string, source: "airbnb" | "booking"): URL | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  const host = url.hostname.toLowerCase();
  const ok = source === "airbnb"
    ? /^(www\.)?airbnb\.(com|it|de|fr|es|co\.uk|ch|at|nl|be|pt|ie|com\.au|ca)$/.test(host)
    : host === "booking.com" || host.endsWith(".booking.com");
  return ok ? url : null;
}

/** Downloads one calendar, following at most 3 redirects that stay on the same portal. */
async function download(start: URL, source: "airbnb" | "booking"): Promise<string> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { accept: "text/calendar, text/plain;q=0.8" } });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      const target = next ? allowedCalendarUrl(new URL(next, url).toString(), source) : null;
      if (!target) throw new Error("reindirizzamento non consentito");
      url = target;
      continue;
    }
    if (!res.ok) throw new Error("il portale ha risposto " + res.status);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("risposta vuota");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ICAL_BYTES) { await reader.cancel(); throw new Error("calendario troppo grande"); }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(chunks.length === 1 ? chunks[0] : concat(chunks, size));
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("il link non è un calendario iCal");
    return text;
  }
  throw new Error("troppi reindirizzamenti");
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return all;
}

function dayFromIcal(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Busy days between from (included) and to (excluded), as YYYY-MM-DD.
 * DTEND is the departure day and is free again (iCal end is exclusive). Only dates are read:
 * SUMMARY, DESCRIPTION and other fields with guest details are ignored.
 */
export function busyDays(ical: string, from: number, to: number): string[] {
  const lines = ical.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out = new Set<string>();
  let inEvent = false, start: number | null = null, end: number | null = null, cancelled = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; start = end = null; cancelled = false; continue; }
    if (line === "END:VEVENT") {
      if (inEvent && start !== null && !cancelled) {
        const stop = end !== null && end > start ? end : start + 86_400_000;
        for (let d = Math.max(start, from); d < Math.min(stop, to); d += 86_400_000) out.add(isoDay(d));
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";")[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (name === "DTSTART") start = dayFromIcal(value);
    else if (name === "DTEND") end = dayFromIcal(value);
    else if (name === "STATUS" && value.trim().toUpperCase() === "CANCELLED") cancelled = true;
  }
  return [...out].sort();
}

function romeToday(): number {
  const [y, m, d] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date()).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = ORIGINS.has(origin);
  if (origin && !allowed) return json({ error: "Origine non autorizzata." }, 403);
  const responseOrigin = allowed ? origin : "https://hostdalontano.com";
  if (req.method === "OPTIONS") return json({}, 200, responseOrigin);
  if (req.method !== "POST") return json({ error: "Metodo non consentito." }, 405, responseOrigin);
  try {
    const auth = req.headers.get("authorization") || "";
    if (!/^Bearer [^\s]{20,}$/i.test(auth)) return json({ error: "Accedi al gestionale." }, 401, responseOrigin);
    const jwt = auth.replace(/^Bearer /i, "");
    const userResponse = await fetch(BASE + "/auth/v1/user", {
      headers: { apikey: PUBLIC_KEY, Authorization: "Bearer " + jwt },
      signal: AbortSignal.timeout(9000),
    });
    if (!userResponse.ok) return json({ error: "Sessione non valida. Accedi nuovamente." }, 401, responseOrigin);
    const user = await userResponse.json();
    if (!user?.id || typeof user.id !== "string") return json({ error: "Utente non verificato." }, 401, responseOrigin);
    const check = await rest("/rest/v1/hdl_admin_accounts?select=user_id&user_id=eq." + encodeURIComponent(user.id) + "&limit=1", jwt);
    if (!check.ok || (await check.json()).length !== 1) return json({ error: "Solo l’amministratore autorizzato." }, 403, responseOrigin);

    const raw = await req.text().catch(() => "");
    if (raw.length > 2000) return json({ error: "Richiesta troppo grande." }, 413, responseOrigin);
    let input: { property_id?: unknown } | null = null;
    try { input = JSON.parse(raw); } catch { input = null; }
    const propertyId = typeof input?.property_id === "string" ? input.property_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(propertyId)) {
      return json({ error: "Immobile non valido." }, 400, responseOrigin);
    }
    // The links are read from the database with the admin's own token, so RLS applies.
    const toolsRes = await rest("/rest/v1/hdl_property_tools?select=ical_airbnb,ical_booking&property_id=eq." + propertyId + "&limit=1", jwt);
    if (!toolsRes.ok) return json({ error: "Impossibile leggere i link dei calendari." }, 502, responseOrigin);
    const rows = await toolsRes.json();
    const links = { airbnb: rows?.[0]?.ical_airbnb || "", booking: rows?.[0]?.ical_booking || "" };
    if (!links.airbnb && !links.booking) return json({ error: "Salva prima almeno un link calendario (Airbnb o Booking)." }, 400, responseOrigin);

    const from = romeToday(), to = from + WINDOW_DAYS * 86_400_000;
    const busy = new Set<string>();
    const sources: Record<string, { ok: boolean; days?: number; error?: string }> = {};
    for (const source of ["airbnb", "booking"] as const) {
      if (!links[source]) continue;
      const url = allowedCalendarUrl(links[source], source);
      if (!url) { sources[source] = { ok: false, error: "link non valido per " + source }; continue; }
      try {
        const days = busyDays(await download(url, source), from, to);
        days.forEach((d) => busy.add(d));
        sources[source] = { ok: true, days: days.length };
      } catch (err) {
        sources[source] = { ok: false, error: err instanceof Error ? err.message : "errore di lettura" };
      }
    }
    const allOk = Object.values(sources).every((s) => s.ok);
    return json({ ok: allOk, busy: [...busy].sort(), sources, from: isoDay(from), synced_at: new Date().toISOString() }, 200, responseOrigin);
  } catch {
    return json({ error: "Errore temporaneo durante la lettura dei calendari." }, 500, responseOrigin);
  }
});
