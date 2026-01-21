// supabase/functions/generate-pdf/index.ts
// Perfekte PDF-Generierung mit Browserless.io (Headless Chrome)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");

interface CareerEntry {
  club: string;
  league: string;
  from_date: string;
  to_date: string;
  stats: string;
  games?: string;
  goals?: string;
  assists?: string;
  is_current: boolean;
}

interface Player {
  first_name: string;
  last_name: string;
  photo_url: string;
  position: string;
  secondary_position: string;
  club: string;
  league: string;
  birth_date: string;
  nationality: string;
  height: number;
  strong_foot: string;
  contract_end: string;
  transfermarkt_url: string;
  strengths: string;
  listing: string;
  responsibility: string;
}

interface RequestBody {
  player: Player;
  careerEntries: CareerEntry[];
  playerDescription: string;
  advisorEmail?: string;
  advisorPhone?: string;
}

const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linke Außenbahn',
  'RA': 'Rechte Außenbahn',
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('.')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}.${month}.${year}`;
  }
  return dateStr;
}

function formatDateDE(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return '-';
  }
}

function generateHtml(player: Player, careerEntries: CareerEntry[], playerDescription: string, advisorEmail?: string, advisorPhone?: string): string {
  const birthDateFormatted = formatDateDE(player.birth_date);
  const contractEndFormatted = formatDateDE(player.contract_end);
  const age = calculateAge(player.birth_date);

  const responsibility = player.responsibility || '';
  const advisorNames = responsibility.split(/,\s*|&\s*/).map(s => s.trim()).filter(s => s);
  const advisorsHtml = advisorNames.length > 0
    ? advisorNames.map(name => `<div style="color: #fff !important; font-size: 13px;">${name}</div>`).join('')
    : '<div style="color: #fff !important; font-size: 13px;">-</div>';

  // Adresse basierend auf Listung
  const isKMH = !player.listing || player.listing.toLowerCase().includes('karl') || player.listing.toLowerCase().includes('kmh');
  const addressStreet = isKMH ? 'Klaußnerweg 6' : 'Hermann-Müller-Straße 22';
  const addressCity = isKMH ? '82061 Neuried' : '04416 Markkleeberg';

  // E-Mail: Immer basierend auf Listung (KMH oder PM)
  const email = isKMH ? 'office@kmhsport.com' : 'info@pm-sportmanagement.com';

  // Telefon: Berater-Telefon oder leer
  const phone = advisorPhone || '';

  const careerHtml = (careerEntries || []).map((entry, index) => {
    // Stats aus games/goals/assists oder stats-String generieren
    let statsDisplay = '';
    if (entry.games || entry.goals || entry.assists) {
      const parts = [];
      if (entry.games) parts.push(`${entry.games} Spiele`);
      if (entry.goals) parts.push(`${entry.goals} Tore`);
      if (entry.assists) parts.push(`${entry.assists} Assists`);
      statsDisplay = parts.join(' | ');
    } else if (entry.stats) {
      statsDisplay = entry.stats;
    }

    // Datum-Anzeige
    let dateDisplay = '';
    if (entry.is_current && entry.from_date) {
      dateDisplay = `Seit ${formatDate(entry.from_date)}`;
    } else if (entry.from_date && entry.to_date) {
      dateDisplay = `${formatDate(entry.from_date)} - ${formatDate(entry.to_date)}`;
    } else if (entry.from_date) {
      dateDisplay = `Seit ${formatDate(entry.from_date)}`;
    }

    return `
    <div style="display: flex; margin-bottom: 20px; position: relative;">
            <div style="width: 7px; height: 7px; border-radius: 50%; background-color: #888 !important; margin-top: 5px; margin-right: 10px; flex-shrink: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
      <div style="flex: 1;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 700; color: #1a202c;">${entry.club || ''}</div>
            <div style="font-size: 10px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-top: 4px;">${(entry.league || '').toUpperCase()}</div>
          </div>
          ${dateDisplay ? `<div style="border: 1px solid #ddd; padding: 2px 8px; border-radius: 4px; white-space: nowrap; flex-shrink: 0;">
            <span style="font-size: 10px; color: #666; font-weight: 500;">${dateDisplay}</span>
          </div>` : ''}
        </div>
        ${statsDisplay ? `<div style="background-color: #f7fafc !important; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #e2e8f0; margin-top: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"><span style="font-size: 11px; color: #4a5568;">${statsDisplay}</span></div>` : ''}
      </div>
    </div>
  `;
  }).join('');

  const strengthsHtml = player.strengths
    ? player.strengths.split(';').map(s => `<span style="background-color: #fff !important; border: 1px solid #ddd; padding: 5px 12px; border-radius: 8px; font-size: 12px; color: #333; margin-right: 6px; margin-bottom: 6px; display: inline-block; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${s.trim()}</span>`).join('')
    : '-';

  const positionFull = POSITION_MAP[player.position] || player.position || '';
  const secondaryPositions = player.secondary_position 
    ? player.secondary_position.split(',').map(p => POSITION_MAP[p.trim()] || p.trim()).join(', ')
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=794">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 0; }
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      width: 794px;
      height: 1123px;
      max-height: 1123px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      overflow: hidden;
    }
    a { color: #3182ce; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div style="width: 794px; height: 1123px; max-height: 1123px; background: #fff; overflow: hidden; position: relative;">
    <!-- Header -->
    <div style="position: relative; padding: 20px 32px; height: 210px; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; bottom: 0; width: 67%; background-color: #000000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
      <div style="position: absolute; top: 0; right: 0; bottom: 0; width: 33%; background-color: #1c1c1c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
      <div style="position: absolute; top: 0; bottom: 0; left: 63%; width: 80px; background-color: #1c1c1c !important; transform: skewX(-8deg); -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

      <div style="position: relative; z-index: 1; display: flex; align-items: center; height: 100%;">
        <div style="margin-right: 32px;">
          ${player.photo_url
            ? `<img src="${player.photo_url}" style="width: 140px; height: 180px; object-fit: cover; border: 1px solid #333;" crossorigin="anonymous" />`
            : `<div style="width: 140px; height: 180px; background-color: #333 !important; display: flex; align-items: center; justify-content: center; color: #666; -webkit-print-color-adjust: exact; print-color-adjust: exact;">Foto</div>`
          }
        </div>
        <div style="flex: 1;">
          <div style="font-size: 36px; font-weight: 800; color: #fff !important; letter-spacing: 3px; margin-bottom: 2px;">${((player.first_name || '') + ' ' + (player.last_name || '')).toUpperCase()}</div>
          <div style="font-size: 18px; color: #e2e8f0 !important; margin-bottom: 10px;">
            ${positionFull}
            ${secondaryPositions ? `<span style="color: #888 !important;"> · ${secondaryPositions}</span>` : ''}
          </div>
          <div style="display: inline-flex; align-items: center; background-color: rgba(255,255,255,0.12) !important; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <span style="color: #fff !important; font-size: 13px; font-weight: 500;">${player.club || '-'}</span>
            <span style="color: rgba(255,255,255,0.3) !important; font-size: 13px; margin: 0 10px;">|</span>
            <span style="color: #fff !important; font-size: 13px; font-weight: 500;">${player.league || '-'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div style="display: flex; padding: 16px 28px; max-height: 880px; overflow: hidden;">
      <!-- Left Column -->
      <div style="width: 260px; padding-right: 20px; flex-shrink: 0;">
        <!-- Spielerprofil Card -->
        <div style="background-color: #fafafa !important; border: 1px solid #e8e8e8; border-radius: 12px; padding: 16px; margin-bottom: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <div style="font-size: 15px; font-weight: 700; color: #1a202c; margin-bottom: 10px;">Spielerprofil</div>
          <div style="height: 1px; background-color: #ddd !important; margin-bottom: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

          <div style="margin-bottom: 10px;">
            <div style="font-size: 9px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">GEBURTSDATUM</div>
            <div style="font-size: 13px; color: #1a202c; font-weight: 600;">${birthDateFormatted} (${age})</div>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="font-size: 9px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">NATIONALITÄT</div>
            <div style="font-size: 13px; color: #1a202c; font-weight: 600;">${player.nationality || '-'}</div>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="font-size: 9px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">GRÖSSE</div>
            <div style="font-size: 13px; color: #1a202c; font-weight: 600;">${player.height ? `${player.height} cm` : '-'}</div>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="font-size: 9px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">FUSS</div>
            <div style="font-size: 13px; color: #1a202c; font-weight: 600;">${player.strong_foot || '-'}</div>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="font-size: 9px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">VERTRAG BIS</div>
            <div style="font-size: 13px; color: #1a202c; font-weight: 600;">${contractEndFormatted}</div>
          </div>
          
          <div>
            <div style="font-size: 9px; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">TRANSFERMARKT</div>
            ${player.transfermarkt_url 
              ? `<a href="${player.transfermarkt_url}" target="_blank" style="font-size: 13px; color: #3182ce; font-weight: 600; text-decoration: none;">Zum Profil →</a>`
              : `<div style="font-size: 13px; color: #1a202c; font-weight: 600;">-</div>`
            }
          </div>
        </div>

        <!-- Stärken Card -->
        <div style="background-color: #fafafa !important; border: 1px solid #e8e8e8; border-radius: 12px; padding: 16px; margin-bottom: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <div style="font-size: 15px; font-weight: 700; color: #1a202c; margin-bottom: 10px;">Stärken</div>
          <div style="height: 1px; background-color: #ddd !important; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
          <div>${strengthsHtml}</div>
        </div>

        <!-- Management Box -->
        <div style="background-color: #1a1a1a !important; border-radius: 12px; padding: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <div style="font-size: 14px; font-weight: 800; color: #fff !important; margin-bottom: 10px; letter-spacing: 0.5px;">${player.listing || 'Karl Herzog Sportmanagement'}</div>
          <div style="height: 1px; background-color: #333 !important; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

          <div style="margin-bottom: 8px;">
            <div style="font-size: 9px; color: #666 !important; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">ANSPRECHPARTNER</div>
            ${advisorsHtml}
          </div>

          <div style="margin-bottom: 8px;">
            <div style="font-size: 9px; color: #666 !important; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">E-MAIL</div>
            <div style="color: #fff !important; font-size: 12px;">${email}</div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="font-size: 9px; color: #666 !important; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">TELEFON</div>
            <div style="color: #fff !important; font-size: 12px;">${phone || '-'}</div>
          </div>

          <div>
            <div style="font-size: 9px; color: #666 !important; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px;">ADRESSE</div>
            <div style="color: #fff !important; font-size: 12px;">${addressStreet}</div>
            <div style="color: #fff !important; font-size: 12px;">${addressCity}</div>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div style="flex: 1; padding-left: 20px; border-left: 1px solid #e8e8e8; min-width: 0;">
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <div style="width: 4px; height: 18px; background-color: #1a1a1a !important; margin-right: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
          <div style="font-size: 16px; font-weight: 700; color: #1a202c;">Karriereverlauf der letzten Jahre</div>
        </div>

        ${careerHtml}

        ${playerDescription ? `
          <div style="margin-top: 60px; background-color: #f8f8f8 !important; padding: 12px; border-radius: 8px; border-left: 3px solid #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <div style="font-size: 12px; color: #333; line-height: 18px; font-style: italic;">${playerDescription}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Footer - absolut positioniert -->
    <div style="position: absolute; bottom: 12px; right: 28px;">
      <div style="border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; background: #fff;">
        <span style="font-size: 9px; color: #666; font-weight: 500;">Stand: ${new Date().toLocaleDateString('de-DE')}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("PDF Generation started");

    if (!BROWSERLESS_API_KEY) {
      console.error("BROWSERLESS_API_KEY is missing!");
      throw new Error("BROWSERLESS_API_KEY not configured");
    }
    console.log("BROWSERLESS_API_KEY is set");

    const { player, careerEntries, playerDescription, advisorEmail, advisorPhone }: RequestBody = await req.json();
    console.log("Received player:", player?.first_name, player?.last_name);

    if (!player) {
      return new Response(
        JSON.stringify({ error: "Player data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HTML generieren (exakt wie in der App-Vorschau)
    const html = generateHtml(player, careerEntries || [], playerDescription || '', advisorEmail, advisorPhone);
    console.log("HTML generated, length:", html.length);

    // Browserless.io API aufrufen
    console.log("Calling Browserless API...");
    const browserlessResponse = await fetch(
      `https://chrome.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: html,
          options: {
            format: "A4",
            printBackground: true,
            margin: {
              top: "0",
              right: "0",
              bottom: "0",
              left: "0",
            },
          },
          gotoOptions: {
            waitUntil: "networkidle0",
            timeout: 30000,
          },
        }),
      }
    );

    if (!browserlessResponse.ok) {
      const errorText = await browserlessResponse.text();
      console.error("Browserless error status:", browserlessResponse.status);
      console.error("Browserless error body:", errorText);
      throw new Error(`Browserless API error: ${browserlessResponse.status} - ${errorText.substring(0, 200)}`);
    }

    // PDF als ArrayBuffer holen
    const pdfBuffer = await browserlessResponse.arrayBuffer();
    
    // In Base64 konvertieren (Deno-safe Methode)
    const base64Pdf = base64Encode(new Uint8Array(pdfBuffer));

    return new Response(
      JSON.stringify({ 
        pdf: base64Pdf,
        filename: `Expose_${player.last_name || 'Spieler'}_${player.first_name || ''}.pdf`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("PDF Generation Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "PDF generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
