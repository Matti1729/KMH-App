// supabase/functions/search-club/index.ts
// Transfermarkt Vereinssuche: Vereine nach Name suchen (weltweit, mit Wappen)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching Transfermarkt clubs for: ${query}`);

    const searchUrl = `https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`;

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
    const results: Array<{ name: string; logoUrl: string; liga: string; country: string }> = [];

    // Vereins-Sektion finden: "Suchergebnisse zu Vereinen" → <tbody>...</tbody>
    const vereineStart = html.indexOf('Suchergebnisse zu Vereinen');
    if (vereineStart !== -1) {
      const tbodyStart = html.indexOf('<tbody>', vereineStart);
      const tbodyEnd = html.indexOf('</tbody>', tbodyStart);

      if (tbodyStart !== -1 && tbodyEnd !== -1) {
        const tbody = html.substring(tbodyStart, tbodyEnd + 8);

        // Zeilen splitten
        const rows = tbody.split(/<tr\s+class="(?:odd|even)"[^>]*>/);

        for (const row of rows) {
          if (!row.includes('/startseite/verein/')) continue;

          // Logo: <img src="https://tmssl.akamaized.net//images/wappen/small/7317.png?lm=...">
          let logoUrl = '';
          const logoMatch = row.match(/img\s+src="(https?:\/\/tmssl\.akamaized\.net\/\/images\/wappen\/[^"]+)"/);
          if (logoMatch) {
            logoUrl = logoMatch[1].replace(/\/(?:tiny|small|normquad|medium)\//, '/big/');
            // Query-Parameter entfernen für saubere URL
            logoUrl = logoUrl.replace(/\?.*$/, '');
          }

          // Vereinsname: <a title="Union Klosterfelde" href="/.../startseite/verein/7317">
          const nameMatch = row.match(/<a\s+title="([^"]+)"\s+href="[^"]*\/startseite\/verein\/\d+"/);
          const clubName = nameMatch ? nameMatch[1].trim() : '';
          if (!clubName) continue;

          // Liga: <a title="NOFV-Oberliga Nord" href="/.../wettbewerb/...">
          let liga = '';
          const ligaMatch = row.match(/<a\s+title="([^"]+)"\s+href="[^"]*\/(?:startseite|wettbewerb)\/wettbewerb\//);
          if (!ligaMatch) {
            // Alternative: Liga-Link in inline-table
            const ligaAlt = row.match(/wettbewerb\/[^"]*"[^>]*>([^<]+)</);
            liga = ligaAlt ? ligaAlt[1].trim() : '';
          } else {
            liga = ligaMatch[1].trim();
          }

          // Land: <img ... title="Deutschland" alt="Deutschland" class="flaggenrahmen">
          let country = '';
          const countryMatch = row.match(/title="([^"]+)"[^>]*alt="[^"]*"[^>]*class="flaggenrahmen"/);
          if (!countryMatch) {
            const countryAlt = row.match(/alt="([^"]+)"[^>]*class="flaggenrahmen"/);
            country = countryAlt ? countryAlt[1].trim() : '';
          } else {
            country = countryMatch[1].trim();
          }

          if (!results.some(r => r.name === clubName)) {
            results.push({ name: clubName, logoUrl, liga, country });
          }
        }
      }
    }

    console.log(`Found ${results.length} club results for "${query}"`);

    // Gefundene Vereine mit Logo in club_logos speichern
    if (results.length > 0 && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
        const toUpsert = results.filter(r => r.logoUrl).map(r => ({ club_name: r.name, logo_url: r.logoUrl, liga: r.liga || null }));
        if (toUpsert.length > 0) {
          const { error } = await sb.from("club_logos").upsert(toUpsert, { onConflict: "club_name" });
          if (error) console.error("club_logos upsert error:", JSON.stringify(error));
          else console.log(`Saved ${toUpsert.length} club logos`);
        }
      } catch (e) {
        console.warn("Failed to save club logos:", e);
      }
    }

    return new Response(
      JSON.stringify({ results: results.slice(0, 20) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-club error:", error);
    return new Response(
      JSON.stringify({ results: [], error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
