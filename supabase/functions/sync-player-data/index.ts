// supabase/functions/sync-player-data/index.ts
// Automatischer Sync: Spielerdaten von Transfermarkt aktualisieren
// Wird alle 2 Tage per Cron aufgerufen

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function fetchProfile(url: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "de-DE,de;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const html = await resp.text();

    const profile: any = {};

    // Geburtsdatum
    const dobMatch = html.match(/Geb\.\/Alter:[\s\S]*?(\d{2}\.\d{2}\.\d{4})/);
    if (dobMatch) profile.birth_date = dobMatch[1];

    // Größe
    const heightMatch = html.match(/Größe:<\/span>\s*<span[^>]*>(\d[,\.]\d+)\s*(?:&nbsp;|\s)*m/);
    if (heightMatch) profile.height = heightMatch[1].replace(',', ',') + ' m';

    // Fuß
    const footMatch = html.match(/Fuß:[\s\S]*?info-table__content--bold[^>]*>\s*(rechts|links|beidfüßig)/i);
    if (footMatch) profile.strong_foot = footMatch[1].trim();

    // Position
    const posMatch = html.match(/data-header__label">Position:\s*<span[^>]*>\s*([^<]+)/);
    if (posMatch) profile.position = posMatch[1].trim().replace(/\s+/g, ' ');

    // Nationalität
    const natMatch = html.match(/Staatsbürgerschaft:[\s\S]*?&nbsp;&nbsp;([^<\n]+)/);
    if (natMatch) profile.nationality = natMatch[1].trim();

    // Verein
    const clubMatch = html.match(/Aktueller Verein:[\s\S]*?title="([^"]+)"[^>]*href="[^"]*\/startseite\/verein/);
    if (clubMatch) profile.club = clubMatch[1];

    // Vertrag bis (aus data-header — nicht info-table, sonst wird "Im Team seit" erwischt)
    const contractMatch = html.match(/Vertrag bis:\s*<span[^>]*data-header__content[^>]*>\s*(\d{2}\.\d{2}\.\d{4})/);
    if (contractMatch) {
      profile.contract_end = contractMatch[1];
    } else {
      const contractMatch2 = html.match(/info-table__content--regular">\s*Vertrag bis:<\/span>\s*<span[^>]*info-table__content--bold[^>]*>\s*(\d{2}\.\d{2}\.\d{4})/);
      if (contractMatch2) profile.contract_end = contractMatch2[1];
    }

    // Liga
    const leagueMatch = html.match(/data-header__league-link"[^>]*>([\s\S]*?)<\/a>/);
    if (leagueMatch) {
      const leagueText = leagueMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (leagueText) profile.league = leagueText;
    }

    return profile;
  } catch (err) {
    console.error(`Fetch failed for ${url}:`, err);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Alle Spieler mit Transfermarkt-URL laden
    const { data: players, error } = await supabase
      .from("player_details")
      .select("id, first_name, last_name, transfermarkt_url")
      .not("transfermarkt_url", "is", null)
      .neq("transfermarkt_url", "");

    if (error) {
      console.error("DB error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!players || players.length === 0) {
      console.log("No players with TM URL found.");
      return new Response(
        JSON.stringify({ synced: 0, total: 0, message: "Keine Spieler mit TM-URL gefunden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${players.length} players from Transfermarkt...`);

    let synced = 0;
    const errors: string[] = [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerName = `${player.first_name} ${player.last_name}`;
      console.log(`[${i + 1}/${players.length}] Fetching: ${playerName}`);

      const profile = await fetchProfile(player.transfermarkt_url);

      if (profile && Object.keys(profile).length > 0) {
        // DD.MM.YYYY → YYYY-MM-DD
        const toIso = (d: string) => {
          const m = d?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
        };
        // Position-Mapping TM → DB
        const posMap: Record<string, string> = {
          'Torwart': 'TW', 'Innenverteidiger': 'IV', 'Linker Verteidiger': 'LV', 'Rechter Verteidiger': 'RV',
          'Defensives Mittelfeld': 'DM', 'Zentrales Mittelfeld': 'ZM', 'Offensives Mittelfeld': 'OM',
          'Linkes Mittelfeld': 'LA', 'Rechtes Mittelfeld': 'RA', 'Linksaußen': 'LA', 'Rechtsaußen': 'RA',
          'Hängende Spitze': 'OM', 'Mittelstürmer': 'ST', 'Sturm': 'ST', 'Abwehr': 'IV', 'Mittelfeld': 'ZM',
        };
        const mapPos = (p: string) => {
          if (!p) return null;
          if (posMap[p]) return posMap[p];
          for (const [k, v] of Object.entries(posMap)) { if (p.includes(k)) return v; }
          return null;
        };

        // Nur Felder updaten die tatsächlich Werte haben
        const updateData: any = {};
        if (profile.club) updateData.club = profile.club;
        if (profile.league) updateData.league = profile.league;
        const pos = mapPos(profile.position);
        if (pos) updateData.position = pos;
        if (profile.nationality) updateData.nationality = profile.nationality;
        const dob = profile.birth_date ? toIso(profile.birth_date) : null;
        if (dob) updateData.birth_date = dob;
        if (profile.height) {
          const hm = profile.height.match(/(\d)[,.](\d+)/);
          if (hm) updateData.height = parseInt(hm[1] + hm[2]);
        }
        if (profile.strong_foot) updateData.strong_foot = profile.strong_foot;
        const ce = profile.contract_end ? toIso(profile.contract_end) : null;
        if (ce) updateData.contract_end = ce;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from("player_details")
            .update(updateData)
            .eq("id", player.id);

          if (updateError) {
            errors.push(`${playerName}: ${updateError.message}`);
          } else {
            synced++;
            console.log(`  ✓ ${playerName} updated: ${Object.keys(updateData).join(", ")}`);
          }
        }
      } else {
        errors.push(`${playerName}: Kein Profil gefunden`);
      }

      // Pause: 30-60 Sekunden zwischen Anfragen (unauffällig)
      if (i < players.length - 1) {
        const delay = 30000 + Math.random() * 30000; // 30-60s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const result = {
      synced,
      total: players.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${synced}/${players.length} Spieler aktualisiert`,
    };

    console.log("Sync complete:", JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
