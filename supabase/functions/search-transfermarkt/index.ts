// supabase/functions/search-transfermarkt/index.ts
// Transfermarkt Schnellsuche: Spieler und Trainer/Funktionäre nach Name suchen

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, type = 'all' } = await req.json(); // type: 'player' | 'trainer' | 'all'
    if (!name) {
      return new Response(
        JSON.stringify({ error: "name is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching Transfermarkt for: ${name}`);

    const searchUrl = `https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Transfermarkt responded with ${response.status}`);
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();
    const results: any[] = [];

    // Spieler-Sektion parsen
    if (type === 'player' || type === 'all') {
      const playerSection = html.match(/id="player-grid"[\s\S]*?<\/tbody>/);
      if (playerSection) {
        const rows = playerSection[0].split(/<tr\s+class="(?:odd|even)"[^>]*>/).filter(r => r.includes("profil/spieler/"));

        for (const row of rows) {
          const profileMatch = row.match(/href="([^"]*\/profil\/spieler\/\d+)"[^>]*>([^<]+)<\/a>/);
          if (!profileMatch) continue;

          const profileUrl = `https://www.transfermarkt.de${profileMatch[1]}`;
          const playerName = profileMatch[2].trim();

          // Verein
          const vereinMatch = row.match(/<a\s+title="([^"]+)"[^>]*href="[^"]*\/startseite\/verein\/\d+"/);
          let verein = vereinMatch ? vereinMatch[1] : "";
          if (verein === "Karriereende" || verein === "Vereinslos" || verein === "---") verein = "";

          // Position (z.B. "HS", "IV", "TW", "Mittelfeld")
          const posMatch = row.match(/<td[^>]*class="zentriert"[^>]*>([A-ZÄÖÜa-zäöü][A-ZÄÖÜa-zäöüß\/\- ]*)<\/td>/);
          const position = posMatch ? posMatch[1].trim() : "";

          // Alter
          const ageMatch = row.match(/<td[^>]*class="zentriert"[^>]*>(\d{1,2})<\/td>/);
          const age = ageMatch ? ageMatch[1] : "";

          // Nationalität (aus Flaggen-Bild — title steht vor class)
          const natMatch = row.match(/title="([^"]+)"[^>]*class="flaggenrahmen"/);
          const nationality = natMatch ? natMatch[1] : "";

          if (!results.find(r => r.url === profileUrl)) {
            results.push({
              name: playerName,
              url: profileUrl,
              nationality,
              verein,
              position,
              age,
              type: "player",
            });
          }
        }
      }
    }

    // Coach/Trainer Sektion parsen
    if (type === 'trainer' || type === 'all') {
    const coachSection = html.match(/id="coach-grid"[\s\S]*?<\/tbody>/);
    if (coachSection) {
      // Auf äußere Tabellenzeilen splitten (class="odd" oder class="even")
      const rows = coachSection[0].split(/<tr\s+class="(?:odd|even)"[^>]*>/).filter(r => r.includes("profil/trainer/"));

      for (const row of rows) {
        // Name und URL
        const profileMatch = row.match(/href="([^"]*\/profil\/trainer\/\d+)"[^>]*>([^<]+)<\/a>/);
        if (!profileMatch) continue;

        const profileUrl = `https://www.transfermarkt.de${profileMatch[1]}`;
        const trainerName = profileMatch[2].trim();

        // Verein: aus <a title="Vereinsname" href="...startseite/verein...">
        const vereinMatch = row.match(/<a\s+title="([^"]+)"[^>]*href="[^"]*\/startseite\/verein\/\d+"/);
        let verein = vereinMatch ? vereinMatch[1] : "";
        if (verein === "pausiert" || verein === "Vereinslos") verein = "";

        // Funktion: aus <td class="rechts">Trainer</td> (erste rechts-Zelle)
        const funktionMatch = row.match(/<td[^>]*class="rechts"[^>]*>([^<]+)<\/td>/);
        const funktion = funktionMatch ? funktionMatch[1].trim() : "";

        if (!results.find(r => r.url === profileUrl)) {
          results.push({
            name: trainerName,
            url: profileUrl,
            verein,
            funktion,
            type: "trainer",
          });
        }
      }
    }

    // Fallback: Einfacheres Pattern
    if (results.length === 0 && html.includes("profil/trainer/")) {
      const simpleRegex = /href="([^"]*\/profil\/trainer\/\d+)"[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = simpleRegex.exec(html)) !== null) {
        const profileUrl = `https://www.transfermarkt.de${match[1]}`;
        const trainerName = match[2].trim();
        if (trainerName && !results.find(r => r.url === profileUrl)) {
          results.push({ name: trainerName, url: profileUrl, verein: "", funktion: "", type: "trainer" });
        }
      }
    }
    } // end if type === trainer || all

    console.log(`Found ${results.length} results for "${name}"`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ results: [], error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
