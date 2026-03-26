// supabase/functions/sync-network-data/index.ts
// Täglicher Sync: Football Network Kontakte von Transfermarkt aktualisieren
// Felder: Verein, Logo, Position(en), Bereich (Herren/Nachwuchs), Liga, Mannschaft

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Nachwuchs-Erkennung: U23, U21, U19, U17, U16, U15, II, 2. Mannschaft etc.
const NACHWUCHS_PATTERNS = [
  /\bU\d{2}\b/i, /\bII\b/, /2\.\s*Mannschaft/i, /Jugend/i, /Nachwuchs/i,
  /NLZ/i, /Academy/i, /Youth/i, /Junior/i, /Reserve/i,
];

// Nachwuchs-Positionen
const NACHWUCHS_POSITIONS = [
  'NLZ-Leiter', 'Nachwuchskoordinator', 'Nachwuchstrainer', 'Jugendtrainer',
  'U23-Trainer', 'U21-Trainer', 'U19-Trainer', 'U17-Trainer', 'U16-Trainer',
];

function isNachwuchs(verein: string, funktion: string, mannschaft: string): string {
  const combined = `${verein} ${funktion} ${mannschaft}`.toLowerCase();
  // Positionen die immer Nachwuchs sind
  for (const pos of NACHWUCHS_POSITIONS) {
    if (combined.includes(pos.toLowerCase())) return 'Nachwuchs';
  }
  // Vereins-/Mannschaftsname enthält U-Jugend Pattern
  for (const pattern of NACHWUCHS_PATTERNS) {
    if (pattern.test(verein) || pattern.test(mannschaft)) return 'Nachwuchs';
  }
  // Alles andere = Herren
  return 'Herren';
}

