// supabase/functions/generate-description/index.ts
// AI-Profiltext-Generierung für Spieler-Exposés (Scouting-Analyst-Prompt)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// --- Interfaces ---

interface CareerEntry {
  club: string;
  league: string;
  from_date: string;
  to_date: string;
  games?: string;
  goals?: string;
  assists?: string;
  is_current: boolean;
}

interface PlayerData {
  first_name: string;
  last_name: string;
  position: string;
  secondary_position?: string;
  nationality: string;
  birth_date: string;
  height: number;
  strengths: string;
  club?: string;
  league?: string;
  strong_foot?: string;
  potentials?: string;
}

interface RequestBody {
  player: PlayerData;
  careerEntries?: CareerEntry[];
  bulletPoints?: string;
}

// --- Hilfsfunktionen ---

const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linksaußen',
  'RA': 'Rechtsaußen',
  'ST': 'Stürmer',
};

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDateDE(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
}

function getPositionContext(position: string): { category: string; roleDescription: string } {
  switch (position) {
    case 'TW': return {
      category: 'goalkeeper',
      roleDescription: 'Torwart – Strafraumbeherrschung, Spieleröffnung, Kommunikation',
    };
    case 'IV': return {
      category: 'defender',
      roleDescription: 'Innenverteidiger – Zweikampf, Spieleröffnung, Stellungsspiel',
    };
    case 'LV': case 'RV': return {
      category: 'defender',
      roleDescription: 'Außenverteidiger – Offensive Läufe, Flanken, 1v1-Verteidigung',
    };
    case 'DM': return {
      category: 'midfielder',
      roleDescription: 'Sechser – Balleroberung, Spielverlagerung, Absicherung',
    };
    case 'ZM': case 'OM': return {
      category: 'midfielder',
      roleDescription: 'Mittelfeldspieler – Passspiel, Spielgestaltung, Dynamik',
    };
    case 'LA': case 'RA': return {
      category: 'attacker',
      roleDescription: 'Flügelspieler – Dribbling, Tempo, Torgefahr',
    };
    case 'ST': return {
      category: 'attacker',
      roleDescription: 'Stürmer – Abschluss, Laufwege, Kopfballspiel',
    };
    default: return {
      category: 'midfielder',
      roleDescription: 'nicht angegeben',
    };
  }
}

function buildPositionStats(
  entries: CareerEntry[],
  category: string
): { totalGames: number; totalGoals: number; totalAssists: number; extraStats: string; currentSeasonLine: string } {
  let totalGames = 0;
  let totalGoals = 0;
  let totalAssists = 0;

  const currentEntry = entries.find(e => e.is_current);

  for (const entry of entries) {
    totalGames += parseInt(entry.games || '0') || 0;
    totalGoals += parseInt(entry.goals || '0') || 0;
    totalAssists += parseInt(entry.assists || '0') || 0;
  }

  // Positionsspezifische Zusatzstats
  let extraStats = 'keine';
  if (category === 'attacker' && totalGames > 10) {
    const scorerActions = totalGoals + totalAssists;
    const ratio = (scorerActions / totalGames).toFixed(2);
    extraStats = `Torbeteiligung: ${ratio} pro Spiel (${scorerActions} Scorer-Aktionen in ${totalGames} Spielen)`;
  } else if (category === 'midfielder' && totalGames > 10) {
    const ratio = (totalAssists / totalGames).toFixed(2);
    extraStats = `Vorlagenquote: ${ratio} pro Spiel`;
  } else if (category === 'defender' && totalGoals > 0) {
    extraStats = `${totalGoals} Tore als Verteidiger`;
  }

  // Aktuelle Saison
  let currentSeasonLine = '';
  if (currentEntry) {
    const currentGames = parseInt(currentEntry.games || '0') || 0;
    const currentGoals = parseInt(currentEntry.goals || '0') || 0;
    const currentAssists = parseInt(currentEntry.assists || '0') || 0;
    if (currentGames > 0) {
      const parts = [`${currentGames} Einsätze`];
      if (category !== 'goalkeeper') {
        if (currentGoals > 0) parts.push(`${currentGoals} Tore`);
        if (currentAssists > 0) parts.push(`${currentAssists} Vorlagen`);
      }
      currentSeasonLine = `Aktuell bei ${currentEntry.club} (${currentEntry.league}): ${parts.join(', ')}`;
    }
  }

  return { totalGames, totalGoals, totalAssists, extraStats, currentSeasonLine };
}

