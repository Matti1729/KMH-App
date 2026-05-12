// fussballDeApi.ts - Integration mit api-fussball.de
// Holt Spielpläne von fussball.de über die kostenlose API

import { SupabaseClient } from '@supabase/supabase-js';

// Hilfsfunktion: Datum in mitteleuropäischer Zeit (Europe/Berlin) als ISO-String
function getGermanDateString(offsetDays: number = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  // Verwende Intl.DateTimeFormat für zuverlässige Zeitzone
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// Supabase Edge Function Proxy URL (ersetzt localhost Proxy)
const SUPABASE_PROXY_URL = 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/proxy';
// iCal-Edge-Function für Spielplan-Daten (Ersatz für api-fussball.de)
const SUPABASE_ICAL_URL = 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/scrape-fussball-ical';

// Typen
export interface ApiGame {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  location?: string;
  league?: string;
  matchday?: string;
  result?: string;
  gameUrl?: string;
}

export interface PlayerWithGames {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
  league: string;
  fussball_de_url: string;
  team_id: string;
  responsibility?: string;
  games: ApiGame[];
}

export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  changed: number;     // Anzahl der erkannten Verschiebungen/Änderungen
  cancelled: number;   // Anzahl der als 'cancelled' markierten Spiele
  deleted: number;     // legacy — wird nicht mehr gefüllt, bleibt für UI-Compat
  errors: string[];
}

// Team-ID aus fussball.de URL extrahieren
export function extractTeamId(fussballDeUrl: string): string | null {
  if (!fussballDeUrl) return null;
  
  // URL Format: https://www.fussball.de/mannschaft/[name]/[...]/team-id/[TEAM_ID]
  // Oder: /mannschaft/[...]/team-id/[TEAM_ID]
  
  const teamIdMatch = fussballDeUrl.match(/team-id\/([A-Z0-9]+)/i);
  if (teamIdMatch) {
    return teamIdMatch[1];
  }
  
  // Alternativ: ID am Ende der URL
  const altMatch = fussballDeUrl.match(/\/([A-Z0-9]{20,})(?:\?|#|$)/i);
  if (altMatch) {
    return altMatch[1];
  }
  
  return null;
}

// Deutsches Datum "Sa, 25.10.2025" oder "25.10.2025" in ISO-Format "2025-10-25" umwandeln
function convertGermanDateToISO(germanDate: string): string {
  if (!germanDate) return '';
  
  // Bereits im ISO-Format?
  if (/^\d{4}-\d{2}-\d{2}$/.test(germanDate)) {
    return germanDate;
  }
  
  // Entferne Wochentag falls vorhanden (z.B. "Sa, " oder "So, ")
  const cleanDate = germanDate.replace(/^[A-Za-z]{2},?\s*/, '');
  
  // Format: DD.MM.YYYY
  const match = cleanDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  // Format: DD.MM.YY
  const shortMatch = cleanDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);
  if (shortMatch) {
    const day = shortMatch[1].padStart(2, '0');
    const month = shortMatch[2].padStart(2, '0');
    const year = parseInt(shortMatch[3]) > 50 ? `19${shortMatch[3]}` : `20${shortMatch[3]}`;
    return `${year}-${month}-${day}`;
  }
  
  console.warn('Konnte Datum nicht konvertieren:', germanDate);
  return '';
}

// API Token aus Supabase laden (settings Tabelle)
export async function getApiToken(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'fussball_de_api_token')
      .single();
    
    if (error || !data) {
      console.log('Kein API Token gefunden');
      return null;
    }
    
    return data.value;
  } catch (err) {
    console.error('Fehler beim Laden des API Tokens:', err);
    return null;
  }
}

// API Token in Supabase speichern
export async function saveApiToken(supabase: SupabaseClient, token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ 
        key: 'fussball_de_api_token', 
        value: token,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'key' 
      });
    
    return !error;
  } catch (err) {
    console.error('Fehler beim Speichern des API Tokens:', err);
    return false;
  }
}

