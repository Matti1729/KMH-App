// supabase/functions/telegram-bot/index.ts
// Telegram Bot Webhook: Nachrichten empfangen, per Claude parsen, Daten in DB eintragen

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Erlaubte Telegram User-IDs (Whitelist)
const ALLOWED_USER_IDS = Deno.env.get("TELEGRAM_ALLOWED_USERS")
  ?.split(",")
  .map((id) => parseInt(id.trim()))
  .filter((id) => !isNaN(id)) || [];

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const SYSTEM_PROMPT = `Du bist ein Assistent für eine Spielerberater-App (Fußball). Du erhältst Nachrichten per Telegram und musst entscheiden, welche Aktion ausgeführt werden soll.

Antworte IMMER mit einem JSON-Objekt. Kein zusätzlicher Text, kein Markdown.

Mögliche Aktionen:

1. **spieler_notiz** - Eine Notiz/Info zu einem Spieler speichern
{
  "action": "spieler_notiz",
  "player_name": "Vorname Nachname",
  "notiz": "Die Information die gespeichert werden soll"
}

2. **transfer_info** - Transfer/Vereinswechsel-Info
{
  "action": "transfer_info",
  "player_name": "Vorname Nachname",
  "von_verein": "Aktueller Verein oder null",
  "zu_verein": "Zielverein oder null",
  "details": "Weitere Details"
}

3. **termin** - Einen Termin/Reminder erstellen
{
  "action": "termin",
  "titel": "Titel des Termins",
  "datum": "YYYY-MM-DD",
  "zeit": "HH:MM oder null",
  "details": "Weitere Details oder null"
}

4. **scouting_notiz** - Notiz zu einem gescouteten Spieler
{
  "action": "scouting_notiz",
  "player_name": "Vorname Nachname",
  "verein": "Verein oder null",
  "position": "Position oder null",
  "bewertung": "Zahl 1-10 oder null",
  "notiz": "Beobachtungen"
}

5. **frage** - Wenn der User eine Frage stellt oder die Nachricht keine Aktion erfordert
{
  "action": "frage",
  "antwort": "Deine hilfreiche Antwort auf die Frage"
}

Regeln:
- Interpretiere die Nachricht im Kontext von Fußball-Spielerberatung
- Bei Spielernamen: Versuche Vor- und Nachname zu trennen
- Bei Datums-Angaben: Konvertiere zu YYYY-MM-DD (heutiges Datum: HEUTE_DATUM)
- Bei mehrdeutigen Nachrichten: Frage nach (action: "frage")
- Antworte NUR mit JSON, nichts anderes`;

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

async function parseWithClaude(message: string): Promise<any> {
  const today = new Date().toISOString().split("T")[0];
  const prompt = SYSTEM_PROMPT.replace("HEUTE_DATUM", today);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: message }],
      system: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // JSON aus der Antwort extrahieren
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Kein JSON in Claude-Antwort gefunden");
  }

  return JSON.parse(jsonMatch[0]);
}