function parseBulletPoints(raw: string): string {
  if (!raw?.trim()) return 'keine';
  const items = raw
    .split(/[\n;]|,\s+/)
    .map(s => s.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(s => s.length > 0);
  if (items.length === 0) return 'keine';
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

function buildRemarkableValues(player: PlayerData): string {
  const values: string[] = [];
  if (player.height && player.height >= 190) {
    values.push(`Körpergröße: ${player.height} cm`);
  }
  if (player.strong_foot?.toLowerCase() === 'beidfüßig' || player.strong_foot?.toLowerCase() === 'beide') {
    values.push('Beidfüßig');
  }
  return values.length > 0 ? values.join(', ') : 'keine';
}

function formatStrengths(strengths: string): string {
  if (!strengths?.trim()) return 'nicht angegeben';
  return strengths.split(';').map(s => s.trim()).filter(s => s).join(', ');
}

// --- System-Prompt (fix) ---

const SYSTEM_PROMPT = `Du bist ein Profi-Scouting-Analyst und schreibst Profiltexte für Scouts/Trainer/Manager.

AUFGABE:
Erstelle genau 1 Profiltext über den Spieler auf Basis der Daten unten. Zusätzlich erhältst du "Extra-Notizen" in Stichpunkten. Baue diese Informationen ein, wenn sie relevant und seriös belegbar wirken.

HARTE REGELN (müssen eingehalten werden):
- Länge: 90–110 Wörter (streng).
- Wenn der Name im Text genannt wird: NUR der Vorname (kein Nachname im Fließtext).
- Ton: professionell, faktenbasiert, seriös. Keine Superlative, keine Marketing-Floskeln.
- Stärken konkret & situativ (z.B. unter Druck, im Halbraum, im Umschalten, gegen tiefen Block).
- Messwerte (Größe etc.) nur erwähnen, wenn sie außergewöhnlich sind.
- Vereinsname: nur nennen, wenn wirklich relevant; sonst weglassen.
- Extra-Notizen: integrieren, aber nicht als Aufzählung übernehmen – in flüssigen Text umwandeln. Widersprüche zu den Kerndaten vermeiden.
- Schlusssatz: kein generischer Abschluss wie "verlässlicher Baustein", "wertvolle Verstärkung", "interessante Option". Stattdessen konkreten Fit oder Perspektive benennen.
- Formuliere natürlich und direkt — wie ein Scouting-Report, nicht wie ein Makler-Exposé.
- VERBOTENE PHRASEN (niemals verwenden): "berechenbarer Akteur", "wertvolle Verstärkung", "verlässlicher Baustein", "interessante Option", "unter Beweis stellen", "in die Waagschale werfen". Verwende stattdessen natürliche, konkrete Formulierungen.

INHALTS-STRUKTUR (ohne Überschriften, als Fließtext):
1) Einordnung/Spielertyp in 1 Satz: Vorname + Alter/Jahrgang + Position/Rolle + optional Liga + klares USP.
2) Rolle & Spielstil (1–2 Sätze): Wie er in Ballbesitz/Umschalten/Defensive wirkt.
3) Fakten/Output (1 Satz): Spiele/Tore/Assists oder positionsrelevante Kennzahl + Zeitraum.
4) Stärken (1–2 Sätze): 2–3 konkrete Stärken, möglichst an Spielsituationen gekoppelt.
5) Charakter + kurzer Fit (1 Satz).

GIB NUR DEN FERTIGEN TEXT AUS (keine Erklärungen, keine Stichpunkte).`;

// --- Server ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-description called");

    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is missing!");
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY nicht konfiguriert." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { player, careerEntries = [], bulletPoints = '' }: RequestBody = await req.json();
    console.log("Player:", player?.first_name, player?.last_name, "Position:", player?.position);

    // Daten aufbereiten
    const age = calculateAge(player.birth_date);
    const positionFull = POSITION_MAP[player.position] || player.position;
    const secondaryPositionFull = player.secondary_position
      ? POSITION_MAP[player.secondary_position] || player.secondary_position
      : null;
    const { category, roleDescription } = getPositionContext(player.position);
    const stats = buildPositionStats(careerEntries, category);
    const remarkableValues = buildRemarkableValues(player);
    const strengthsFormatted = formatStrengths(player.strengths);
    const extraNotes = parseBulletPoints(bulletPoints);

    // Spiele/Tore/Assists positionsspezifisch
    let spieleDisplay = stats.totalGames > 0 ? String(stats.totalGames) : 'nicht angegeben';
    let toreDisplay = 'nicht angegeben';
    let assistsDisplay = 'nicht angegeben';

    if (category === 'goalkeeper') {
      toreDisplay = 'nicht relevant (Torwart)';
      assistsDisplay = 'nicht relevant (Torwart)';
    } else {
      if (stats.totalGoals > 0) toreDisplay = String(stats.totalGoals);
      if (stats.totalAssists > 0) assistsDisplay = String(stats.totalAssists);
    }

    // User-Message mit befüllten Daten
    const userMessage = `SPIELERDATEN:
Vorname: ${player.first_name}
Nachname (nicht im Text verwenden): ${player.last_name}
Alter/Jahrgang: ${age} Jahre (geb. ${formatDateDE(player.birth_date)})
Position(en): ${positionFull}${secondaryPositionFull ? ', Nebenposition: ' + secondaryPositionFull : ''}
Liga: ${player.league || 'nicht angegeben'}
Verein (optional, nur wenn relevant): ${player.club || 'nicht angegeben'}
Spiele: ${spieleDisplay}
Tore: ${toreDisplay}
Assists: ${assistsDisplay}
Weitere Leistungsdaten: ${stats.extraStats}${stats.currentSeasonLine ? '\n' + stats.currentSeasonLine : ''}
Stärken (Stichpunkte): ${strengthsFormatted}
Charakter: nicht angegeben
Rolle/Spielstil (Stichpunkte): ${roleDescription}
Außergewöhnliche Werte: ${remarkableValues}

EXTRA-NOTIZEN (freie Stichpunkte vom Nutzer, falls vorhanden):
${extraNotes}`;

    console.log("Calling Claude API (sonnet-4)...");

    // Claude API mit Retry-Logik
    const MAX_RETRIES = 3;
    let claudeResponse: Response | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (claudeResponse.status === 429 && attempt < MAX_RETRIES - 1) {
        const retryAfter = parseInt(claudeResponse.headers.get("retry-after") || "0") || (attempt + 1) * 5;
        console.log(`Rate limited, retry in ${retryAfter}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      break;
    }

    if (!claudeResponse || !claudeResponse.ok) {
      const errorText = claudeResponse ? await claudeResponse.text() : 'No response';
      console.error("Claude API Fehler:", claudeResponse?.status, errorText);
      return new Response(
        JSON.stringify({ error: `Claude API Fehler: ${claudeResponse?.status} - ${errorText}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await claudeResponse.json();
    console.log("Claude API response received");
    const generatedText = data.content?.[0]?.text || "";

    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "Keine Beschreibung von Claude erhalten" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ description: generatedText.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fehler:", error);
    return new Response(
      JSON.stringify({ error: `Fehler: ${error.message}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
