// supabase/functions/telegram-link-code/index.ts
// Generiert einen kurzlebigen Linking-Code für den eingeloggten Berater.
// Der Berater schickt dann "/link <CODE>" an den Telegram-Bot — dieser
// trägt das Mapping advisor_id → telegram_chat_id in advisor_telegram_links ein.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Base32 ohne Zweideutigkeiten (0/O, 1/I/L weggelassen)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateCode(len = 8): string {
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error("Missing env");
    }

    // Auth via User-JWT — wir bekommen advisor_id aus dem Token
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const advisorId = userData.user.id;

    // Optional: prüfen ob der User wirklich ein Berater ist
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: advisor } = await sb.from("advisors").select("id").eq("id", advisorId).maybeSingle();
    if (!advisor) {
      return new Response(JSON.stringify({ error: "Nicht als Berater registriert" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bestehende, noch unbenutzte Codes des Advisors auf used_at setzen (ein Code aktiv pro Berater)
    await sb
      .from("telegram_link_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("advisor_id", advisorId)
      .is("used_at", null);

    // Neuen Code generieren — bei sehr unwahrscheinlichem Kollisionsfall retry
    let code = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      code = generateCode(8);
      const { error: insertErr } = await sb.from("telegram_link_codes").insert({
        code,
        advisor_id: advisorId,
      });
      if (!insertErr) break;
      code = "";
    }
    if (!code) {
      return new Response(JSON.stringify({ error: "Konnte Code nicht erzeugen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        code,
        expires_in_minutes: 15,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("telegram-link-code error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
