// Einmal-Script: Findet alle Vereine ohne Logo und sucht sie auf TM

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Alle Vereinsnamen aus Kontakten
  const { data: contacts } = await sb.from("football_network_contacts").select("verein").not("verein", "is", null).neq("verein", "").neq("verein", "Vereinslos");
  const uniqueClubs = [...new Set((contacts || []).map((c: any) => c.verein).filter(Boolean))];

  // 2. Alle bekannten Logos
  const { data: logos } = await sb.from("club_logos").select("club_name");
  const knownClubs = new Set((logos || []).map((l: any) => l.club_name));

  // 3. Fehlende finden
  const missing = uniqueClubs.filter(c => !knownClubs.has(c));
  console.log(`${missing.length} clubs missing logos out of ${uniqueClubs.length} total`);

  let found = 0;
  const results: string[] = [];

  for (const club of missing) {
    try {
      const searchUrl = `https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(club)}`;
      const resp = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept-Language": "de-DE,de;q=0.9",
        },
      });
      if (!resp.ok) { results.push(`${club}: TM ${resp.status}`); continue; }

      const html = await resp.text();
      const vereineStart = html.indexOf("Suchergebnisse zu Vereinen");
      if (vereineStart === -1) { results.push(`${club}: not found on TM`); continue; }

      const tbodyStart = html.indexOf("<tbody>", vereineStart);
      const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
      if (tbodyStart === -1 || tbodyEnd === -1) { results.push(`${club}: no tbody`); continue; }

      const tbody = html.substring(tbodyStart, tbodyEnd);
      const logoMatch = tbody.match(/img\s+src="(https?:\/\/tmssl\.akamaized\.net\/\/images\/wappen\/[^"]+)"/);
      const nameMatch = tbody.match(/<a\s+title="([^"]+)"\s+href="[^"]*\/startseite\/verein\/\d+"/);

      if (logoMatch && nameMatch) {
        const logoUrl = logoMatch[1].replace(/\/(?:tiny|small|normquad|medium)\//, "/big/").replace(/\?.*$/, "");
        const tmName = nameMatch[1].trim();
        await sb.from("club_logos").upsert({ club_name: tmName, logo_url: logoUrl }, { onConflict: "club_name" });
        // Auch den Original-Namen mappen falls anders
        if (tmName !== club) {
          await sb.from("club_logos").upsert({ club_name: club, logo_url: logoUrl }, { onConflict: "club_name" });
        }
        found++;
        results.push(`${club} → ${tmName} ✓`);
      } else {
        results.push(`${club}: no logo found`);
      }

      // Pause
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      results.push(`${club}: error ${e.message}`);
    }
  }

  return new Response(
    JSON.stringify({ total: uniqueClubs.length, missing: missing.length, found, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
