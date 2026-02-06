// supabase/functions/scrape-transfermarkt/index.ts
// Scraper für Transfermarkt Spielerdaten via Browserless.io
//
// Extrahiert:
// - Berater-Info (Name, Agentur)
// - Marktwert
// - Basis-Infos

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Browserless.io Token
const BROWSERLESS_TOKEN = Deno.env.get('BROWSERLESS_TOKEN') || ''

interface AgentInfo {
  agentName?: string
  agentCompany?: string
  agentUrl?: string
  hasAgent: boolean
}

interface PlayerDetails {
  name?: string
  dateOfBirth?: string
  age?: number
  nationality?: string
  currentClub?: string
  position?: string
  preferredFoot?: string
  height?: string
  marketValue?: string
  contractUntil?: string
  agent?: AgentInfo
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, action } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SCRAPE-TM] Action: ${action}, URL: ${url}`)

    // Prüfe ob Browserless konfiguriert ist
    if (!BROWSERLESS_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'BROWSERLESS_TOKEN not configured',
          agent: { hasAgent: false }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Scrape mit Browserless
    const result = await scrapeWithBrowserless(url, action)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SCRAPE-TM] Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function scrapeWithBrowserless(
  url: string,
  action: string
): Promise<{ success: boolean; agent?: AgentInfo; details?: PlayerDetails; error?: string }> {

  const browserlessUrl = `https://chrome.browserless.io/function?token=${BROWSERLESS_TOKEN}`

  // JavaScript Code der im Browser ausgeführt wird
  const scrapeCode = `
    module.exports = async ({ page }) => {
      // User-Agent setzen
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Zur Seite navigieren
      await page.goto('${url}', { waitUntil: 'networkidle2', timeout: 30000 });

      // Warte auf Hauptinhalt
      await page.waitForSelector('body', { timeout: 10000 });
      await page.waitForTimeout(2000); // Extra warten für dynamische Inhalte

      // Extrahiere Daten
      const data = await page.evaluate(() => {
        const result = {
          name: '',
          dateOfBirth: '',
          age: null,
          nationality: '',
          currentClub: '',
          position: '',
          preferredFoot: '',
          height: '',
          marketValue: '',
          contractUntil: '',
          agent: {
            agentName: '',
            agentCompany: '',
            agentUrl: '',
            hasAgent: false
          }
        };

        // Name aus Header
        const nameEl = document.querySelector('h1[data-header-label], .data-header__headline-wrapper');
        if (nameEl) {
          result.name = nameEl.textContent?.trim() || '';
        }

        // Marktwert
        const marketValueEl = document.querySelector('.tm-player-market-value-development__current-value');
        if (marketValueEl) {
          result.marketValue = marketValueEl.textContent?.trim() || '';
        }

        // Info-Tabelle durchsuchen
        const infoItems = document.querySelectorAll('.info-table__content, [class*="info-table"] li, .spielerdaten td');

        infoItems.forEach(item => {
          const text = item.textContent?.trim() || '';
          const label = item.previousElementSibling?.textContent?.trim().toLowerCase() || '';

          // Berater/Agent finden
          if (label.includes('berater') || label.includes('agent') || label.includes('player agent')) {
            const agentLink = item.querySelector('a');
            if (agentLink) {
              result.agent.agentName = agentLink.textContent?.trim() || '';
              result.agent.agentUrl = agentLink.href || '';
              result.agent.hasAgent = true;
            } else if (text && text !== '-' && text !== 'N/A') {
              result.agent.agentName = text;
              result.agent.hasAgent = true;
            }
          }

          // Andere Felder
          if (label.includes('geburt') || label.includes('birth')) {
            result.dateOfBirth = text;
          }
          if (label.includes('nation') || label.includes('country')) {
            result.nationality = text;
          }
          if (label.includes('verein') || label.includes('club')) {
            result.currentClub = text;
          }
          if (label.includes('position')) {
            result.position = text;
          }
          if (label.includes('fuß') || label.includes('foot')) {
            result.preferredFoot = text;
          }
          if (label.includes('größe') || label.includes('height')) {
            result.height = text;
          }
          if (label.includes('vertrag') || label.includes('contract')) {
            result.contractUntil = text;
          }
        });

        // Alternative Suche für Berater in verschiedenen Layouts
        if (!result.agent.hasAgent) {
          // Suche nach "Berater:" oder "Agent:" Text
          const allText = document.body.innerText;
          const agentMatch = allText.match(/(?:Berater|Spielerberater|Agent|Player agent)[:\\\\s]+([^\\\\n]+)/i);
          if (agentMatch && agentMatch[1] && agentMatch[1].trim() !== '-') {
            result.agent.agentName = agentMatch[1].trim();
            result.agent.hasAgent = true;
          }

          // Suche nach Links zu Berater-Profilen
          const agentLinks = document.querySelectorAll('a[href*="/berater/"], a[href*="/agent/"]');
          agentLinks.forEach(link => {
            const parent = link.parentElement;
            const parentText = parent?.textContent?.toLowerCase() || '';
            if (parentText.includes('berater') || parentText.includes('agent')) {
              result.agent.agentName = link.textContent?.trim() || '';
              result.agent.agentUrl = link.href || '';
              result.agent.hasAgent = true;
            }
          });
        }

        // Berater-Firma extrahieren (oft in Klammern oder als separate Info)
        if (result.agent.agentName) {
          const companyMatch = result.agent.agentName.match(/\\\\(([^)]+)\\\\)/);
          if (companyMatch) {
            result.agent.agentCompany = companyMatch[1];
            result.agent.agentName = result.agent.agentName.replace(/\\\\s*\\\\([^)]+\\\\)/, '').trim();
          }
        }

        return result;
      });

      return { success: true, details: data, agent: data.agent };
    };
  `

  try {
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: scrapeCode }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[BROWSERLESS] Error response:', errorText)
      throw new Error(`Browserless returned ${response.status}`)
    }

    const result = await response.json()
    return result

  } catch (error) {
    console.error('[BROWSERLESS] Error:', error.message)
    return { success: false, error: `Browserless error: ${error.message}` }
  }
}
