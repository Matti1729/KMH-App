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
  deleted: number;
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

// Nächste Spiele eines Teams von der API holen (über Supabase Edge Function Proxy)
export async function fetchTeamNextGames(teamId: string, token: string, supabaseClient?: SupabaseClient): Promise<ApiGame[]> {
  try {
    // API URL die wir aufrufen wollen
    const apiUrl = `https://api-fussball.de/api/team/next_games/${teamId}`;

    // Über Supabase Edge Function Proxy aufrufen
    const proxyUrl = `${SUPABASE_PROXY_URL}?type=fussball&url=${encodeURIComponent(apiUrl)}`;

    console.log('Calling proxy:', proxyUrl);

    // Supabase Auth-Token für JWT-Verifizierung
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-auth-token': token
    };
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Fehler: ${response.status} ${response.statusText}`, errorText);
      return [];
    }
    
    const result = await response.json();
    console.log('API Response für Team', teamId, ':', result);
    
    if (!result.success || !result.data) {
      console.error('API Response nicht erfolgreich:', result);
      return [];
    }
    
    // API Response in unser Format umwandeln
    const games: ApiGame[] = result.data
      .filter((game: any) => {
        // Abgesetzte/abgesagte Spiele ausfiltern - prüfe mehrere Felder
        const status = (game.status || '').toLowerCase();
        const info = (game.info || '').toLowerCase();
        const result = (game.result || game.ergebnis || '').toLowerCase();
        const combined = status + ' ' + info + ' ' + result;

        if (combined.includes('absetzung') || combined.includes('abgesetzt') || combined.includes('abgesagt') ||
            combined.includes('cancelled') || combined.includes('postponed') || combined.includes('verlegt')) {
          console.log('Spiel gefiltert (abgesetzt):', game.homeTeam || game.home, 'vs', game.awayTeam || game.away, '| Status:', status, '| Info:', info);
          return false;
        }
        return true;
      })
      .map((game: any) => {
        // Datum konvertieren
        const rawDate = game.date || game.datum || '';
        const isoDate = convertGermanDateToISO(rawDate);

        console.log('Datum Konvertierung:', rawDate, '->', isoDate);

        return {
          id: game.id || `${isoDate}_${game.homeTeam || game.home}_${game.awayTeam || game.away}`.replace(/\s/g, '_'),
          date: isoDate,
          time: game.time || game.uhrzeit || '',
          homeTeam: game.homeTeam || game.heimmannschaft || game.home || '',
          awayTeam: game.awayTeam || game.gastmannschaft || game.away || '',
          homeTeamLogo: game.homeLogo || game.homeTeamLogo || game.heimLogo || null,
          awayTeamLogo: game.awayLogo || game.awayTeamLogo || game.gastLogo || null,
          location: game.location || game.ort || game.spielort || '',
          league: game.competition || game.league || game.liga || game.wettbewerb || '',
          matchday: game.matchday || game.spieltag || '',
          result: game.result || game.ergebnis || null
        };
      }).filter((game: ApiGame) => game.date); // Nur Spiele mit gültigem Datum
    
    return games;
  } catch (err) {
    console.error('Fehler beim Abrufen der Spiele:', err);
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

// Veraltete Spiele löschen (nur die, die NICHT mehr in der API-Antwort sind)
export async function deleteStaleGames(
  supabase: SupabaseClient,
  playerId: string,
  currentGames: ApiGame[]
): Promise<number> {
  const today = getGermanDateString(0);

  // Alle zukünftigen Spiele des Spielers laden
  const { data: futureGames } = await supabase
    .from('player_games')
    .select('id, date, home_team, away_team')
    .eq('player_id', playerId)
    .gte('date', today);

  if (!futureGames || futureGames.length === 0) return 0;

  // Welche Spiele sind in der API-Response?
  const apiGameKeys = new Set(
    currentGames.map(g => `${g.date}|${g.homeTeam}|${g.awayTeam}`)
  );

  // Spiele löschen die NICHT mehr in der API sind (abgesagt, verschoben etc.)
  const staleIds = futureGames
    .filter(fg => !apiGameKeys.has(`${fg.date}|${fg.home_team}|${fg.away_team}`))
    .map(fg => fg.id);

  if (staleIds.length === 0) return 0;

  const { error } = await supabase
    .from('player_games')
    .delete()
    .in('id', staleIds);

  if (error) {
    console.error('Fehler beim Löschen veralteter Spiele:', error);
    return 0;
  }

  return staleIds.length;
}

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

// Spiele in die Datenbank speichern/aktualisieren
export async function saveGamesToDatabase(
  supabase: SupabaseClient, 
  playerId: string, 
  playerName: string,
  games: ApiGame[]
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  
  for (const game of games) {
    // Überspringe Spiele ohne gültiges Datum
    if (!game.date || game.date.length !== 10) {
      console.warn('Überspringe Spiel ohne gültiges Datum:', game);
      continue;
    }
    
    try {
      // Prüfen ob Spiel bereits existiert (basierend auf Datum + Teams)
      const { data: existing } = await supabase
        .from('player_games')
        .select('id')
        .eq('player_id', playerId)
        .eq('date', game.date)
        .eq('home_team', game.homeTeam)
        .eq('away_team', game.awayTeam)
        .maybeSingle();
      
      const gameData = {
        player_id: playerId,
        player_name: playerName,
        date: game.date,
        time: game.time || null,
        home_team: game.homeTeam,
        away_team: game.awayTeam,
        home_team_logo: game.homeTeamLogo || null,
        away_team_logo: game.awayTeamLogo || null,
        location: game.location || null,
        league: game.league || null,
        matchday: game.matchday || null,
        result: game.result || null,
        game_url: game.gameUrl || null,
        source: 'api-fussball.de',
        updated_at: new Date().toISOString()
      };
      
      if (existing) {
        // Update
        const { error } = await supabase
          .from('player_games')
          .update(gameData)
          .eq('id', existing.id);
        
        if (error) {
          console.error('Update Fehler:', error);
        } else {
          updated++;
        }
      } else {
        // Insert
        const { error } = await supabase
          .from('player_games')
          .insert([{ 
            ...gameData, 
            selected: false,
            created_at: new Date().toISOString() 
          }]);
        
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
  
  return { added, updated };
}

// Hauptfunktion: Alle Spieler-Spiele synchronisieren
export async function syncAllPlayerGames(
  supabase: SupabaseClient,
  onProgress?: (current: number, total: number, playerName: string) => void
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    added: 0,
    updated: 0,
    deleted: 0,
    errors: []
  };
  
  // API Token laden
  const token = await getApiToken(supabase);
  if (!token) {
    result.errors.push('Kein API Token konfiguriert. Bitte Token in Einstellungen hinterlegen.');
    return result;
  }
  
  // Spieler laden
  const players = await getPlayersWithFussballDeUrl(supabase);
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
    
    // Spiele von API holen
    const games = await fetchTeamNextGames(teamId, token, supabase);
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

    // Spiele speichern (Insert oder Update)
    const saveResult = await saveGamesToDatabase(supabase, player.id, playerName, games);
    result.added += saveResult.added;
    result.updated += saveResult.updated;

    // Veraltete Spiele entfernen (nicht mehr in API = abgesagt/verschoben)
    const staleDeleted = await deleteStaleGames(supabase, player.id, games);
    result.deleted += staleDeleted;

    console.log(`${playerName}: ${saveResult.added} neu, ${saveResult.updated} aktualisiert, ${staleDeleted} entfernt`);
    
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
  const token = await getApiToken(supabase);
  if (!token) {
    return { success: false, games: [], error: 'Kein API Token' };
  }
  
  const teamId = extractTeamId(fussballDeUrl);
  if (!teamId) {
    return { success: false, games: [], error: 'Keine Team-ID in URL' };
  }
  
  const games = await fetchTeamNextGames(teamId, token);

  if (games.length > 0) {
    // Game-URLs von fussball.de Teamseite scrapen und per Teamnamen-Slug matchen
    try {
      const slugUrlMap = await fetchGameUrlsFromTeamPage(fussballDeUrl, supabase);
      matchGameUrls(games, slugUrlMap);
    } catch (err) {
      console.warn('Game-URLs scrapen fehlgeschlagen:', err);
    }

    await saveGamesToDatabase(supabase, playerId, playerName, games);
    await deleteStaleGames(supabase, playerId, games);
  }

  return { success: true, games };
}

// Alle gespeicherten Spiele laden (für die nächsten 5 Wochen)
export async function loadUpcomingGames(supabase: SupabaseClient): Promise<any[]> {
  // Mitteleuropäische Zeit (Europe/Berlin) verwenden
  const todayStr = getGermanDateString(0);
  const in5WeeksStr = getGermanDateString(35);

  const { data, error } = await supabase
    .from('player_games')
    .select(`
      *,
      player:player_details(id, first_name, last_name, club, responsibility, league, fussball_de_url)
    `)
    .gte('date', todayStr)
    .lte('date', in5WeeksStr)
    .order('date', { ascending: true });
  
  if (error) {
    console.error('Fehler beim Laden der Spiele:', error);
    return [];
  }
  
  return data || [];
}

// Lösche alte Spiele (älter als 1 Tag)
export async function cleanupOldGames(supabase: SupabaseClient): Promise<number> {
  // Mitteleuropäische Zeit (Europe/Berlin) verwenden
  const yesterdayStr = getGermanDateString(-1);

  const { data, error } = await supabase
    .from('player_games')
    .delete()
    .lt('date', yesterdayStr)
    .select('id');
  
  if (error) {
    console.error('Fehler beim Löschen alter Spiele:', error);
    return 0;
  }
  
  return data?.length || 0;
}
