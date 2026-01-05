// fussball.de API Service
// API Dokumentation: https://api-fussball.de

const API_BASE_URL = 'https://api-fussball.de';

// Token wird in Supabase gespeichert (settings Tabelle)
let cachedToken: string | null = null;

interface FussballDeGame {
  id: string;
  date: string;
  time: string;
  home_team: string;
  home_team_id: string;
  away_team: string;
  away_team_id: string;
  location?: string;
  competition?: string;
  score?: string;
}

interface FussballDeTeam {
  id: string;
  name: string;
  club_id: string;
}

interface FussballDeClubInfo {
  id: string;
  name: string;
  teams: FussballDeTeam[];
  next_games: FussballDeGame[];
}

// API Token aus Supabase holen oder registrieren
export const getApiToken = async (supabase: any): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  
  try {
    // Versuche Token aus settings zu holen
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'fussball_de_api_token')
      .single();
    
    if (settings?.value) {
      cachedToken = settings.value;
      return cachedToken;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting API token:', error);
    return null;
  }
};

// API Token registrieren
export const registerApiToken = async (supabase: any, email: string): Promise<string | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      throw new Error('Token registration failed');
    }
    
    const data = await response.json();
    const token = data.token;
    
    if (token) {
      // Token in Supabase speichern
      await supabase
        .from('settings')
        .upsert({ key: 'fussball_de_api_token', value: token });
      
      cachedToken = token;
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('Error registering API token:', error);
    return null;
  }
};

// API Request mit Token
const apiRequest = async (endpoint: string, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'x-auth-token': token,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  return response.json();
};

// Club-Infos mit kommenden Spielen holen
export const getClubNextGames = async (clubId: string, token: string): Promise<FussballDeGame[]> => {
  try {
    const data = await apiRequest(`/api/club/next_games/${clubId}`, token);
    return data.games || data.next_games || [];
  } catch (error) {
    console.error('Error fetching club games:', error);
    return [];
  }
};

// Team-Infos mit kommenden Spielen holen
export const getTeamNextGames = async (teamId: string, token: string): Promise<FussballDeGame[]> => {
  try {
    const data = await apiRequest(`/api/team/next_games/${teamId}`, token);
    return data.games || data.next_games || [];
  } catch (error) {
    console.error('Error fetching team games:', error);
    return [];
  }
};

// Vollständige Club-Infos holen
export const getClubInfo = async (clubId: string, token: string): Promise<FussballDeClubInfo | null> => {
  try {
    const data = await apiRequest(`/api/club/info/${clubId}`, token);
    return data;
  } catch (error) {
    console.error('Error fetching club info:', error);
    return null;
  }
};

// Spiele für die nächsten X Wochen filtern
export const filterGamesForWeeks = (games: FussballDeGame[], weeks: number = 8): FussballDeGame[] => {
  const now = new Date();
  const endDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  
  return games.filter(game => {
    const gameDate = new Date(game.date);
    return gameDate >= now && gameDate <= endDate;
  });
};

// Hauptfunktion: Spiele aller Spieler synchronisieren
export const syncAllPlayerGames = async (
  supabase: any,
  players: Array<{ id: string; first_name: string; last_name: string; club: string; fussball_de_club_id?: string }>,
  onProgress?: (current: number, total: number, playerName: string) => void
): Promise<{ added: number; updated: number; errors: string[] }> => {
  const result = { added: 0, updated: 0, errors: [] as string[] };
  
  // Token holen
  const token = await getApiToken(supabase);
  if (!token) {
    result.errors.push('Kein API-Token vorhanden. Bitte zuerst Token registrieren.');
    return result;
  }
  
  // Club-IDs aus club_logos Tabelle holen (falls fussball_de_id dort gespeichert)
  const { data: clubData } = await supabase
    .from('club_logos')
    .select('club_name, fussball_de_id');
  
  const clubIdMap: Record<string, string> = {};
  if (clubData) {
    clubData.forEach((c: any) => {
      if (c.fussball_de_id) {
        clubIdMap[c.club_name] = c.fussball_de_id;
      }
    });
  }
  
  // Für jeden Spieler Spiele holen
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const playerName = `${player.first_name} ${player.last_name}`;
    
    if (onProgress) {
      onProgress(i + 1, players.length, playerName);
    }
    
    // Club-ID ermitteln
    const clubId = player.fussball_de_club_id || clubIdMap[player.club];
    
    if (!clubId) {
      result.errors.push(`Keine fussball.de ID für Club "${player.club}" (${playerName})`);
      continue;
    }
    
    try {
      // Spiele vom Club holen
      const games = await getClubNextGames(clubId, token);
      const filteredGames = filterGamesForWeeks(games, 8);
      
      // Spiele in Datenbank speichern
      for (const game of filteredGames) {
        // Prüfen ob Spiel bereits existiert
        const { data: existing } = await supabase
          .from('player_games')
          .select('id')
          .eq('player_id', player.id)
          .eq('date', game.date)
          .eq('home_team', game.home_team)
          .eq('away_team', game.away_team)
          .single();
        
        if (existing) {
          // Update
          await supabase
            .from('player_games')
            .update({
              location: game.location || null,
              game_type: game.competition || 'Liga',
            })
            .eq('id', existing.id);
          result.updated++;
        } else {
          // Insert
          await supabase
            .from('player_games')
            .insert({
              player_id: player.id,
              date: game.date,
              home_team: game.home_team,
              away_team: game.away_team,
              location: game.location || null,
              game_type: game.competition || 'Liga',
            });
          result.added++;
        }
      }
      
      // Rate Limit beachten (max 30/min = 2 sek zwischen Requests)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      result.errors.push(`Fehler bei ${playerName}: ${error.message}`);
    }
  }
  
  return result;
};

// Einzelnen Club synchronisieren (für manuelle Sync)
export const syncClubGames = async (
  supabase: any,
  clubId: string,
  playerId: string
): Promise<{ added: number; errors: string[] }> => {
  const result = { added: 0, errors: [] as string[] };
  
  const token = await getApiToken(supabase);
  if (!token) {
    result.errors.push('Kein API-Token vorhanden');
    return result;
  }
  
  try {
    const games = await getClubNextGames(clubId, token);
    const filteredGames = filterGamesForWeeks(games, 8);
    
    for (const game of filteredGames) {
      const { data: existing } = await supabase
        .from('player_games')
        .select('id')
        .eq('player_id', playerId)
        .eq('date', game.date)
        .eq('home_team', game.home_team)
        .eq('away_team', game.away_team)
        .single();
      
      if (!existing) {
        await supabase
          .from('player_games')
          .insert({
            player_id: playerId,
            date: game.date,
            home_team: game.home_team,
            away_team: game.away_team,
            location: game.location || null,
            game_type: game.competition || 'Liga',
          });
        result.added++;
      }
    }
  } catch (error: any) {
    result.errors.push(error.message);
  }
  
  return result;
};
