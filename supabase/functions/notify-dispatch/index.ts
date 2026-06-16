// supabase/functions/notify-dispatch/index.ts
// Liest unsent Einträge aus notification_outbox, broadcastet sie als Telegram-Nachricht
// an alle in advisor_telegram_links verlinkten Chats und markiert sie als sent.
// Wird vom pg_cron "notify-dispatch-5min" alle 5 Minuten getriggert.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OutboxRow = {
  id: string;
  event_type: "birthday" | "club_change" | "new_player";
  payload: any;
};

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMessage(row: OutboxRow): string {
  const p = row.payload || {};
  const fullName = `${escapeHtml(p.first_name || "")} ${escapeHtml(p.last_name || "")}`.trim() || "Unbekannt";
  switch (row.event_type) {
    case "birthday": {
      const age = p.age ? ` wird heute <b>${escapeHtml(String(p.age))}</b>` : " hat heute Geburtstag";
      return `🎂 <b>Geburtstag</b>\n${fullName}${age}.`;
    }
    case "club_change": {
      const oldClub = escapeHtml(p.old_club || "—");
      const newClub = escapeHtml(p.new_club || "—");
      return `🔄 <b>Vereinswechsel</b>\n${fullName}\n${oldClub} → <b>${newClub}</b>`;
    }
    case "new_player": {
      const club = p.club ? ` (${escapeHtml(p.club)})` : "";
      return `➕ <b>Neuer Spieler</b>\n${fullName}${club}`;
    }
    default:
      return `ℹ️ ${fullName}`;
  }
}

async function sendTelegram(chatId: number, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${body.substring(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing env: TELEGRAM_BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Pending Outbox laden (max 200 pro Tick, ältesten zuerst)
    const { data: pending, error: pendErr } = await sb
      .from("notification_outbox")
      .select("id, event_type, payload")
      .is("sent_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (pendErr) {
      console.error("Outbox-Read-Error:", pendErr);
      return new Response(JSON.stringify({ ok: false, error: pendErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Verlinkte Chats laden (Broadcast — alle bekommen alles)
    const { data: links, error: linkErr } = await sb
      .from("advisor_telegram_links")
      .select("telegram_chat_id");

    if (linkErr) {
      console.error("Links-Read-Error:", linkErr);
      return new Response(JSON.stringify({ ok: false, error: linkErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatIds: number[] = (links || []).map((l: any) => Number(l.telegram_chat_id)).filter((n: number) => !isNaN(n));

    // Wenn niemand verlinkt ist: Outbox trotzdem als sent markieren — sonst stauen sich Einträge auf,
    // die nie zugestellt werden können.
    if (chatIds.length === 0) {
      const ids = pending.map((r: any) => r.id);
      await sb
        .from("notification_outbox")
        .update({ sent_at: new Date().toISOString(), error: "no recipients" })
        .in("id", ids);
      return new Response(JSON.stringify({ ok: true, processed: pending.length, recipients: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Pro Outbox-Eintrag: an alle Chats senden. Wenn mindestens einer erfolgreich → als sent markieren.
    //    Bei reinen Fehlern: error-Spalte setzen, sent_at NULL lassen (wird beim nächsten Tick erneut versucht).
    let processed = 0;
    for (const row of pending as OutboxRow[]) {
      const text = formatMessage(row);
      const results = await Promise.all(chatIds.map((id) => sendTelegram(id, text)));
      const anyOk = results.some((r) => r.ok);
      const firstErr = results.find((r) => !r.ok)?.error;

      if (anyOk) {
        await sb
          .from("notification_outbox")
          .update({ sent_at: new Date().toISOString(), error: firstErr ?? null })
          .eq("id", row.id);
        processed++;
      } else {
        await sb
          .from("notification_outbox")
          .update({ error: firstErr ?? "send failed" })
          .eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, recipients: chatIds.length, total: pending.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("notify-dispatch error:", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
