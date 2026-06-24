// supabase/functions/update-player-email/index.ts
// Ändert die Login-E-Mail des eingeloggten Spielers OHNE Bestätigungs-Mail
// (Admin-Override via Service-Role) und synchronisiert die Kontakt-E-Mail
// (player_details.email_player). Der Spieler kann nur seine EIGENE E-Mail ändern
// (uid kommt aus dem JWT).

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) throw new Error("Missing env");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: "Ungültige E-Mail-Adresse." });
    }

    // Eingeloggten Spieler aus dem JWT ermitteln.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const uid = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Login-E-Mail direkt setzen (email_confirm: true -> keine Bestätigungs-Mail).
    const { error: updErr } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true });
    if (updErr) {
      const msg = /already|registered|exist|duplicate/i.test(updErr.message || "")
        ? "Diese E-Mail wird bereits verwendet."
        : (updErr.message || "E-Mail konnte nicht geändert werden.");
      return json({ success: false, error: msg });
    }

    // Kontakt-E-Mail auf dem Spieler-Datensatz synchronisieren.
    await admin.from("player_details").update({ email_player: email }).eq("linked_user_id", uid);

    return json({ success: true, email });
  } catch (e) {
    return json({ success: false, error: (e && (e as { message?: string }).message) || String(e) }, 500);
  }
});