async function handleAction(supabase: any, action: any, chatId: number) {
  switch (action.action) {
    case "spieler_notiz": {
      // Spieler suchen
      const nameParts = action.player_name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      const { data: players } = await supabase
        .from("player_details")
        .select("id, first_name, last_name")
        .or(`and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%)`);

      if (!players || players.length === 0) {
        await sendTelegramMessage(chatId,
          `⚠️ Spieler "${action.player_name}" nicht gefunden.\n\nNotiz trotzdem gespeichert als allgemeine Info.`
        );
        return;
      }

      const player = players[0];
      // Notiz in notes-Feld anhängen
      const { data: current } = await supabase
        .from("player_details")
        .select("notes")
        .eq("id", player.id)
        .single();

      const existingNotes = current?.notes || "";
      const timestamp = new Date().toLocaleDateString("de-DE");
      const newNotes = existingNotes
        ? `${existingNotes}\n\n[${timestamp} via Telegram] ${action.notiz}`
        : `[${timestamp} via Telegram] ${action.notiz}`;

      await supabase
        .from("player_details")
        .update({ notes: newNotes })
        .eq("id", player.id);

      await sendTelegramMessage(chatId,
        `✅ Notiz für <b>${player.first_name} ${player.last_name}</b> gespeichert:\n\n${action.notiz}`
      );
      break;
    }

    case "transfer_info": {
      const nameParts = action.player_name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      const { data: players } = await supabase
        .from("player_details")
        .select("id, first_name, last_name, club, notes")
        .or(`and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%)`);

      if (!players || players.length === 0) {
        await sendTelegramMessage(chatId,
          `⚠️ Spieler "${action.player_name}" nicht gefunden.`
        );
        return;
      }

      const player = players[0];
      const timestamp = new Date().toLocaleDateString("de-DE");
      const transferNote = `[${timestamp} via Telegram] Transfer-Info: ${action.von_verein ? `Von ${action.von_verein}` : ""} ${action.zu_verein ? `→ ${action.zu_verein}` : ""}. ${action.details || ""}`.trim();

      const existingNotes = player.notes || "";
      const newNotes = existingNotes
        ? `${existingNotes}\n\n${transferNote}`
        : transferNote;

      const updateData: any = { notes: newNotes };
      if (action.zu_verein) {
        updateData.future_club = action.zu_verein;
      }

      await supabase
        .from("player_details")
        .update(updateData)
        .eq("id", player.id);

      await sendTelegramMessage(chatId,
        `✅ Transfer-Info für <b>${player.first_name} ${player.last_name}</b> gespeichert:\n\n${action.zu_verein ? `→ ${action.zu_verein}` : ""}${action.details ? `\n${action.details}` : ""}`
      );
      break;
    }

    case "termin": {
      await supabase.from("termine").insert({
        titel: action.titel,
        datum: action.datum,
        art: "Sonstiges",
        jahrgang: "",
        ort: action.details || "",
        quelle: "Telegram",
        erstellt_von: "Telegram Bot",
      });

      const datumFormatted = new Date(action.datum).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      await sendTelegramMessage(chatId,
        `✅ Termin erstellt:\n\n📅 <b>${action.titel}</b>\n${datumFormatted}${action.zeit ? ` um ${action.zeit}` : ""}${action.details ? `\n${action.details}` : ""}`
      );
      break;
    }

    case "scouting_notiz": {
      // Prüfen ob Spieler schon in scouted_players existiert
      const nameParts = action.player_name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      const { data: existing } = await supabase
        .from("scouted_players")
        .select("id, first_name, last_name, notes")
        .ilike("first_name", `%${firstName}%`)
        .ilike("last_name", `%${lastName}%`);

      if (existing && existing.length > 0) {
        // Notiz anhängen
        const player = existing[0];
        const timestamp = new Date().toLocaleDateString("de-DE");
        const existingNotes = player.notes || "";
        const newNotes = existingNotes
          ? `${existingNotes}\n\n[${timestamp} via Telegram] ${action.notiz}`
          : `[${timestamp} via Telegram] ${action.notiz}`;

        await supabase
          .from("scouted_players")
          .update({ notes: newNotes })
          .eq("id", player.id);

        await sendTelegramMessage(chatId,
          `✅ Scouting-Notiz für <b>${player.first_name} ${player.last_name}</b> aktualisiert:\n\n${action.notiz}`
        );
      } else {
        // Neuen Scouting-Eintrag erstellen
        await supabase.from("scouted_players").insert({
          first_name: firstName,
          last_name: lastName,
          club: action.verein || "",
          position: action.position || "",
          rating: action.bewertung || null,
          notes: `[${new Date().toLocaleDateString("de-DE")} via Telegram] ${action.notiz}`,
          status: "beobachten",
        });

        await sendTelegramMessage(chatId,
          `✅ Neuer Scouting-Eintrag für <b>${action.player_name}</b> erstellt:\n\n${action.verein ? `🏟 ${action.verein}` : ""}${action.position ? `\n📋 ${action.position}` : ""}${action.bewertung ? `\n⭐ Bewertung: ${action.bewertung}/10` : ""}\n\n${action.notiz}`
        );
      }
      break;
    }

    case "frage": {
      await sendTelegramMessage(chatId, action.antwort);
      break;
    }

    default: {
      await sendTelegramMessage(chatId,
        "❓ Ich konnte die Nachricht nicht zuordnen. Versuche es nochmal mit einer klareren Beschreibung."
      );
    }
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN || !ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const body = await req.json();
    console.log("Telegram update received:", JSON.stringify(body).substring(0, 200));

    // Nur Text-Nachrichten verarbeiten
    const message = body.message;
    if (!message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text;

    // Whitelist prüfen
    if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) {
      console.log(`Unauthorized user: ${userId}`);
      await sendTelegramMessage(chatId,
        "⛔ Du bist nicht berechtigt, diesen Bot zu nutzen.\n\nDeine User-ID: " + userId
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // /start Kommando
    if (text === "/start") {
      await sendTelegramMessage(chatId,
        `👋 Willkommen beim KMH-App Bot!\n\nSchicke mir einfach eine Nachricht und ich trage die Daten in die App ein.\n\n<b>Beispiele:</b>\n• "Ahmed Atilgan: Gutes Training heute, Schusstechnik verbessert"\n• "Termin am 25.03. Treffen mit Hertha Scout"\n• "Transfer: Max Müller wechselt zu Werder Bremen"\n• "Scouting: Jan Schmidt, U17 Bayern München, Mittelfeld, 8/10 - sehr guter Spielaufbau"\n\nDeine User-ID: <code>${userId}</code>`
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // /hilfe Kommando
    if (text === "/hilfe" || text === "/help") {
      await sendTelegramMessage(chatId,
        `📖 <b>So nutzt du den Bot:</b>\n\n<b>Spieler-Notiz:</b>\n"Ahmed Atilgan: Gutes Spiel heute"\n\n<b>Transfer-Info:</b>\n"Max Müller wechselt von Hertha zu Bremen"\n\n<b>Termin:</b>\n"Termin am 15.04. Scouting bei Bayern vs Dortmund"\n\n<b>Scouting:</b>\n"Scouting: Jan Schmidt, Werder U17, Stürmer, 7/10 - schnell, guter Abschluss"`
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nachricht mit Claude parsen
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Processing message from user ${userId}: "${text.substring(0, 100)}..."`);

    const action = await parseWithClaude(text);
    console.log("Claude parsed action:", JSON.stringify(action));

    await handleAction(supabase, action, chatId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telegram bot error:", error);

    // Versuche Fehlermeldung an User zu senden
    try {
      const body = await req.clone().json();
      if (body.message?.chat?.id) {
        await sendTelegramMessage(body.message.chat.id,
          "❌ Fehler bei der Verarbeitung. Bitte versuche es nochmal."
        );
      }
    } catch {}

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
