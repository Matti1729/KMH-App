// supabase/functions/parse-contract/index.ts
// Vertrags-PDF per Claude API analysieren und strukturierte Gehaltsdaten extrahieren

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const PARSE_PROMPT = `Du bist ein Experte für deutsche Fußball-Verträge, insbesondere Nachwuchsverträge.
Analysiere das beigefügte PDF-Dokument und extrahiere die folgenden Informationen als JSON.

Antworte NUR mit einem validen JSON-Objekt, ohne zusätzlichen Text oder Markdown-Formatierung.

Extrahiere:
1. contract_type: Art des Vertrags ("Vereinbarung", "Fördervertrag", "Arbeitsvertrag", oder "Sonstiges")
2. contract_start: Vertragsbeginn als ISO-Datum (YYYY-MM-DD), z.B. "2024-07-01". Null wenn nicht gefunden.
3. contract_end: Vertragsende als ISO-Datum (YYYY-MM-DD), z.B. "2026-06-30". Null wenn nicht gefunden.
4. salary_periods: Array von Gehaltsperioden, chronologisch geordnet. Jede Periode hat:
   - from_date: Startdatum (ISO)
   - to_date: Enddatum (ISO) oder null
   - amount: NUR die Zahl mit €-Zeichen, OHNE brutto/netto/mind./max. Beispiele: "250€", "350€", "1.500€"
   - description: Kurze Beschreibung, z.B. "Taschengeld", "Grundgehalt 1. Jahr", "Grundgehalt 2. Jahr"
5. bonuses: Array von Prämien. Jede Prämie hat:
   - type: Einer von:
     * "point" — NUR Punktprämie für LIGA-Spiele (z.B. pro Punkt in der Liga, pro Ligasieg). NICHT für Pokalspiele oder Länderspiele.
     * "appearance" — NUR Auflaufprämie/Einsatzprämie für LIGA-Spiele (z.B. pro Ligaspiel, pro Ligaeinsatz). NICHT für Pokalspiele oder Länderspiele.
     * "international" — Länderspielprämie (z.B. pro U15/U16/U17 Länderspiel)
     * "other" — Alle sonstigen Prämien: DFB-Pokal-Prämien, Aufstiegsprämien, Titelprämien, etc.
   - amount: Betrag als String, z.B. "100€ brutto"
   - description: Beschreibung, z.B. "pro U15 Länderspiel", "pro Ligaspiel", "DFB-Pokal Sieg"
6. contract_end_without_option: Falls der Vertrag eine Verlängerungsoption enthält, gib hier das Vertragsende OHNE Option an (ISO-Datum). Null wenn keine Option vorhanden oder identisch mit contract_end.
7. notes: Sonstige relevante Informationen (Sonderbedingungen, Optionen, Sachleistungen etc.) als Text oder null.

Wichtig:
- Bei Gehaltssteigerungen über die Vertragslaufzeit (z.B. 1. Jahr 350€, 2. Jahr 400€, 3. Jahr 450€), erstelle separate salary_periods für jede Stufe.
- Verwende immer deutsche Saisonzeiträume: 01.07. bis 30.06.
- Wenn keine Gehaltsinformationen vorhanden sind, gib ein leeres salary_periods Array zurück.
- Wenn keine Prämien gefunden werden, gib ein leeres bonuses Array zurück.
- Beachte den Unterschied zwischen brutto und netto - übernimm genau was im Vertrag steht.
- "point" und "appearance" Prämien sind AUSSCHLIESSLICH für reguläre Liga-Spiele. DFB-Pokal, Länderspiele und sonstige Wettbewerbe gehören zu "other" bzw. "international".
- contract_end ist IMMER das Vertragsende OHNE Option. Falls eine Option den Vertrag verlängern kann, gib das verlängerte Enddatum in den notes an.

JSON-Antwort:`;

interface RequestBody {
  pdf_url: string;
  storage_path?: string;
  player_name?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("parse-contract called");

    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is missing!");
      return new Response(
        JSON.stringify({ parsed: null, error: "ANTHROPIC_API_KEY nicht konfiguriert." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { pdf_url, player_name }: RequestBody = await req.json();
    console.log("PDF URL received:", pdf_url?.substring(0, 80) + "...");
    if (player_name) console.log("Player:", player_name);

    if (!pdf_url) {
      return new Response(
        JSON.stringify({ parsed: null, error: "Keine PDF-URL angegeben." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. PDF herunterladen
    console.log("Downloading PDF...");
    const pdfResponse = await fetch(pdf_url);
    if (!pdfResponse.ok) {
      console.error("PDF download failed:", pdfResponse.status);
      return new Response(
        JSON.stringify({ parsed: null, error: "PDF konnte nicht heruntergeladen werden." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Größencheck (max 30MB)
    if (pdfBytes.length > 30 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ parsed: null, error: "PDF ist zu groß (max. 30MB)." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBase64 = base64Encode(pdfBytes);
    console.log("PDF downloaded, size:", pdfBytes.length, "bytes");

    // 2. An Claude API senden (mit Retry bei Rate Limit)
    const MAX_RETRIES = 3;
    let claudeResponse: Response | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      console.log(`Sending to Claude API... (Versuch ${attempt + 1}/${MAX_RETRIES})`);
      claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: pdfBase64,
                  },
                },
                {
                  type: "text",
                  text: PARSE_PROMPT,
                },
              ],
            },
          ],
        }),
      });

      if (claudeResponse.status === 429 && attempt < MAX_RETRIES - 1) {
        const retryAfter = parseInt(claudeResponse.headers.get("retry-after") || "0") || (attempt + 1) * 5;
        console.log(`Rate limit (429), warte ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      break;
    }

    if (!claudeResponse || !claudeResponse.ok) {
      const errorText = claudeResponse ? await claudeResponse.text() : "Keine Antwort";
      console.error("Claude API error:", claudeResponse?.status, errorText);
      return new Response(
        JSON.stringify({ parsed: null, error: `Claude API Fehler: ${claudeResponse?.status || 'unbekannt'}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || "";
    console.log("Claude response received, length:", responseText.length);

    if (!responseText) {
      return new Response(
        JSON.stringify({ parsed: null, error: "Keine Antwort von Claude erhalten." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. JSON parsen (Claude könnte Markdown-Codeblöcke verwenden)
    let parsed;
    try {
      const jsonStr = responseText.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw text:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ parsed: null, error: "Vertragsanalyse konnte nicht verarbeitet werden." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Grundlegende Validierung
    if (!parsed.salary_periods) parsed.salary_periods = [];
    if (!parsed.bonuses) parsed.bonuses = [];

    console.log("Parse successful:", parsed.contract_type, "Periods:", parsed.salary_periods.length, "Bonuses:", parsed.bonuses.length);

    return new Response(
      JSON.stringify({ parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fehler:", error);
    return new Response(
      JSON.stringify({ parsed: null, error: `Fehler: ${error.message}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
