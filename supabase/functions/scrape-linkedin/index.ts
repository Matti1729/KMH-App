// supabase/functions/scrape-linkedin/index.ts
// LinkedIn-Profil via Voyager API (internes API) mit Session-Cookie

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINKEDIN_COOKIE = Deno.env.get("LINKEDIN_COOKIE") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || !url.includes("linkedin.com")) {
      return new Response(
        JSON.stringify({ error: "Valid LinkedIn URL required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LINKEDIN_COOKIE) {
      return new Response(
        JSON.stringify({ error: "LINKEDIN_COOKIE not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Public identifier aus URL extrahieren (z.B. "lukas-müller-3abb60234")
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Could not extract profile ID from URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const profileId = decodeURIComponent(match[1]);
    console.log("[SCRAPE-LI] Profile ID:", profileId);

    // 1. Erst CSRF-Token holen (JSESSIONID Cookie)
    const csrfResp = await fetch("https://www.linkedin.com/", {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Cookie": `li_at=${LINKEDIN_COOKIE}`,
      },
      redirect: "manual",
    });

    let csrfToken = "";
    const setCookies = csrfResp.headers.get("set-cookie") || "";
    const jsessionMatch = setCookies.match(/JSESSIONID="?([^";]+)/);
    if (jsessionMatch) csrfToken = jsessionMatch[1].replace(/"/g, "");
    console.log("[SCRAPE-LI] CSRF token:", csrfToken ? "found" : "missing");

    // 2. Voyager API: Profil laden
    const apiUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(profileId)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-19`;

    const apiResp = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/vnd.linkedin.normalized+json+2.1",
        "Cookie": `li_at=${LINKEDIN_COOKIE}; JSESSIONID="${csrfToken}"`,
        "csrf-token": csrfToken,
        "x-li-lang": "de_DE",
        "x-restli-protocol-version": "2.0.0",
      },
    });

    console.log(`[SCRAPE-LI] API status: ${apiResp.status}`);

    if (!apiResp.ok) {
      // Fallback: Title-Tag aus der HTML-Seite parsen
      console.log("[SCRAPE-LI] API failed, trying HTML fallback...");
      const htmlResp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Cookie": `li_at=${LINKEDIN_COOKIE}`,
        },
      });
      if (htmlResp.ok) {
        const html = await htmlResp.text();
        const result = parseTitleFallback(html);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ company: "", position: "", error: `API: ${apiResp.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await apiResp.json();
    let company = "";
    let position = "";

    // Profil-Daten aus Voyager API extrahieren
    if (data.included && Array.isArray(data.included)) {
      for (const item of data.included) {
        // Headline
        if (item.headline && !position) {
          const headline = item.headline;
          const beiMatch = headline.match(/^(.+?)\s+(?:bei|at|@)\s+(.+)$/i);
          if (beiMatch) {
            position = beiMatch[1].trim();
            company = beiMatch[2].trim();
          } else {
            position = headline;
          }
        }
        // Current company from positions
        if (item.$type === "com.linkedin.voyager.dash.identity.profile.Position" ||
            item["*company"] || item.companyName) {
          if (item.companyName && !company) company = item.companyName;
          if (item.title && !position) position = item.title;
        }
      }
    }

    // Fallback: elements array
    if ((!company || !position) && data.elements && Array.isArray(data.elements)) {
      for (const el of data.elements) {
        if (el.headline) {
          const headline = el.headline;
          const beiMatch = headline.match(/^(.+?)\s+(?:bei|at|@)\s+(.+)$/i);
          if (beiMatch) {
            if (!position) position = beiMatch[1].trim();
            if (!company) company = beiMatch[2].trim();
          }
        }
      }
    }

    company = company.replace(/\s+/g, " ").trim();
    position = position.replace(/\s+/g, " ").trim();

    console.log(`[SCRAPE-LI] Result: company="${company}", position="${position}"`);

    return new Response(
      JSON.stringify({ company, position }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SCRAPE-LI] Error:", error.message);
    return new Response(
      JSON.stringify({ company: "", position: "", error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseTitleFallback(html: string): { company: string; position: string } {
  let company = "";
  let position = "";

  // Title: "Lukas Müller – Trainer – SV Verein | LinkedIn"
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    const parts = titleMatch[1].split(/\s*[–\-]\s*/);
    if (parts.length >= 3) {
      position = parts[1].trim();
      company = parts[2].replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    }
  }

  // Meta description
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
  if (metaMatch && (!position || !company)) {
    const desc = metaMatch[1];
    const beiMatch = desc.match(/(?:als|as)\s+(.+?)\s+(?:bei|at)\s+([^.]+)/i);
    if (beiMatch) {
      if (!position) position = beiMatch[1].trim();
      if (!company) company = beiMatch[2].trim();
    }
  }

  return { company, position };
}