// Nächste Spiele eines Teams holen — via Browserless-Scrape-Edge-Function der fussball.de-Team-Seite.
// Token-Parameter wird ignoriert (kein API-Token mehr nötig). Behalten für Backwards-Compat.
export async function fetchTeamNextGames(teamId: string, _token?: string, supabaseClient?: SupabaseClient, teamUrl?: string): Promise<ApiGame[]> {
  try {
    console.log('[scrape] fetching games for teamId:', teamId);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const response = await fetch(SUPABASE_ICAL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ teamId, teamUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ical] Fehler: ${response.status} ${response.statusText}`, errorText);
      return [];
    }

    const result = await response.json();
    if (result.error) {
      console.warn(`[ical] Team ${teamId}: ${result.error}`);
    }

    const rawGames = Array.isArray(result.games) ? result.games : [];
    // Cancelled/postponed gibt's bei iCal nicht — fussball.de gibt verschobene Spiele direkt mit neuem Termin raus.
    // Aber für defensive: wenn SUMMARY "abgesetzt"/"abgesagt" enthält, filtern wir trotzdem.
    const games: ApiGame[] = rawGames
      .filter((g: any) => {
        if (!g.date) return false;
        const summary = `${g.homeTeam || ''} ${g.awayTeam || ''}`.toLowerCase();
        if (summary.includes('absetzung') || summary.includes('abgesetzt') || summary.includes('abgesagt')) {
          return false;
        }
        return true;
      })
      .map((g: any): ApiGame => ({
        id: g.id || `${g.date}_${g.homeTeam}_${g.awayTeam}`.replace(/\s+/g, '_'),
        date: g.date,
        time: g.time || '',
        homeTeam: g.homeTeam || '',
        awayTeam: g.awayTeam || '',
        homeTeamLogo: g.homeTeamLogo || null,
        awayTeamLogo: g.awayTeamLogo || null,
        location: g.location || '',
        league: g.league || '',
        matchday: g.matchday || '',
        result: g.result || null,
      }));

    console.log(`[ical] Team ${teamId}: ${games.length} Spiele`);
    return games;
  } catch (err) {
    console.error('[ical] Fehler beim Abrufen der Spiele:', err);
    return [];
  }
}

// Normalisiere Teamnamen für URL-Slug-Matching (Umlaute → ae/oe/ue, nur alphanumerisch)
function normalizeForMatch(name: string): string {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

// Game-URLs von der fussball.de Teamseite scrapen (URL-Slug-basiertes Matching)
async function fetchGameUrlsFromTeamPage(
  teamPageUrl: string,
  supabaseClient?: SupabaseClient
): Promise<Map<string, string>> {
  const results = new Map<string, string>(); // key: slug, value: full URL

  try {
    if (!teamPageUrl) return results;

    // Google-Redirect bereinigen
    let cleanUrl = teamPageUrl;
    if (cleanUrl.includes('google.com/url')) {
      const m = cleanUrl.match(/[?&]q=([^&]+)/);
      if (m) cleanUrl = decodeURIComponent(m[1]);
    }

    // Fetch team page HTML via proxy (type=transfermarkt für Browser-Headers)
    const proxyUrl = `${SUPABASE_PROXY_URL}?type=transfermarkt&url=${encodeURIComponent(cleanUrl)}`;

    const headers: Record<string, string> = {};
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const response = await fetch(proxyUrl, { method: 'GET', headers });
    if (!response.ok) {
      console.warn('Teamseite nicht erreichbar:', response.status);
      return results;
    }

    const html = await response.text();

    // Alle Spiel-URLs extrahieren: /spiel/[team-slug]/-/spiel/[GAME_ID]
    const urlRegex = /href="(\/spiel\/([^"]+)\/-\/spiel\/[A-Z0-9]+)"/gi;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      const fullPath = match[1];
      const slug = match[2]; // z.B. "borussia-moenchengladbach-rasenballsport-leipzig-u19"
      results.set(slug, `https://www.fussball.de${fullPath}`);
    }

    console.log(`${results.size} Game-URLs von Teamseite extrahiert`);
  } catch (err) {
    console.warn('Fehler beim Scrapen der Teamseite:', err);
  }

  return results;
}

// Matche API-Games mit gescrapten URLs anhand normalisierter Teamnamen im URL-Slug
function matchGameUrls(games: ApiGame[], slugUrlMap: Map<string, string>): void {
  for (const game of games) {
    const homeNorm = normalizeForMatch(game.homeTeam);
    const awayNorm = normalizeForMatch(game.awayTeam);

    for (const [slug, url] of slugUrlMap) {
      const slugNorm = slug.replace(/-/g, '');
      // Matche erste 8 Zeichen jedes normalisierten Teamnamens gegen den Slug
      if (slugNorm.includes(homeNorm.slice(0, 8)) && slugNorm.includes(awayNorm.slice(0, 8))) {
        game.gameUrl = url;
        break;
      }
    }
  }
}

