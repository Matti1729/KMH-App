// supabase/functions/parse-provision/index.ts
// Provisionsvereinbarungs-PDF per Claude API analysieren und strukturierte Daten extrahieren

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const PARSE_PROMPT = `Du bist ein Experte für Provisionsvereinbarungen im deutschen Fußball (Spielerberater/Agenturen).
Analysiere das beigefügte PDF-Dokument und extrahiere die folgenden Informationen als JSON.

Antworte NUR mit einem validen JSON-Objekt, ohne zusätzlichen Text oder Markdown-Formatierung.

Extrahiere:
1. provision_basis: Wie wird die Provision berechnet? Einer der folgenden Werte:
   - "prozent_jahresgehalt": Prozentsatz vom Jahresgehalt/Jahreseinkommen (z.B. "10% des Jahresbruttogehalts")
   - "bruttomonatsgehalt": Anzahl Bruttomonatsgehälter (z.B. "ein Bruttomonatsgehalt", "2 Monatsgehälter")
   - "festbetrag": Fester Betrag unabhängig vom Gehalt (z.B. "5.000 EUR Provision")
   - "sonstiges": Andere Berechnungsgrundlage
2. provision_percent: Provisionssatz in Prozent als Zahl (z.B. 10). Nur relevant bei basis "prozent_jahresgehalt". Null wenn nicht zutreffend.
3. provision_salary_months: Anzahl der Bruttomonatsgehälter als Zahl (z.B. 1 oder 2). Nur relevant bei basis "bruttomonatsgehalt". Null wenn nicht zutreffend.
4. total_amount: Gesamtsumme der Provision als Zahl (z.B. 15000). Null wenn die Summe vom Gehalt abhängt und nicht explizit genannt wird.
5. currency: Währung als String ("EUR" oder "USD"). Standard: "EUR".
6. rate_count: Anzahl der Raten/Zahlungen als Zahl. Null wenn nicht spezifiziert oder Einmalzahlung.
7. rates: Array von Zahlungsraten, chronologisch geordnet. Jede Rate hat:
   - amount: Betrag als Zahl (z.B. 5000). Null wenn vom Gehalt abhängig.
   - due_date: Fälligkeitsdatum als ISO-Datum (YYYY-MM-DD). Null wenn nicht spezifiziert.
   - description: Kurze Beschreibung (z.B. "1. Rate", "Rate bei Vertragsabschluss", "Rate zum 01.01.2025")
8. notes: Sonstige relevante Informationen (Sonderbedingungen, Zahlungsmodalitäten, etc.) als Text oder null.

Wichtig:
- Erkenne typische Formulierungen: "Beraterprovision", "Vermittlungsprovision", "Honorar", "Vergütung".
- "ein Bruttomonatsgehalt" / "1 Monatsgehalt" → basis: "bruttomonatsgehalt", provision_salary_months: 1
- "10% des Jahresgehalts" / "10% der Bruttobezüge" → basis: "prozent_jahresgehalt", provision_percent: 10
- "5.000 EUR" als fester Betrag → basis: "festbetrag", total_amount: 5000
- Wenn Fälligkeitsdaten genannt werden (z.B. "jeweils zum 1. des Monats", "zum 01.07.2025", "bei Vertragsabschluss"), extrahiere diese.
- Bei Ratenzahlungen ohne explizite Beträge und bekannter Gesamtsumme, teile gleichmäßig auf.
- Wenn die Provision vom Gehalt abhängt (prozent oder bruttomonatsgehalt), kann total_amount null sein.

JSON-Antwort:`;

interface RequestBody {
  pdf_url: string;
  player_name?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("parse-provision called");

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

    // 1. PDF herunterladen (mit 30s Timeout)
    console.log("Downloading PDF...");
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), 30000);
    const pdfResponse = await fetch(pdf_url, { signal: dlController.signal });
    clearTimeout(dlTimeout);
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

    // 2. An Claude API senden (mit Retry bei Rate Limit, 120s Timeout pro Versuch)
    const MAX_RETRIES = 2;
    let claudeResponse: Response | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      console.log(`Sending to Claude API... (Versuch ${attempt + 1}/${MAX_RETRIES})`);
      const apiController = new AbortController();
      const apiTimeout = setTimeout(() => apiController.abort(), 90000);
      claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: apiController.signal,
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
      clearTimeout(apiTimeout);

      if (claudeResponse.status === 429 && attempt < MAX_RETRIES - 1) {
        const retryAfter = parseInt(claudeResponse.headers.get("retry-after") || "0") || (attempt + 1) * 2;
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
        JSON.stringify({ parsed: null, error: "Provisionsanalyse konnte nicht verarbeitet werden." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Grundlegende Validierung
    if (!parsed.rates) parsed.rates = [];

    console.log("Parse successful: percent:", parsed.provision_percent, "total:", parsed.total_amount, "rates:", parsed.rates.length);

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
