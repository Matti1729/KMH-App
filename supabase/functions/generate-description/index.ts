// supabase/functions/generate-description/index.ts
// AI-Textgenerierung für Spielerbeschreibungen mit Claude

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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
}

interface RequestBody {
  player: PlayerData;
  careerEntries?: CareerEntry[];
}

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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-description called");

    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is missing!");
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY nicht konfiguriert. Bitte in Supabase Edge Function Secrets hinzufügen." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("API Key found, length:", ANTHROPIC_API_KEY.length);

    const { player, careerEntries = [] }: RequestBody = await req.json();
    console.log("Player data received:", player?.first_name, player?.last_name);

    const age = calculateAge(player.birth_date);
    const positionFull = POSITION_MAP[player.position] || player.position;
    const secondaryPositionFull = player.secondary_position ? (POSITION_MAP[player.secondary_position] || player.secondary_position) : null;

    // Berechne Karrierestatistiken
    let totalGames = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let topLeague = '';
    let hasNationalTeam = false;

    for (const entry of careerEntries) {
      totalGames += parseInt(entry.games || '0') || 0;
      totalGoals += parseInt(entry.goals || '0') || 0;
      totalAssists += parseInt(entry.assists || '0') || 0;

      // Prüfe auf hohe Ligen
      if (entry.league?.includes('Bundesliga') || entry.league?.includes('2. Liga') || entry.league?.includes('3. Liga')) {
        if (!topLeague || entry.league.includes('Bundesliga')) {
          topLeague = entry.league;
        }
      }

      // Prüfe auf Nationalmannschaft
      if (entry.club?.toLowerCase().includes('nationalmannschaft') ||
          entry.club?.toLowerCase().includes('national') ||
          entry.league?.toLowerCase().includes('u21') ||
          entry.league?.toLowerCase().includes('u20') ||
          entry.league?.toLowerCase().includes('u19') ||
          entry.league?.toLowerCase().includes('u18') ||
          entry.league?.toLowerCase().includes('u17') ||
          entry.league?.toLowerCase().includes('nationalmannschaft')) {
        hasNationalTeam = true;
      }
    }

    // Erstelle Prompt für Claude
    const prompt = `Du bist ein professioneller Spielerberater und schreibst eine kurze, professionelle Beschreibung für einen Fußballspieler.

Schreibe einen fließenden, professionellen deutschen Text (4-6 Sätze) über den Spieler. Der Text soll für ein Spielerprofil verwendet werden.

Spielerdaten:
- Name: ${player.first_name} ${player.last_name}
- Alter: ${age} Jahre
- Position: ${positionFull}${secondaryPositionFull ? ` (Nebenposition: ${secondaryPositionFull})` : ''}
- Nationalität: ${player.nationality}
- Größe: ${player.height} cm
- Stärken: ${player.strengths || 'Keine angegeben'}
- Aktueller Verein: ${player.club || 'Unbekannt'}
- Liga: ${player.league || 'Unbekannt'}
${totalGames > 0 ? `- Karriere-Statistiken: ${totalGames} Spiele, ${totalGoals} Tore, ${totalAssists} Vorlagen` : ''}
${topLeague ? `- Höchste Liga: ${topLeague}` : ''}
${hasNationalTeam ? '- Hat bereits Nationalmannschaftserfahrung' : ''}

Regeln für den Text:
1. Beginne mit dem Vornamen und charakteristischen Adjektiven (z.B. "Elias ist ein hochveranlagter, deutscher Innenverteidiger")
2. Bei jungen Spielern (unter 23) erwähne das Alter als positiv ("mit erst X Jahren")
3. Bei großen Spielern (über 185cm) erwähne die Körpergröße als Vorteil
4. Erwähne bemerkenswerte Statistiken wenn vorhanden
5. Integriere die Stärken natürlich in den Text
6. Bei Nationalmannschaftserfahrung erwähne dies
7. Schreibe professionell aber nicht übertrieben
8. Nur den reinen Text ausgeben, keine Anführungszeichen oder Formatierung

Beispielstil:
"Elias Decker ist ein hochveranlagter, deutscher Innenverteidiger, der mit erst 19 Jahren bereits über 25 Einsätze in der 3. Liga vorweisen kann. Mit seiner Körpergröße von 1,93 m bringt er eine ausgeprägte körperliche Präsenz mit, die ihn im Luftduell und in der Zweikampfführung zu einem unangenehmen Gegenspieler macht. Neben seiner Robustheit überzeugt er durch seine Spieleröffnung, sein gutes Stellungsspiel und seine Führungsqualitäten."`;

    // Rufe Claude API auf
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API Fehler:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Claude API Fehler: ${response.status} - ${errorText}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
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
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Fehler:", error);
    return new Response(
      JSON.stringify({ error: `Fehler: ${error.message}` }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
