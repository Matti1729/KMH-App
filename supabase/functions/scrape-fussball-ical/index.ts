// supabase/functions/scrape-fussball-ical/index.ts
// Scraped die Spielplan-Seite eines fussball.de-Teams via Browserless `/content`-API
// (Headless Chrome rendert die JS-injected Seite, gibt rendered HTML zurück).
// HTML wird in Deno mit Regex geparst.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApiGame {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  location?: string;
  league?: string;
  matchday?: string;
  result?: string;
  gameUrl?: string;
}

// "Sa, 25.10.2025" / "25.10.25" / "25.10.2025" → ISO YYYY-MM-DD
function parseGermanDate(text: string): string {
  if (!text) return "";
  const cleaned = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const m = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return "";
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  return `${year}-${month}-${day}`;
}

// "14:00 Uhr" oder "14:00" → "14:00"
function parseGermanTime(text: string): string {
  if (!text) return "";
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

// HTML-Entities und Tags strippen
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Extrahiert Spiele aus dem fussball.de-Spielplan-HTML.
// Layout pro Spiel sind 2-3 Tabellenzeilen:
//   <tr class="row-headline">       — mobile-only Header mit "Wochentag, DD.MM.YYYY - HH:MM Uhr | Liga"
//   <tr class="row-competition">    — desktop Datum+Liga: <td class="column-date">Di, 05.05.26 | 18:30</td>
//   <tr class="odd"> oder <tr>      — eigentliche Spiel-Zeile mit zwei <td class="column-club"> Blöcken
function parseGames(html: string): ApiGame[] {
  const games: ApiGame[] = [];

  // Splitte HTML in alle <tr> Blöcke und gehe in Reihenfolge durch
  const trRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let lastDate = "";
  let lastTime = "";
  let lastLeague = "";
  let m: RegExpExecArray | null;

  while ((m = trRegex.exec(html)) !== null) {
    const trAttrs = m[1] || "";
    const trInner = m[2] || "";

    // Variante 1: row-competition / row-headline mit Datum+Liga
    if (/class="[^"]*(?:row-competition|row-headline)[^"]*"/.test(trAttrs)) {
      // column-date Zelle (auf desktop): "Di, 05.05.26 | 18:30"
      const colDateMatch = trInner.match(/<td[^>]*class="[^"]*column-date[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
      if (colDateMatch) {
        const txt = stripHtml(colDateMatch[1]);
        const dateMatch = txt.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/);
        const timeMatch = txt.match(/(\d{1,2}):(\d{2})/);
        if (dateMatch) lastDate = parseGermanDate(dateMatch[0]);
        if (timeMatch) lastTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
      }
      // column-team Zelle: <a>Regionalliga</a>
      const colTeamMatch = trInner.match(/<td[^>]*class="[^"]*column-team[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
      if (colTeamMatch) {
        const t = stripHtml(colTeamMatch[1]);
        if (t) lastLeague = t;
      }
      // Headline-Variante (mobile): "Dienstag, 05.05.2026 - 18:30 Uhr | Regionalliga"
      if (/class="[^"]*row-headline/.test(trAttrs)) {
        const txt = stripHtml(trInner);
        const dateMatch = txt.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/);
        const timeMatch = txt.match(/(\d{1,2}):(\d{2})/);
        if (dateMatch) lastDate = parseGermanDate(dateMatch[0]);
        if (timeMatch) lastTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        const ligaMatch = txt.match(/\|\s*([^|]+?)\s*$/);
        if (ligaMatch) lastLeague = ligaMatch[1].trim();
      }
      continue;
    }

    // Variante 2: Match-Row erkennen — enthält 2x column-club
    const columnClubRegex = /<td[^>]*class="[^"]*column-club[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
    const columnClubs: string[] = [];
    let cc: RegExpExecArray | null;
    while ((cc = columnClubRegex.exec(trInner)) !== null) {
      columnClubs.push(cc[1]);
    }
    if (columnClubs.length < 2) continue;

    // Aus jedem column-club: club-name + Logo
    const teams: { name: string; logo?: string }[] = [];
    for (const ccHtml of columnClubs.slice(0, 2)) {
      const nameMatch = ccHtml.match(/<div[^>]*class="[^"]*club-name[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const name = nameMatch ? stripHtml(nameMatch[1]) : "";
      // Logo: <span data-responsive-image="//..."> oder <img src=...>
      const dataImgMatch = ccHtml.match(/data-responsive-image="([^"]+)"/i);
      const imgSrcMatch = ccHtml.match(/<img[^>]+src="([^"]+)"/i);
      let logo = (dataImgMatch && dataImgMatch[1]) || (imgSrcMatch && imgSrcMatch[1]) || undefined;
      if (logo && logo.startsWith("//")) logo = "https:" + logo;
      teams.push({ name, logo });
    }
    if (!teams[0].name || !teams[1].name) continue;

    // Spiel-URL aus column-score / column-detail
    const gameUrlMatch = trInner.match(/<a[^>]+href="(https?:\/\/www\.fussball\.de\/spiel\/[^"]+)"/i)
      || trInner.match(/<a[^>]+href="(\/spiel\/[^"]+)"/i);
    let gameUrl: string | undefined;
    if (gameUrlMatch) {
      gameUrl = gameUrlMatch[1].startsWith("http") ? gameUrlMatch[1] : `https://www.fussball.de${gameUrlMatch[1]}`;
    }

    // Result aus column-score Spans
    const resultMatch = trInner.match(/<span[^>]*class="[^"]*score-left[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*score-right[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const result = resultMatch ? `${stripHtml(resultMatch[1])}:${stripHtml(resultMatch[2])}` : undefined;

    if (!lastDate) continue;

    const id = gameUrl?.split("/spiel/").pop()?.split(/[?#]/)[0]
      || `${lastDate}_${teams[0].name}_${teams[1].name}`.replace(/\s+/g, "_");

    games.push({
      id,
      date: lastDate,
      time: lastTime,
      homeTeam: teams[0].name,
      awayTeam: teams[1].name,
      homeTeamLogo: teams[0].logo,
      awayTeamLogo: teams[1].logo,
      league: lastLeague || undefined,
      gameUrl,
      result: result && /\d/.test(result) ? result : undefined,
    });
  }

  // Deduplizieren
  const seen = new Set<string>();
  return games.filter(g => {
    const k = `${g.date}|${g.homeTeam}|${g.awayTeam}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchHtmlViaBrowserless(teamUrl: string): Promise<{ html?: string; error?: string }> {
  if (!BROWSERLESS_API_KEY) {
    return { error: "BROWSERLESS_API_KEY missing" };
  }

  const apiUrl = `https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}`;
  // Setze Cookies um Usercentrics-Cookie-Banner zu skippen
  // (fussball.de nutzt Usercentrics — Consent-Cookie wird gesetzt nach Akzeptieren)
  const consentCookie = {
    name: "uc_user_interaction",
    value: "true",
    domain: ".fussball.de",
    path: "/",
  };
  const consentCookie2 = {
    name: "uc_settings",
    value: '{"controllerId":"FlEfWqayV","language":"de","version":"latest"}',
    domain: ".fussball.de",
    path: "/",
  };

  const body = {
    url: teamUrl,
    cookies: [consentCookie, consentCookie2],
    gotoOptions: {
      waitUntil: "networkidle0",
      timeout: 30000,
    },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[browserless] HTTP ${response.status}: ${errorText.substring(0, 500)}`);
    return { error: `Browserless ${response.status}: ${errorText.substring(0, 100)}` };
  }

  const html = await response.text();
  console.log(`[browserless] HTML length: ${html.length}`);
  // Snippet für Debugging — falls 0 Spiele, sehen wir im Log was im HTML drin ist
  const clubNameCount = (html.match(/class="[^"]*club-name/g) || []).length;
  const rowContentCount = (html.match(/class="[^"]*row-content/g) || []).length;
  console.log(`[browserless] club-name=${clubNameCount} row-content=${rowContentCount}`);
  return { html };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let teamId: string | undefined;
    let teamUrl: string | undefined;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      teamId = body.teamId;
      teamUrl = body.teamUrl;
    } else {
      const url = new URL(req.url);
      teamId = url.searchParams.get("teamId") || undefined;
      teamUrl = url.searchParams.get("teamUrl") || undefined;
    }

    if (!teamId && !teamUrl) {
      return new Response(
        JSON.stringify({ error: "teamId or teamUrl required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // teamUrl bevorzugen (User-Pflege), sonst aus teamId konstruieren
    const url = teamUrl && teamUrl.includes("/team-id/")
      ? teamUrl.replace(/#.*$/, "") // Hash entfernen (#!/...)
      : `https://www.fussball.de/team/-/team-id/${teamId}`;
    console.log(`[scrape] team=${teamId} url=${url}`);

    const { html, error } = await fetchHtmlViaBrowserless(url);
    if (error || !html) {
      return new Response(
        JSON.stringify({ games: [], error: error || "Empty HTML" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const games = parseGames(html);
    console.log(`[scrape] team=${teamId} games=${games.length}`);

    // Debug-Info wenn keine Spiele gefunden — relevantes Snippet vom ersten .club-name
    let debug: any = undefined;
    if (games.length === 0) {
      const firstClubNameIdx = html.search(/class="[^"]*club-name/);
      const snippet = firstClubNameIdx >= 0 ? html.substring(Math.max(0, firstClubNameIdx - 1500), firstClubNameIdx + 2500) : null;
      debug = {
        htmlLength: html.length,
        clubNameCount: (html.match(/class="[^"]*club-name/g) || []).length,
        title: (html.match(/<title>([^<]+)<\/title>/) || [])[1],
        snippet: snippet?.replace(/\s+/g, ' '),
      };
    }

    return new Response(
      JSON.stringify({ games, ...(debug ? { debug } : {}) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[scrape] error:", e);
    return new Response(
      JSON.stringify({ games: [], error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