async function fetchTrainerProfile(url: string): Promise<any> {
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

    // Verein (aus data-header__club)
    const clubMatch = html.match(/data-header__club"[^>]*>\s*<a\s+title="([^"]+)"/);
    if (clubMatch) profile.verein = clubMatch[1];

    // Logo
    const logoMatch = html.match(/tmssl\.akamaized\.net\/\/images\/wappen\/(?:normquad|small|big)\/(\d+)\.png/);
    if (logoMatch) profile.logoUrl = `https://tmssl.akamaized.net//images/wappen/big/${logoMatch[1]}.png`;

    // Alle aktiven Stationen extrahieren (Amtsaustritt = "-")
    const positions = new Set<string>();
    const mannschaften = new Set<string>();
    let hasNachwuchs = false;

    const stationRows = html.split(/<tr class="ausfallzeiten_k">/);
    for (const row of stationRows) {
      const cells = row.match(/<td class="zentriert">([^<]*)<\/td>/g);
      if (cells && cells.length >= 2) {
        const amtsaustritt = cells[1].replace(/<[^>]*>/g, '').trim();
        if (amtsaustritt === '-') {
          // Funktion
          const funktionMatch = row.match(/<br\s*\/?>\s*([^<]+)<\/td>/);
          if (funktionMatch) {
            const funktion = funktionMatch[1].trim();
            if (funktion && funktion !== '-') positions.add(funktion);
          }
          // Vereinsname der Station → Mannschaft extrahieren
          const stationClub = row.match(/title="([^"]+)"[^>]*href="[^"]*\/startseite\/verein/);
          if (stationClub) {
            const clubName = stationClub[1];
            const mMatch = clubName.match(/\b(U\d{2}|II|Jugend)\b/i);
            if (mMatch) {
              mannschaften.add(mMatch[0]);
              hasNachwuchs = true;
            }
            // "2. Mannschaft" oder "Reserve"
            if (/2\.\s*Mannschaft|Reserve/i.test(clubName)) {
              mannschaften.add('II');
              hasNachwuchs = true;
            }
          }
        }
      }
    }

    // Fallback: Hauptfunktion aus Header
    if (positions.size === 0) {
      const headerFunktion = html.match(/data-header__label">\s*<b>\s*([^<]+)/);
      if (headerFunktion) positions.add(headerFunktion[1].trim());
    }
    profile.position = Array.from(positions).join(', ');

    // Mannschaft
    if (mannschaften.size > 0) {
      // Sortieren: II, U23, U19, U17, U16, U15, Jugend
      const order = ['II', 'U23', 'U21', 'U19', 'U17', 'U16', 'U15', 'U14', 'Jugend'];
      const sorted = Array.from(mannschaften).sort((a, b) => {
        const ia = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
        const ib = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
        return ia - ib;
      });
      profile.mannschaft = sorted.join(', ');
    } else {
      profile.mannschaft = '1. Mannschaft';
    }

    // Bereich: Nachwuchs wenn irgendeine aktive Station U-Jugend/II/Jugend ist
    // Auch Positionen prüfen
    if (!hasNachwuchs) {
      const posLower = profile.position.toLowerCase();
      hasNachwuchs = NACHWUCHS_POSITIONS.some(p => posLower.includes(p.toLowerCase())) ||
        /nachwuchs|jugend|nlz|academy|youth/i.test(profile.position);
    }
    profile.bereich = hasNachwuchs ? 'Nachwuchs' : 'Herren';

    // Verein bereinigen (Hauptverein ohne U-Suffix)
    if (profile.verein) {
      profile.vereinClean = profile.verein
        .replace(/\s*U\d{2}\b/, '')
        .replace(/\s*II\b/, '')
        .replace(/\s*2\.\s*Mannschaft/, '')
        .replace(/\s*Jugend\b/, '')
        .trim();
    }

    // Liga
    const leagueMatch = html.match(/data-header__league[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    if (leagueMatch) {
      const leagueText = leagueMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      // Land aus Flagge
      const countryMatch = html.match(/data-header__league[\s\S]*?title="([^"]+)"[^>]*class="flaggenrahmen"/);
      const country = countryMatch ? countryMatch[1] : '';
      profile.liga = country && country !== 'Deutschland' ? `${leagueText} (${country})` : leagueText;
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
      throw new Error("Missing env vars");
    }

    let fast = false;
    try { const body = await req.json(); fast = body?.fast === true; } catch {}

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Alle Kontakte mit TM-URL laden
    const { data: contacts, error } = await supabase
      .from("football_network_contacts")
      .select("id, vorname, nachname, transfermarkt_url")
      .not("transfermarkt_url", "is", null)
      .neq("transfermarkt_url", "");

    if (error || !contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, total: 0, message: "Keine Kontakte mit TM-URL" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${contacts.length} network contacts...`);
    let synced = 0;
    const errors: string[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const name = `${contact.vorname} ${contact.nachname}`.trim();
      console.log(`[${i + 1}/${contacts.length}] ${name}`);

      const profile = await fetchTrainerProfile(contact.transfermarkt_url);

      if (profile && (profile.verein || profile.position)) {
        const updateData: any = {};
        if (profile.vereinClean || profile.verein) updateData.verein = profile.vereinClean || profile.verein;
        if (profile.position) updateData.position = profile.position;
        if (profile.bereich) updateData.bereich = profile.bereich;
        if (profile.liga) updateData.liga = profile.liga;
        if (profile.mannschaft) updateData.mannschaft = profile.mannschaft;

        const { error: updateError } = await supabase
          .from("football_network_contacts")
          .update(updateData)
          .eq("id", contact.id);

        if (updateError) {
          errors.push(`${name}: ${updateError.message}`);
        } else {
          synced++;
          console.log(`  ✓ ${name}: ${profile.vereinClean || profile.verein} - ${profile.position} (${profile.bereich})`);
        }

        // Logo speichern
        if ((profile.vereinClean || profile.verein) && profile.logoUrl) {
          await supabase
            .from("club_logos")
            .upsert({ club_name: profile.vereinClean || profile.verein, logo_url: profile.logoUrl }, { onConflict: 'club_name' });
        }
      } else {
        errors.push(`${name}: Kein Profil gefunden`);
      }

      if (i < contacts.length - 1) {
        const delay = fast ? 500 : (30000 + Math.random() * 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const result = { synced, total: contacts.length, errors: errors.length > 0 ? errors : undefined, message: `${synced}/${contacts.length} Kontakte aktualisiert` };
    console.log("Network sync complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