// Lösche alle zukünftigen Spiele eines Spielers (vor Neu-Sync)
export async function deletePlayerFutureGames(
  supabase: SupabaseClient,
  playerId: string
): Promise<number> {
  // Mitteleuropäische Zeit (Europe/Berlin) verwenden
  const today = getGermanDateString(0);

  const { data, error } = await supabase
    .from('player_games')
    .delete()
    .eq('player_id', playerId)
    .gte('date', today)
    .select('id');

  if (error) {
    console.error('Fehler beim Löschen zukünftiger Spiele:', error);
    return 0;
  }

  return data?.length || 0;
}

// Veraltete Spiele als 'cancelled' markieren (statt löschen)
// Dadurch bleibt die Information erhalten + UI kann "ABGESAGT"-Badge zeigen.
// Erst nach 7 Tagen werden cancelled-Spiele endgültig gelöscht (cleanupOldGames).
export async function markStaleGamesCancelled(
  supabase: SupabaseClient,
  playerId: string,
  currentGames: ApiGame[]
): Promise<number> {
  const today = getGermanDateString(0);

  const { data: futureGames } = await supabase
    .from('player_games')
    .select('id, date, home_team, away_team, status, sequence')
    .eq('player_id', playerId)
    .gte('date', today)
    .neq('status', 'cancelled'); // bereits cancelled-Spiele nicht erneut markieren

  if (!futureGames || futureGames.length === 0) return 0;

  // Match-Key auf home+away — Datums-Verschiebungen werden so nicht als cancel-erkannt,
  // weil saveGamesToDatabase sie über den gleichen Key bereits als CHANGE erfasst hat.
  const apiGameKeys = new Set(currentGames.map(g => `${g.homeTeam}|${g.awayTeam}`));

  const staleIds = futureGames
    .filter(fg => !apiGameKeys.has(`${fg.home_team}|${fg.away_team}`))
    .map(fg => fg.id);

  if (staleIds.length === 0) return 0;

  console.log('[SYNC] Cancelled markieren:', staleIds);

  const { error } = await supabase
    .from('player_games')
    .update({
      status: 'cancelled',
      last_changed_at: new Date().toISOString(),
      change_summary: { cancelled: true },
      sequence: (futureGames[0].sequence || 0) + 1,
      user_seen_at: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', staleIds);

  if (error) {
    console.error('Fehler beim Markieren als cancelled:', error);
    return 0;
  }

  return staleIds.length;
}

// Backwards-Compat-Wrapper — alte Caller verwenden weiterhin den Funktionsnamen
export const deleteStaleGames = markStaleGamesCancelled;

// Alle Spieler mit fussball_de_url laden
export async function getPlayersWithFussballDeUrl(supabase: SupabaseClient): Promise<any[]> {
  const { data, error } = await supabase
    .from('player_details')
    .select('id, first_name, last_name, club, league, fussball_de_url, responsibility')
    .not('fussball_de_url', 'is', null)
    .neq('fussball_de_url', '');
  
  if (error) {
    console.error('Fehler beim Laden der Spieler:', error);
    return [];
  }
  
  return data || [];
}

// Spiele in die Datenbank speichern/aktualisieren mit Change-Detection
// Erkennt Verschiebungen (Datum, Zeit, Ort, Liga), schreibt change_summary + erhöht sequence
export async function saveGamesToDatabase(
  supabase: SupabaseClient,
  playerId: string,
  playerName: string,
  games: ApiGame[]
): Promise<{ added: number; updated: number; changed: number }> {
  let added = 0;
  let updated = 0;
  let changed = 0;

  // Lade alle existierenden zukünftigen Spiele dieses Spielers — Match per UID-Stub (date+home+away)
  // ODER per externer ID falls vorhanden. Damit erkennen wir Verschiebungen, bei denen sich nur das Datum ändert.
  const today = getGermanDateString(0);
  const { data: existingGames } = await supabase
    .from('player_games')
    .select('id, date, time, home_team, away_team, location, league, sequence, status')
    .eq('player_id', playerId)
    .gte('date', today);

  const existingByMatchKey = new Map<string, any>();
  // Match-Key: home+away (Datum kann sich ändern!) — fängt typische Verschiebungen
  for (const g of existingGames || []) {
    const key = `${g.home_team}|${g.away_team}`;
    // Bei Duplikaten nehmen wir das mit dem nächsten Datum
    const prev = existingByMatchKey.get(key);
    if (!prev || g.date < prev.date) existingByMatchKey.set(key, g);
  }

  for (const game of games) {
    if (!game.date || game.date.length !== 10) continue;

    try {
      const matchKey = `${game.homeTeam}|${game.awayTeam}`;
      const existing = existingByMatchKey.get(matchKey);

      // Diff-Erkennung gegenüber existierendem Spiel
      const newTime = game.time || null;
      const newLocation = game.location || null;
      const newLeague = game.league || null;
      const changes: Record<string, { old: any; new: any }> = {};
      if (existing) {
        if (existing.date !== game.date) changes.date = { old: existing.date, new: game.date };
        if ((existing.time || null) !== newTime) changes.time = { old: existing.time, new: newTime };
        if ((existing.location || null) !== newLocation) changes.location = { old: existing.location, new: newLocation };
        if ((existing.league || null) !== newLeague) changes.league = { old: existing.league, new: newLeague };
      }
      const hasChanges = Object.keys(changes).length > 0;

      const gameData: any = {
        player_id: playerId,
        player_name: playerName,
        date: game.date,
        time: newTime,
        home_team: game.homeTeam,
        away_team: game.awayTeam,
        home_team_logo: game.homeTeamLogo || null,
        away_team_logo: game.awayTeamLogo || null,
        location: newLocation,
        league: newLeague,
        matchday: game.matchday || null,
        result: game.result || null,
        game_url: game.gameUrl || null,
        source: 'fussball.de-ical',
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        if (hasChanges) {
          gameData.change_summary = changes;
          gameData.last_changed_at = new Date().toISOString();
          gameData.sequence = (existing.sequence || 0) + 1;
          gameData.user_seen_at = null; // bei Änderung wieder ungelesen
        }
        // Falls Spiel zuvor cancelled war und jetzt wieder da ist → reaktivieren
        if (existing.status === 'cancelled') {
          gameData.last_changed_at = new Date().toISOString();
          gameData.change_summary = { ...(gameData.change_summary || {}), reinstated: true };
          gameData.sequence = (existing.sequence || 0) + 1;
        }
        const { error } = await supabase.from('player_games').update(gameData).eq('id', existing.id);
        if (error) {
          console.error('Update Fehler:', error);
        } else {
          updated++;
          if (hasChanges) {
            changed++;
            console.log(`[SYNC] ${playerName} → CHANGE`, matchKey, changes);
          }
        }
      } else {
        // Neues Spiel — Badge "NEU" markieren, damit der User es nicht übersieht
        gameData.change_summary = { new: true };
        gameData.last_changed_at = new Date().toISOString();
        gameData.sequence = 1;
        const { error } = await supabase
          .from('player_games')
          .insert([{ ...gameData, selected: false, created_at: new Date().toISOString() }]);
        if (error) {
          console.error('Insert Fehler:', error, 'Daten:', gameData);
        } else {
          added++;
        }
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
    }
  }

  return { added, updated, changed };
}

// Hauptfunktion: Spieler-Spiele synchronisieren (optional gefiltert)
export async function syncAllPlayerGames(
  supabase: SupabaseClient,
  onProgress?: (current: number, total: number, playerName: string) => void,
  playerIds?: string[]
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    added: 0,
    updated: 0,
    changed: 0,
    cancelled: 0,
    deleted: 0,
    errors: []
  };

  // Spieler laden (optional gefiltert)
  let players = await getPlayersWithFussballDeUrl(supabase);
  if (playerIds && playerIds.length > 0) {
    players = players.filter(p => playerIds.includes(p.id));
  }
  if (players.length === 0) {
    result.errors.push('Keine Spieler mit fussball.de URL gefunden.');
    return result;
  }
  
  console.log(`Synchronisiere ${players.length} Spieler...`);
  
  // Für jeden Spieler Spiele laden
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const playerName = `${player.first_name} ${player.last_name}`;
    
    if (onProgress) {
      onProgress(i + 1, players.length, playerName);
    }
    
    // Team-ID extrahieren
    const teamId = extractTeamId(player.fussball_de_url);
    if (!teamId) {
      result.errors.push(`${playerName}: Falsche URL`);
      console.error(`Keine Team-ID für ${playerName}:`, player.fussball_de_url);
      continue;
    }
    
    console.log(`Lade Spiele für ${playerName} (Team: ${teamId})...`);

    // Spiele via Browserless-Edge-Function holen (mit teamUrl für robustere URL-Auflösung)
    const games = await fetchTeamNextGames(teamId, undefined, supabase, player.fussball_de_url);
    console.log(`${games.length} Spiele für ${playerName} gefunden`);

    if (games.length === 0) {
      // Kein Fehler, vielleicht einfach keine Spiele
      continue;
    }

    // Game-URLs von fussball.de Teamseite scrapen und per Teamnamen-Slug matchen
    try {
      const slugUrlMap = await fetchGameUrlsFromTeamPage(player.fussball_de_url, supabase);
      matchGameUrls(games, slugUrlMap);
    } catch (err) {
      console.warn(`Game-URLs scrapen fehlgeschlagen für ${playerName}:`, err);
    }

    // Spiele speichern (Insert/Update mit Change-Detection)
    const saveResult = await saveGamesToDatabase(supabase, player.id, playerName, games);
    result.added += saveResult.added;
    result.updated += saveResult.updated;
    result.changed += saveResult.changed;

    // Spiele die nicht mehr im Scrape sind → als 'cancelled' markieren
    const cancelledCount = await markStaleGamesCancelled(supabase, player.id, games);
    result.cancelled += cancelledCount;

    console.log(`${playerName}: +${saveResult.added} neu, ${saveResult.updated} update, ${saveResult.changed} geändert, ${cancelledCount} cancelled`);
    
    // Kurze Pause um API nicht zu überlasten
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  result.success = true;
  return result;
}

// Spiele eines einzelnen Spielers laden
export async function syncPlayerGames(
  supabase: SupabaseClient,
  playerId: string,
  fussballDeUrl: string,
  playerName: string
): Promise<{ success: boolean; games: ApiGame[]; error?: string }> {
  const teamId = extractTeamId(fussballDeUrl);
  if (!teamId) {
    return { success: false, games: [], error: 'Keine Team-ID in URL' };
  }

  const games = await fetchTeamNextGames(teamId, undefined, supabase, fussballDeUrl);

  if (games.length > 0) {
    // Game-URLs von fussball.de Teamseite scrapen und per Teamnamen-Slug matchen
    try {
      const slugUrlMap = await fetchGameUrlsFromTeamPage(fussballDeUrl, supabase);
      matchGameUrls(games, slugUrlMap);
    } catch (err) {
      console.warn('Game-URLs scrapen fehlgeschlagen:', err);
    }

    await saveGamesToDatabase(supabase, playerId, playerName, games);
    await markStaleGamesCancelled(supabase, playerId, games);
  }

  return { success: true, games };
}

// "Bestätigen" — User hat Änderungen zur Kenntnis genommen, Badge ausblenden
export async function acknowledgeGameChange(supabase: SupabaseClient, gameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('player_games')
    .update({ user_seen_at: new Date().toISOString() })
    .eq('id', gameId);
  return !error;
}

// Alle Änderungs-Badges für einen Spieler bestätigen
export async function acknowledgeAllChanges(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('player_games')
    .update({ user_seen_at: new Date().toISOString() })
    .not('last_changed_at', 'is', null)
    .is('user_seen_at', null)
    .select('id');
  if (error) {
    console.error('acknowledgeAllChanges error:', error);
    return 0;
  }
  return data?.length || 0;
}

// Alle gespeicherten Spiele laden (für die nächsten 4 Wochen — engeres Fenster für höhere Verlässlichkeit)
export async function loadUpcomingGames(supabase: SupabaseClient): Promise<any[]> {
  // Mitteleuropäische Zeit (Europe/Berlin) verwenden
  const todayStr = getGermanDateString(0);
  const in4WeeksStr = getGermanDateString(28);

  const { data, error } = await supabase
    .from('player_games')
    .select(`
      *,
      player:player_details(id, first_name, last_name, club, responsibility, league, fussball_de_url)
    `)
    .gte('date', todayStr)
    .lte('date', in4WeeksStr)
    .order('date', { ascending: true });
  
  if (error) {
    console.error('Fehler beim Laden der Spiele:', error);
    return [];
  }
  
  return data || [];
}

// Lösche alte Spiele:
//   - Spiele älter als 1 Tag (vergangene Spiele) → endgültig löschen
//   - Spiele mit status='cancelled' UND last_changed_at älter als 7 Tage → endgültig löschen
export async function cleanupOldGames(supabase: SupabaseClient): Promise<number> {
  const yesterdayStr = getGermanDateString(-1);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Vergangene Spiele
  const { data: oldGames } = await supabase
    .from('player_games')
    .delete()
    .lt('date', yesterdayStr)
    .select('id');

  // Cancelled-Spiele älter als 7 Tage
  const { data: oldCancelled } = await supabase
    .from('player_games')
    .delete()
    .eq('status', 'cancelled')
    .lt('last_changed_at', sevenDaysAgo)
    .select('id');

  return (oldGames?.length || 0) + (oldCancelled?.length || 0);
}
