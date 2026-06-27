// supabase/functions/search-handball/index.ts
// Handball-Suche für die Spielerübersicht (Handballerinnen).
// Datenquelle: offizielle Seite der Handball-Bundesliga Frauen (alsco-hbf.de),
// die ihre Daten über das deinsportplatz-CMS als JSON ausliefert:
//   - Wettbewerbe:  /api/v2/competitions/?enabled=true   (1./2. Bundesliga)
//   - Vereine:      /api/v2/teams/?limit=100
//   - Spielerinnen: /data/players/players_<fmpSeasonId>.json
//
// Zwei Modi:
//   { type: 'player', name }  → Spielerinnen-Suche (Voll-Autofill: Verein, Liga,
//                               Position, Geburtsdatum, Größe, Nationalität, Foto)
//   { type: 'club', query }   → Vereinsliste (1./2. BL) für die Vereinsauswahl
//                               (Shape kompatibel zu search-club)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CMS = "https://hbf-cms.deinsportplatz.de";

// Handball-Positionen (englischer Quell-Code → deutsch)
const POSITION_DE: Record<string, string> = {
  goalkeeper: "Torwart",
  left_winger: "Linksaußen",
  right_winger: "Rechtsaußen",
  left_back: "Rückraum Links",
  right_back: "Rückraum Rechts",
  centre_back: "Rückraum Mitte",
  center_back: "Rückraum Mitte",
  pivot: "Kreisläufer",
  line_player: "Kreisläufer",
};

// Häufige Nationalitäten (ISO-2 → deutsch); Fallback: Code in Großbuchstaben
const NAT_DE: Record<string, string> = {
  de: "Deutschland", at: "Österreich", ch: "Schweiz", nl: "Niederlande",
  dk: "Dänemark", se: "Schweden", no: "Norwegen", is: "Island",
  fr: "Frankreich", es: "Spanien", pt: "Portugal", it: "Italien",
  hu: "Ungarn", ro: "Rumänien", rs: "Serbien", hr: "Kroatien",
  si: "Slowenien", me: "Montenegro", mk: "Nordmazedonien", ba: "Bosnien-Herzegowina",
  pl: "Polen", cz: "Tschechien", sk: "Slowakei", ru: "Russland", ua: "Ukraine",
  br: "Brasilien", ar: "Argentinien", tn: "Tunesien", ao: "Angola",
  kr: "Südkorea", jp: "Japan", cm: "Kamerun", cv: "Kap Verde", gb: "Großbritannien",
};

function posDe(p?: string): string {
  if (!p) return "";
  return POSITION_DE[p] || p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function natDe(n?: string): string {
  if (!n) return "";
  return NAT_DE[n.toLowerCase()] || n.toUpperCase();
}
function dobDe(d?: string): string {
  const m = (d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}
function leagueLabel(comp: any): string {
  const n = comp?.name || "";
  if (/^1\./.test(n)) return "1. Handball-Bundesliga Frauen";
  if (/^2\./.test(n)) return "2. Handball-Bundesliga Frauen";
  return n;
}

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// In-Memory-Cache (Edge-Instanz wird oft wiederverwendet) — spart wiederholte CMS-Fetches.
let cache: { ts: number; comps: any[]; teamMap: Record<string, string>; players: Record<string, any[]> } | null = null;
const TTL = 1000 * 60 * 30;

async function load() {
  if (cache && Date.now() - cache.ts < TTL) return cache;
  const compData = await getJson(`${CMS}/api/v2/competitions/?enabled=true`);
  // competitionType === 1 = Liga (Bundesliga), 2 = Pokal/Cup → ignorieren
  const comps = (compData.items || []).filter((c: any) => c.competitionType === 1 && c.fmpSeasonId);
  const teamData = await getJson(`${CMS}/api/v2/teams/?limit=100`);
  const teamMap: Record<string, string> = {};
  for (const t of (teamData.items || [])) {
    if (t.fmpForeignId != null) teamMap[String(t.fmpForeignId)] = t.name;
  }
  const players: Record<string, any[]> = {};
  for (const c of comps) {
    try {
      const pd = await getJson(`${CMS}/data/players/players_${c.fmpSeasonId}.json`);
      players[c.id] = pd.playerStatistics || [];
    } catch {
      players[c.id] = [];
    }
  }
  cache = { ts: Date.now(), comps, teamMap, players };
  return cache;
}

function jsonResp(o: any): Response {
  return new Response(JSON.stringify(o), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type || "player";
    const { comps, teamMap, players } = await load();

    // --- Vereinsliste (1./2. BL) ---
    if (type === "club") {
      const q = (body.query || "").toLowerCase().trim();
      const seen = new Set<string>();
      const results: any[] = [];
      for (const c of comps) {
        for (const p of players[c.id] || []) {
          const name = teamMap[String(p.fmpTeamId)];
          if (!name || seen.has(name)) continue;
          seen.add(name);
          if (q && !name.toLowerCase().includes(q)) continue;
          results.push({
            name,
            liga: leagueLabel(c),
            country: "Deutschland",
            logoUrl: `${CMS}/fmp/teamlogo/80/${p.fmpTeamId}`,
          });
        }
      }
      results.sort((a, b) => a.name.localeCompare(b.name));
      return jsonResp({ results });
    }

    // --- Spielerinnen-Suche ---
    const q = (body.name || "").toLowerCase().trim();
    if (q.length < 2) return jsonResp({ results: [] });
    const results: any[] = [];
    for (const c of comps) {
      for (const p of players[c.id] || []) {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        const rev = `${p.lastName} ${p.firstName}`.toLowerCase();
        if (!full.includes(q) && !rev.includes(q)) continue;
        const club = teamMap[String(p.fmpTeamId)] || "";
        const age = p.birthDate
          ? String(Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 864e5)))
          : "";
        results.push({
          source: "handball",
          name: `${p.firstName} ${p.lastName}`.trim(),
          verein: club,
          position: posDe(p.position),
          dateOfBirth: dobDe(p.birthDate),
          nationality: natDe(p.nationality),
          heightCm: typeof p.height === "number" && p.height > 0 ? p.height : null,
          league: leagueLabel(c),
          photoUrl: p.picture || "",
          clubLogoUrl: `${CMS}/fmp/teamlogo/80/${p.fmpTeamId}`,
          shirtNumber: p.shirtNumber || null,
          age,
          gender: p.gender || "",
        });
      }
    }
    results.sort((a, b) => {
      const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
      const ax = an.startsWith(q) ? 0 : 1, bx = bn.startsWith(q) ? 0 : 1;
      if (ax !== bx) return ax - bx;
      return an.localeCompare(bn);
    });
    return jsonResp({ results: results.slice(0, 40) });
  } catch (e: any) {
    console.error("search-handball error:", e);
    return jsonResp({ results: [], error: String(e?.message || e) });
  }
});
