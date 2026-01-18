// fussballDeApi.ts - Integration mit api-fussball.de
// Holt Spielpläne von fussball.de über die kostenlose API

import { SupabaseClient } from '@supabase/supabase-js';

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
export async function fetchTeamNextGames(teamId: string, token: string): Promise<ApiGame[]> {
  try {
    // API URL die wir aufrufen wollen
    const apiUrl = `https://api-fussball.de/api/team/next_games/${teamId}`;
    
    // Über Supabase Edge Function Proxy aufrufen
    const proxyUrl = `${SUPABASE_PROXY_URL}?type=fussball&url=${encodeURIComponent(apiUrl)}`;
    
    console.log('Calling proxy:', proxyUrl);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
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
    const games: ApiGame[] = result.data.map((game: any) => {
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
      result.errors.push(`${playerName}: Keine Team-ID in URL gefunden`);
      console.error(`Keine Team-ID für ${playerName}:`, player.fussball_de_url);
      continue;
    }
    
    console.log(`Lade Spiele für ${playerName} (Team: ${teamId})...`);
    
    // Spiele von API holen
    const games = await fetchTeamNextGames(teamId, token);
    console.log(`${games.length} Spiele für ${playerName} gefunden`);
    
    if (games.length === 0) {
      // Kein Fehler, vielleicht einfach keine Spiele
      continue;
    }
    
    // Spiele speichern
    const saveResult = await saveGamesToDatabase(supabase, player.id, playerName, games);
    result.added += saveResult.added;
    result.updated += saveResult.updated;
    
    console.log(`${playerName}: ${saveResult.added} neu, ${saveResult.updated} aktualisiert`);
    
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
    await saveGamesToDatabase(supabase, playerId, playerName, games);
  }
  
  return { success: true, games };
}

// Alle gespeicherten Spiele laden (für die nächsten 5 Wochen)
export async function loadUpcomingGames(supabase: SupabaseClient): Promise<any[]> {
  const today = new Date();
  const in5Weeks = new Date();
  in5Weeks.setDate(in5Weeks.getDate() + 35); // 5 Wochen
  
  const { data, error } = await supabase
    .from('player_games')
    .select(`
      *,
      player:player_details(id, first_name, last_name, club, responsibility)
    `)
    .gte('date', today.toISOString().split('T')[0])
    .lte('date', in5Weeks.toISOString().split('T')[0])
    .order('date', { ascending: true });
  
  if (error) {
    console.error('Fehler beim Laden der Spiele:', error);
    return [];
  }
  
  return data || [];
}

// Lösche alte Spiele (älter als 1 Tag)
export async function cleanupOldGames(supabase: SupabaseClient): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data, error } = await supabase
    .from('player_games')
    .delete()
    .lt('date', yesterday.toISOString().split('T')[0])
    .select('id');
  
  if (error) {
    console.error('Fehler beim Löschen alter Spiele:', error);
    return 0;
  }
  
  return data?.length || 0;
}
