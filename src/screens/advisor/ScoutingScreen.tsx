import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Platform, Linking, Pressable } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { useIsMobile } from '../../hooks/useIsMobile';

const POSITIONS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];

const SCOUTING_STATUS = [
  { id: 'gesichtet', label: 'Talentpool', description: 'Empfohlen oder gescoutet, aber noch weitere Sichtung nötig', color: '#10b981' },
  { id: 'in_beobachtung', label: 'Go-Kandidaten', description: 'Klares Ja - sofort aktiv ansprechen und verhaften', color: '#f59e0b' },
  { id: 'kontaktiert', label: 'Austausch läuft', description: 'Bereits in Kontakt: Gespräche laufen, nächste Schritte sind in Arbeit', color: '#3b82f6' },
];

const LISTINGS = ['Karl Herzog Sportmanagement', 'PM Sportmanagement'];

// Date picker constants
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 1); // Current year -1 to +8

// Game type options
const GAME_TYPES = ['Punktspiel', 'Pokalspiel', 'Freundschaftsspiel', 'Hallenturnier', 'Turnier'];
const AGE_GROUPS = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'U23', 'Herren'];

// Local Transfermarkt logo
const TransfermarktLogo = require('../../../assets/transfermarkt-logo.png');

interface ScoutedPlayer {
  id: string; first_name: string; last_name: string; birth_date: string; position: string;
  club: string; rating: number; scout_id: string; scout_name?: string;
  status: string; notes: string; created_at: string; photo_url?: string;
  transfermarkt_url?: string; agent_name?: string; agent_updated_at?: string;
  phone?: string; additional_info?: string;
  current_status?: string; // IST-Stand Freitext
  archived?: boolean; archived_at?: string; archive_reason?: string;
}

// Helper to parse positions (stored as comma-separated string)
const parsePositions = (pos: string): string[] => {
  if (!pos) return [];
  return pos.split(',').map(p => p.trim()).filter(p => p.length > 0);
};

const formatPositions = (positions: string[]): string => {
  return positions.join(', ');
};

interface ScoutingGame {
  id: string; date: string; home_team: string; away_team: string; 
  location: string; scout_id: string; scout_name?: string; notes: string; created_at: string;
  game_type?: string; description?: string; age_group?: string;
}

interface GameTeam {
  id: string;
  game_id: string;
  team_name: string;
  created_at: string;
}

interface GamePlayer {
  id: string;
  game_id: string;
  team_id: string;
  number: string;
  last_name: string;
  first_name: string;
  birth_year: string;
  position: string;
  rating: number | null;
  notes: string;
  created_at: string;
  added_to_database?: boolean;
}

interface Advisor { id: string; first_name: string; last_name: string; }

type ViewMode = 'kanban' | 'liste' | 'archiv';
type ActiveTab = 'spieler' | 'spiele';

const getYearFromDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.length === 4) return dateStr;
  const parts = dateStr.split('-');
  return parts[0] || '';
};

const formatBirthDisplay = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.length === 4) return `Jg. ${dateStr}`;
  try {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
};

// Date helper functions for game date picker
const parseDateToParts = (dateString: string): { day: number; month: number; year: number } | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() };
};

const buildDateFromParts = (day: number, month: number, year: number): string => {
  if (!day || month === undefined || month === null || !year) return '';
  const paddedMonth = (month + 1).toString().padStart(2, '0');
  const paddedDay = day.toString().padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
};

const formatGameDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const isGameToday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const today = new Date();
  const gameDate = new Date(dateStr);
  return today.getFullYear() === gameDate.getFullYear() &&
         today.getMonth() === gameDate.getMonth() &&
         today.getDate() === gameDate.getDate();
};

// Function to fetch agent from Transfermarkt (via proxy/scraping service)
const fetchAgentFromTransfermarkt = async (transfermarktUrl: string): Promise<string | null> => {
  if (!transfermarktUrl) return null;
  
  try {
    // Use a CORS proxy for web or direct fetch for native
    const proxyUrl = Platform.OS === 'web' 
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(transfermarktUrl)}`
      : transfermarktUrl;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Parse agent from HTML - Transfermarkt shows agent in a specific section
    // Look for "Spielerberater:" or "Agent:" pattern
    const agentPatterns = [
      /Spielerberater:<\/span>\s*<[^>]+>([^<]+)</i,
      /Berater:<\/span>\s*<[^>]+>([^<]+)</i,
      /data-agent[^>]*>([^<]+)</i,
      /"agent":\s*"([^"]+)"/i,
      /class="[^"]*agent[^"]*"[^>]*>([^<]+)</i,
    ];
    
    for (const pattern of agentPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const agent = match[1].trim();
        if (agent && agent.length > 1 && agent !== '-') {
          return agent;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching agent from Transfermarkt:', error);
    return null;
  }
};

export function ScoutingScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ActiveTab>('spieler');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [scoutedPlayers, setScoutedPlayers] = useState<ScoutedPlayer[]>([]);
  const [scoutingGames, setScoutingGames] = useState<ScoutingGame[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [clubNames, setClubNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; role?: string } | null>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showPlayerDetailModal, setShowPlayerDetailModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<ScoutedPlayer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ScoutedPlayer>>({});
  const [fetchingAgent, setFetchingAgent] = useState(false);

  // Entscheidungs-Modal State
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [transferListing, setTransferListing] = useState('');
  const [transferResponsibility, setTransferResponsibility] = useState('');

  const [clubSearchText, setClubSearchText] = useState('');
  const [showClubDropdown, setShowClubDropdown] = useState(false);
  const [editClubSearchText, setEditClubSearchText] = useState('');
  const [showEditClubDropdown, setShowEditClubDropdown] = useState(false);

  const [newPlayer, setNewPlayer] = useState({
    first_name: '', last_name: '', birth_date: '2005', position: 'ST',
    club: '', rating: 5, notes: '', status: 'gesichtet', photo_url: '', 
    transfermarkt_url: '', agent_name: '', phone: '', additional_info: '', current_status: ''
  });
  const [newPlayerClubSearch, setNewPlayerClubSearch] = useState('');
  const [showNewPlayerClubDropdown, setShowNewPlayerClubDropdown] = useState(false);

  const [newGame, setNewGame] = useState({
    date: '', home_team: '', away_team: '', location: '', notes: '',
    game_type: '', description: '', age_group: '', scout_id: ''
  });

  // Date picker states for game modal
  const [showGameDatePicker, setShowGameDatePicker] = useState(false);
  const [gameDatePart, setGameDatePart] = useState<'day' | 'month' | 'year' | null>(null);
  const [showGameTypePicker, setShowGameTypePicker] = useState(false);
  const [showAgeGroupPicker, setShowAgeGroupPicker] = useState(false);
  const [showScoutPicker, setShowScoutPicker] = useState(false);
  
  // Game detail modal
  const [showGameDetailModal, setShowGameDetailModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ScoutingGame | null>(null);
  const [isEditingGame, setIsEditingGame] = useState(false);
  const [editGameData, setEditGameData] = useState<Partial<ScoutingGame>>({});
  
  // Teams and Players for Game Detail
  const [gameTeams, setGameTeams] = useState<GameTeam[]>([]);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<GameTeam | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newGamePlayer, setNewGamePlayer] = useState({ number: '', last_name: '', first_name: '', birth_year: '', position: '', rating: null as number | null, notes: '' });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerNotes, setEditingPlayerNotes] = useState('');
  const [showPlayerNotesModal, setShowPlayerNotesModal] = useState(false);
  const [selectedGamePlayer, setSelectedGamePlayer] = useState<GamePlayer | null>(null);
  
  // Edit game dropdowns
  const [showEditGameTypePicker, setShowEditGameTypePicker] = useState(false);
  const [showEditAgeGroupPicker, setShowEditAgeGroupPicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editDatePart, setEditDatePart] = useState<'day' | 'month' | 'year' | null>(null);
  
  // New player dropdowns
  const [showNewPlayerPositionPicker, setShowNewPlayerPositionPicker] = useState(false);
  const [showNewPlayerRatingPicker, setShowNewPlayerRatingPicker] = useState(false);
  
  // Edit player dropdowns
  const [showEditPlayerPositionPicker, setShowEditPlayerPositionPicker] = useState(false);
  const [showEditPlayerRatingPicker, setShowEditPlayerRatingPicker] = useState(false);
  
  // Track which game player is being added to database
  const [addingGamePlayerId, setAddingGamePlayerId] = useState<string | null>(null);
  const [gameToReopenAfterAdd, setGameToReopenAfterAdd] = useState<ScoutingGame | null>(null);
  
  // Games search and archive
  const [gamesSearchQuery, setGamesSearchQuery] = useState('');
  const [gamesViewMode, setGamesViewMode] = useState<'upcoming' | 'archive' | 'search'>('upcoming');
  const [allGamePlayers, setAllGamePlayers] = useState<(GamePlayer & { game?: ScoutingGame, team_name?: string })[]>([]);
  const [selectedGamesRatings, setSelectedGamesRatings] = useState<number[]>([]);
  const [selectedGamesYears, setSelectedGamesYears] = useState<string[]>([]);
  const [showGamesRatingDropdown, setShowGamesRatingDropdown] = useState(false);
  const [showGamesYearDropdown, setShowGamesYearDropdown] = useState(false);

  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    scoutedPlayers.forEach(p => {
      const year = getYearFromDate(p.birth_date);
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [scoutedPlayers]);

  const availablePositions = useMemo(() => {
    const positions = new Set<string>();
    scoutedPlayers.forEach(p => {
      if (p.position) positions.add(p.position);
    });
    return POSITIONS.filter(p => positions.has(p));
  }, [scoutedPlayers]);

  // Split games into upcoming and past (archive)
  const { upcomingGames, archivedGames } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming: ScoutingGame[] = [];
    const archived: ScoutingGame[] = [];
    scoutingGames.forEach(game => {
      const gameDate = new Date(game.date);
      gameDate.setHours(0, 0, 0, 0);
      if (gameDate < today) {
        archived.push(game);
      } else {
        upcoming.push(game);
      }
    });
    return { upcomingGames: upcoming, archivedGames: archived.reverse() };
  }, [scoutingGames]);

  // Search results for games tab - separate events and players
  const { searchResultsEvents, searchResultsPlayers } = useMemo(() => {
    const query = gamesSearchQuery.toLowerCase().trim();
    const events: ScoutingGame[] = [];
    const players: (GamePlayer & { game?: ScoutingGame, team_name?: string })[] = [];
    
    if (!query && selectedGamesRatings.length === 0 && selectedGamesYears.length === 0) {
      return { searchResultsEvents: events, searchResultsPlayers: players };
    }
    
    // Check if query is a rating number
    const ratingQuery = parseInt(query);
    const isRatingSearch = !isNaN(ratingQuery) && ratingQuery >= 1 && ratingQuery <= 10;
    
    // Search events by description, game_type, location (only if text query and no rating search)
    if (query && !isRatingSearch && selectedGamesRatings.length === 0 && selectedGamesYears.length === 0) {
      scoutingGames.forEach(game => {
        if (game.description?.toLowerCase().includes(query) ||
            game.game_type?.toLowerCase().includes(query) ||
            game.location?.toLowerCase().includes(query)) {
          events.push(game);
        }
      });
    }
    
    // Search players - combine all conditions with AND logic
    allGamePlayers.forEach(player => {
      let matchesText = true;
      let matchesRating = true;
      let matchesYear = true;
      
      // Text search filter
      if (query && !isRatingSearch) {
        matchesText = (player.first_name?.toLowerCase().includes(query) || 
            player.last_name?.toLowerCase().includes(query) ||
            player.team_name?.toLowerCase().includes(query)) || false;
      }
      
      // Rating search (text input like "8")
      if (isRatingSearch) {
        matchesRating = player.rating === ratingQuery;
      }
      
      // Rating filter (dropdown)
      if (selectedGamesRatings.length > 0) {
        matchesRating = player.rating !== null && selectedGamesRatings.includes(player.rating);
      }
      
      // Year filter (dropdown)
      if (selectedGamesYears.length > 0) {
        matchesYear = player.birth_year !== null && selectedGamesYears.includes(player.birth_year);
      }
      
      // All conditions must match (AND logic)
      if (matchesText && matchesRating && matchesYear) {
        players.push(player);
      }
    });
    
    return { searchResultsEvents: events, searchResultsPlayers: players };
  }, [gamesSearchQuery, allGamePlayers, scoutingGames, selectedGamesRatings, selectedGamesYears]);

  // Available years in game players for filter
  const availableGamesYears = useMemo(() => {
    const years = new Set<string>();
    allGamePlayers.forEach(p => {
      if (p.birth_year) years.add(p.birth_year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allGamePlayers]);

  useEffect(() => {
    fetchCurrentUser(); fetchScoutedPlayers(); fetchScoutingGames(); fetchAdvisors(); fetchClubLogos();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleGlobalDragEnd = () => {
      setDraggedPlayerId(null);
      setDragOverStatus(null);
    };
    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  // Auto-update agent when player modal opens
  useEffect(() => {
    if (selectedPlayer && selectedPlayer.transfermarkt_url && showPlayerDetailModal) {
      checkAndUpdateAgent(selectedPlayer);
    }
  }, [selectedPlayer?.id, showPlayerDetailModal]);

  const checkAndUpdateAgent = async (player: ScoutedPlayer) => {
    if (!player.transfermarkt_url) return;
    
    // Check if we should update (once per day max)
    const lastUpdate = player.agent_updated_at ? new Date(player.agent_updated_at) : null;
    const now = new Date();
    const hoursSinceUpdate = lastUpdate ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60) : 999;
    
    if (hoursSinceUpdate < 24) return; // Don't update more than once per day
    
    setFetchingAgent(true);
    const agent = await fetchAgentFromTransfermarkt(player.transfermarkt_url);
    setFetchingAgent(false);
    
    if (agent && agent !== player.agent_name) {
      // Update in database
      const { error } = await supabase
        .from('scouted_players')
        .update({ agent_name: agent, agent_updated_at: now.toISOString() })
        .eq('id', player.id);
      
      if (!error) {
        // Update local state
        const updated = { ...player, agent_name: agent, agent_updated_at: now.toISOString() };
        setScoutedPlayers(prev => prev.map(p => p.id === player.id ? updated : p));
        setSelectedPlayer(updated);
      }
    } else if (!agent && player.agent_name) {
      // Agent was removed or not found, keep existing
    } else {
      // Just update the timestamp
      await supabase
        .from('scouted_players')
        .update({ agent_updated_at: now.toISOString() })
        .eq('id', player.id);
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: advisor } = await supabase.from('advisors').select('first_name, last_name, role').eq('id', user.id).single();
      if (advisor) {
        setCurrentUserName(`${advisor.first_name} ${advisor.last_name}`);
        setProfile({ first_name: advisor.first_name, last_name: advisor.last_name, role: advisor.role });
      }
    }
  };

  // Migration: Alte Status-Werte in neue umwandeln
  const migrateOldStatus = async () => {
    const statusMapping: Record<string, string> = {
      'zu_kontaktieren': 'in_beobachtung',
      'in_kontakt': 'kontaktiert',
      'archiviert': 'gesichtet', // Archivierte Spieler bekommen Status gesichtet + archived=true
    };

    for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
      // Prüfe ob es Spieler mit altem Status gibt
      const { data } = await supabase
        .from('scouted_players')
        .select('id, status')
        .eq('status', oldStatus);
      
      if (data && data.length > 0) {
        console.log(`Migriere ${data.length} Spieler von "${oldStatus}" zu "${newStatus}"`);
        
        if (oldStatus === 'archiviert') {
          // Archivierte Spieler: Status auf gesichtet + archived=true
          await supabase
            .from('scouted_players')
            .update({ status: newStatus, archived: true })
            .eq('status', oldStatus);
        } else {
          await supabase
            .from('scouted_players')
            .update({ status: newStatus })
            .eq('status', oldStatus);
        }
      }
    }
  };

  const fetchScoutedPlayers = async () => {
    setLoading(true);
    try {
      // Erst Migration durchführen
      await migrateOldStatus();

      const { data, error } = await supabase.from('scouted_players').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const scoutIds = [...new Set(data.map(p => p.scout_id).filter(Boolean))];
        if (scoutIds.length > 0) {
          const { data: scouts } = await supabase.from('advisors').select('id, first_name, last_name').in('id', scoutIds);
          const scoutMap: Record<string, string> = {};
          scouts?.forEach(s => scoutMap[s.id] = `${s.first_name} ${s.last_name}`);
          setScoutedPlayers(data.map(p => ({ ...p, scout_name: scoutMap[p.scout_id] || 'Unbekannt' })));
        } else {
          setScoutedPlayers(data);
        }
      } else if (error) {
        console.error('Fehler beim Laden der Scouting-Spieler:', error);
      }
    } catch (err) {
      console.error('Netzwerkfehler beim Laden der Scouting-Spieler:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScoutingGames = async () => {
    const { data, error } = await supabase.from('scouting_games').select('*').order('date', { ascending: true });
    if (!error && data) {
      const scoutIds = [...new Set(data.map(g => g.scout_id).filter(Boolean))];
      if (scoutIds.length > 0) {
        const { data: scouts } = await supabase.from('advisors').select('id, first_name, last_name').in('id', scoutIds);
        const scoutMap: Record<string, string> = {};
        scouts?.forEach(s => scoutMap[s.id] = `${s.first_name} ${s.last_name}`);
        setScoutingGames(data.map(g => ({ ...g, scout_name: scoutMap[g.scout_id] || 'Unbekannt' })));
      } else {
        setScoutingGames(data);
      }
      // Load all game players for search
      fetchAllGamePlayers(data);
    }
  };

  const fetchAllGamePlayers = async (games: ScoutingGame[]) => {
    const { data: players } = await supabase.from('scouting_game_players').select('*');
    const { data: teams } = await supabase.from('scouting_game_teams').select('*');
    if (players && teams) {
      const teamMap: Record<string, string> = {};
      teams.forEach(t => teamMap[t.id] = t.team_name);
      const gameMap: Record<string, ScoutingGame> = {};
      games.forEach(g => gameMap[g.id] = g);
      setAllGamePlayers(players.map(p => ({
        ...p,
        team_name: teamMap[p.team_id] || '',
        game: gameMap[p.game_id]
      })));
    }
  };

  const fetchAdvisors = async () => {
    const { data } = await supabase.from('advisors').select('id, first_name, last_name').order('last_name');
    if (data) setAdvisors(data);
  };

  const fetchClubLogos = async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logoMap: Record<string, string> = {};
      const names: string[] = [];
      data.forEach(item => { logoMap[item.club_name] = item.logo_url; names.push(item.club_name); });
      setClubLogos(logoMap);
      setClubNames(names.sort());
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    if (clubLogos[clubName]) return clubLogos[clubName];
    for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || logoClub.toLowerCase().includes(clubName.toLowerCase())) return logoUrl;
    }
    return null;
  };

  const getFilteredClubs = (searchTxt: string) => {
    if (!searchTxt || searchTxt.length === 0) return [];
    return clubNames
      .filter(name => {
        // Filter out 2. Mannschaften, U23, U21, II, B-Team etc.
        const lowerName = name.toLowerCase();
        if (lowerName.includes(' ii') || lowerName.includes(' 2') || lowerName.includes(' b')) return false;
        if (lowerName.includes('u23') || lowerName.includes('u21') || lowerName.includes('u19')) return false;
        if (lowerName.includes('reserve') || lowerName.includes('amateur')) return false;
        return name.toLowerCase().includes(searchTxt.toLowerCase());
      })
      .slice(0, 10);
  };

  const addScoutedPlayer = async () => {
    if (!newPlayer.first_name || !newPlayer.last_name || !currentUserId) return;
    
    // Duplikat-Prüfung: Prüfe in scouted_players und player_details
    const firstName = newPlayer.first_name.trim().toLowerCase();
    const lastName = newPlayer.last_name.trim().toLowerCase();
    
    // Prüfe in Scouting
    const { data: scoutingDuplicates } = await supabase
      .from('scouted_players')
      .select('id, first_name, last_name, club')
      .ilike('first_name', firstName)
      .ilike('last_name', lastName);
    
    // Prüfe in Spielerübersicht
    const { data: playerDuplicates } = await supabase
      .from('player_details')
      .select('id, first_name, last_name, club')
      .ilike('first_name', firstName)
      .ilike('last_name', lastName);
    
    const hasDuplicates = (scoutingDuplicates && scoutingDuplicates.length > 0) || (playerDuplicates && playerDuplicates.length > 0);
    
    if (hasDuplicates) {
      let message = `Ein Spieler mit dem Namen "${newPlayer.first_name} ${newPlayer.last_name}" existiert bereits:\n\n`;
      
      if (scoutingDuplicates && scoutingDuplicates.length > 0) {
        message += '📋 In Scouting:\n';
        scoutingDuplicates.forEach(p => {
          message += `  • ${p.first_name} ${p.last_name}${p.club ? ` (${p.club})` : ''}\n`;
        });
      }
      
      if (playerDuplicates && playerDuplicates.length > 0) {
        message += '\n👥 In Spielerübersicht:\n';
        playerDuplicates.forEach(p => {
          message += `  • ${p.first_name} ${p.last_name}${p.club ? ` (${p.club})` : ''}\n`;
        });
      }
      
      message += '\nTrotzdem anlegen?';
      
      const confirmAdd = window.confirm(message);
      if (!confirmAdd) return;
    }
    
    // Try to fetch agent if transfermarkt URL is provided
    let agentName = newPlayer.agent_name;
    if (newPlayer.transfermarkt_url && !agentName) {
      const fetchedAgent = await fetchAgentFromTransfermarkt(newPlayer.transfermarkt_url);
      if (fetchedAgent) agentName = fetchedAgent;
    }
    
    const playerData = {
      ...newPlayer,
      agent_name: agentName,
      agent_updated_at: newPlayer.transfermarkt_url ? new Date().toISOString() : null,
      scout_id: currentUserId,
      archived: false
    };
    
    const { error } = await supabase.from('scouted_players').insert(playerData);
    if (error) {
      console.error('Error adding player:', error);
      alert('Fehler beim Hinzufügen: ' + error.message);
    } else {
      // If this was from a game player, mark them as added
      if (addingGamePlayerId) {
        await supabase.from('scouting_game_players').update({ added_to_database: true }).eq('id', addingGamePlayerId);
        setAddingGamePlayerId(null);
      }
      
      setShowAddPlayerModal(false);
      setNewPlayer({ first_name: '', last_name: '', birth_date: '2005', position: 'ST', club: '', rating: 5, notes: '', status: 'gesichtet', photo_url: '', transfermarkt_url: '', agent_name: '', phone: '', additional_info: '', current_status: '' });
      setNewPlayerClubSearch('');
      fetchScoutedPlayers();
      
      // Reopen the game detail modal if we came from there
      if (gameToReopenAfterAdd) {
        const gameToReopen = gameToReopenAfterAdd;
        setGameToReopenAfterAdd(null);
        setTimeout(() => {
          openGameDetail(gameToReopen);
        }, 100);
      }
    }
  };

  const updateScoutedPlayer = async () => {
    if (!selectedPlayer || !editData) return;
    
    // Check if transfermarkt URL changed and fetch new agent
    let agentName = editData.agent_name;
    if (editData.transfermarkt_url && editData.transfermarkt_url !== selectedPlayer.transfermarkt_url) {
      const fetchedAgent = await fetchAgentFromTransfermarkt(editData.transfermarkt_url);
      if (fetchedAgent) agentName = fetchedAgent;
    }
    
    const updatePayload = {
      first_name: editData.first_name,
      last_name: editData.last_name,
      birth_date: editData.birth_date,
      position: editData.position,
      club: editData.club,
      rating: editData.rating,
      status: editData.status,
      notes: editData.notes,
      photo_url: editData.photo_url,
      transfermarkt_url: editData.transfermarkt_url,
      agent_name: agentName,
      agent_updated_at: editData.transfermarkt_url ? new Date().toISOString() : null,
      phone: editData.phone,
      additional_info: editData.additional_info,
      current_status: editData.current_status,
    };
    
    const { error } = await supabase.from('scouted_players').update(updatePayload).eq('id', selectedPlayer.id);
    if (error) {
      console.error('Update error:', error);
      alert('Fehler beim Speichern: ' + error.message);
    } else {
      const updatedPlayer = { ...selectedPlayer, ...updatePayload };
      setScoutedPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? updatedPlayer : p));
      setSelectedPlayer(updatedPlayer);
      setIsEditing(false);
      setShowEditClubDropdown(false);
    }
  };

  const addScoutingGame = async () => {
    if (!newGame.date || !newGame.description || !currentUserId) {
      alert('Bitte Datum und Beschreibung ausfüllen');
      return;
    }
    const gameData = {
      date: newGame.date,
      home_team: newGame.home_team || '',
      away_team: newGame.away_team || '',
      location: newGame.location || '',
      notes: newGame.notes || '',
      game_type: newGame.game_type || '',
      description: newGame.description || '',
      age_group: newGame.age_group || '',
      scout_id: newGame.scout_id || currentUserId
    };
    const { error } = await supabase.from('scouting_games').insert(gameData);
    if (!error) {
      setShowAddGameModal(false);
      setNewGame({ date: '', home_team: '', away_team: '', location: '', notes: '', game_type: '', description: '', age_group: '', scout_id: '' });
      setShowGameDatePicker(false);
      setGameDatePart(null);
      fetchScoutingGames();
    } else {
      alert('Fehler: ' + error.message);
    }
  };

  // Game detail functions
  const openGameDetail = async (game: ScoutingGame) => {
    setSelectedGame(game);
    setEditGameData(game);
    setShowGameDetailModal(true);
    setIsEditingGame(false);
    setSelectedTeam(null);
    setNewTeamName('');
    setNewGamePlayer({ number: '', last_name: '', first_name: '', rating: null, notes: '' });
    
    // Fetch teams and players for this game
    await fetchGameTeams(game.id);
    await fetchGamePlayers(game.id);
  };

  const fetchGameTeams = async (gameId: string) => {
    const { data } = await supabase
      .from('scouting_game_teams')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
    setGameTeams(data || []);
  };

  const fetchGamePlayers = async (gameId: string) => {
    const { data } = await supabase
      .from('scouting_game_players')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
    setGamePlayers(data || []);
  };

  const addTeam = async () => {
    if (!selectedGame || !newTeamName.trim()) return;
    const { error } = await supabase.from('scouting_game_teams').insert({
      game_id: selectedGame.id,
      team_name: newTeamName.trim()
    });
    if (!error) {
      setNewTeamName('');
      await fetchGameTeams(selectedGame.id);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!selectedGame) return;
    await supabase.from('scouting_game_players').delete().eq('team_id', teamId);
    await supabase.from('scouting_game_teams').delete().eq('id', teamId);
    if (selectedTeam?.id === teamId) setSelectedTeam(null);
    await fetchGameTeams(selectedGame.id);
    await fetchGamePlayers(selectedGame.id);
  };

  const addGamePlayer = async () => {
    if (!selectedGame || !selectedTeam) return;
    // Allow adding if at least one field is provided (any field counts)
    const hasNumber = newGamePlayer.number && newGamePlayer.number.trim().length > 0;
    const hasLastName = newGamePlayer.last_name && newGamePlayer.last_name.trim().length > 0;
    const hasFirstName = newGamePlayer.first_name && newGamePlayer.first_name.trim().length > 0;
    const hasBirthYear = newGamePlayer.birth_year && newGamePlayer.birth_year.trim().length > 0;
    const hasPosition = newGamePlayer.position && newGamePlayer.position.trim().length > 0;
    const hasRating = newGamePlayer.rating !== null;
    
    if (!hasNumber && !hasLastName && !hasFirstName && !hasBirthYear && !hasPosition && !hasRating) return;
    
    const playerData = {
      game_id: selectedGame.id,
      team_id: selectedTeam.id,
      number: newGamePlayer.number?.trim() || '',
      last_name: newGamePlayer.last_name?.trim() || '',
      first_name: newGamePlayer.first_name?.trim() || '',
      birth_year: newGamePlayer.birth_year?.trim() || '',
      position: newGamePlayer.position?.trim() || '',
      rating: newGamePlayer.rating,
      notes: newGamePlayer.notes || ''
    };
    
    const { error } = await supabase.from('scouting_game_players').insert(playerData);
    if (!error) {
      setNewGamePlayer({ number: '', last_name: '', first_name: '', birth_year: '', position: '', rating: null, notes: '' });
      await fetchGamePlayers(selectedGame.id);
      // Refresh all game players for search
      fetchAllGamePlayers(scoutingGames);
    }
  };

  const updateGamePlayerRating = async (playerId: string, rating: number) => {
    if (!selectedGame) return;
    // rating 0 means no rating (null)
    await supabase.from('scouting_game_players').update({ rating: rating === 0 ? null : rating }).eq('id', playerId);
    await fetchGamePlayers(selectedGame.id);
  };

  const deleteGamePlayer = async (playerId: string) => {
    if (!selectedGame) return;
    if (!confirm('Spieler wirklich löschen?')) return;
    await supabase.from('scouting_game_players').delete().eq('id', playerId);
    await fetchGamePlayers(selectedGame.id);
    // Refresh all game players for search
    fetchAllGamePlayers(scoutingGames);
  };

  const addGamePlayerToDatabase = (player: GamePlayer) => {
    // Get team name as club if available
    const team = gameTeams.find(t => t.id === player.team_id);
    const clubName = team?.team_name || '';
    
    // Store the game player ID being added
    setAddingGamePlayerId(player.id);
    
    // Store the current game to reopen after adding
    if (selectedGame) {
      setGameToReopenAfterAdd(selectedGame);
    }
    
    // Close the game detail modal first
    setSelectedGame(null);
    
    // Prefill the new player form with data from the game player
    setNewPlayer({
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      birth_date: player.birth_year || '2005',
      position: player.position || 'ST',
      club: clubName,
      rating: player.rating || 5,
      notes: player.notes || '',
      status: 'gesichtet',
      photo_url: '',
      transfermarkt_url: '',
      agent_name: '',
      phone: '',
      additional_info: '',
      current_status: ''
    });
    setNewPlayerClubSearch(clubName);
    
    // Open the add player modal
    setShowAddPlayerModal(true);
  };

  const openPlayerNotes = (player: GamePlayer) => {
    setSelectedGamePlayer(player);
    setEditingPlayerNotes(player.notes || '');
    setShowPlayerNotesModal(true);
  };

  const savePlayerNotes = async () => {
    if (!selectedGamePlayer || !selectedGame) return;
    await supabase.from('scouting_game_players').update({ 
      notes: editingPlayerNotes,
      number: selectedGamePlayer.number,
      last_name: selectedGamePlayer.last_name,
      first_name: selectedGamePlayer.first_name,
      birth_year: selectedGamePlayer.birth_year,
      position: selectedGamePlayer.position,
      rating: selectedGamePlayer.rating
    }).eq('id', selectedGamePlayer.id);
    setShowPlayerNotesModal(false);
    setSelectedGamePlayer(null);
    await fetchGamePlayers(selectedGame.id);
  };

  const updateSelectedGamePlayerRating = (rating: number | null) => {
    if (!selectedGamePlayer) return;
    setSelectedGamePlayer({ ...selectedGamePlayer, rating });
  };

  const updateSelectedGamePlayer = (field: string, value: string) => {
    if (!selectedGamePlayer) return;
    setSelectedGamePlayer({ ...selectedGamePlayer, [field]: value });
  };

  const saveGameEdit = async () => {
    if (!selectedGame || !editGameData) return;
    const { error } = await supabase.from('scouting_games').update({
      date: editGameData.date,
      home_team: editGameData.home_team,
      away_team: editGameData.away_team,
      location: editGameData.location,
      notes: editGameData.notes,
      game_type: editGameData.game_type,
      description: editGameData.description,
      age_group: editGameData.age_group
    }).eq('id', selectedGame.id);
    
    if (!error) {
      fetchScoutingGames();
      setSelectedGame({ ...selectedGame, ...editGameData } as ScoutingGame);
      setIsEditingGame(false);
    }
  };

  const closeAllGameDropdowns = () => {
    setShowGameDatePicker(false);
    setGameDatePart(null);
    setShowGameTypePicker(false);
    setShowAgeGroupPicker(false);
    setShowScoutPicker(false);
  };

  const closeAllEditDropdowns = () => {
    setShowEditDatePicker(false);
    setEditDatePart(null);
    setShowEditGameTypePicker(false);
    setShowEditAgeGroupPicker(false);
    setEditingPlayerId(null);
    setShowNewPlayerPositionPicker(false);
    setShowNewPlayerRatingPicker(false);
    setShowEditPlayerPositionPicker(false);
    setShowEditPlayerRatingPicker(false);
  };

  const updatePlayerStatus = async (playerId: string, newStatus: string) => {
    const { error } = await supabase.from('scouted_players').update({ status: newStatus }).eq('id', playerId);
    if (!error) {
      setScoutedPlayers(prev => prev.map(p => p.id === playerId ? { ...p, status: newStatus } : p));
    }
  };

  const deleteScoutedPlayer = async (playerId: string) => {
    const { error } = await supabase.from('scouted_players').delete().eq('id', playerId);
    if (!error) { 
      setScoutedPlayers(prev => prev.filter(p => p.id !== playerId)); 
      setShowPlayerDetailModal(false); 
      setIsEditing(false);
    }
  };

  const deleteScoutingGame = async (gameId: string) => {
    const { error } = await supabase.from('scouting_games').delete().eq('id', gameId);
    if (!error) fetchScoutingGames();
  };

  // Archivierte Spieler zählen
  const archivedPlayersCount = scoutedPlayers.filter(p => p.archived).length;

  // Aktive (nicht archivierte) Spieler filtern
  const activePlayers = scoutedPlayers.filter(p => !p.archived);
  const archivedPlayers = scoutedPlayers.filter(p => p.archived);

  const filteredPlayers = activePlayers.filter(p => {
    const matchesSearch = searchText === '' || 
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchText.toLowerCase()) || 
      (p.club && p.club.toLowerCase().includes(searchText.toLowerCase()));
    const matchesPosition = selectedPositions.length === 0 || selectedPositions.includes(p.position);
    const matchesYear = selectedYears.length === 0 || selectedYears.includes(getYearFromDate(p.birth_date));
    const matchesRating = selectedRatings.length === 0 || selectedRatings.includes(p.rating);
    return matchesSearch && matchesPosition && matchesYear && matchesRating;
  });

  const getPlayersByStatus = (status: string) => filteredPlayers
    .filter(p => p.status === status)
    .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '', 'de'));

  // Archivieren
  const archivePlayer = async () => {
    if (!selectedPlayer) return;
    const { error } = await supabase.from('scouted_players').update({
      archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: archiveReason
    }).eq('id', selectedPlayer.id);
    
    if (!error) {
      setScoutedPlayers(prev => prev.map(p => 
        p.id === selectedPlayer.id ? { ...p, archived: true, archived_at: new Date().toISOString(), archive_reason: archiveReason } : p
      ));
      setShowArchiveModal(false);
      setShowDecisionModal(false);
      setShowPlayerDetailModal(false);
      setArchiveReason('');
    }
  };

  // Wiederherstellen
  const restorePlayer = async (playerId: string) => {
    const { error } = await supabase.from('scouted_players').update({
      archived: false,
      archived_at: null,
      archive_reason: null
    }).eq('id', playerId);
    
    if (!error) {
      setScoutedPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, archived: false, archived_at: undefined, archive_reason: undefined } : p
      ));
    }
  };

  // In Spielerübersicht übernehmen
  const transferToPlayers = async () => {
    if (!selectedPlayer || !transferListing || !transferResponsibility) {
      alert('Bitte Listung und Zuständigkeit auswählen');
      return;
    }

    // Duplikat-Prüfung in player_details
    const firstName = selectedPlayer.first_name.trim().toLowerCase();
    const lastName = selectedPlayer.last_name.trim().toLowerCase();
    
    const { data: playerDuplicates } = await supabase
      .from('player_details')
      .select('id, first_name, last_name, club')
      .ilike('first_name', firstName)
      .ilike('last_name', lastName);
    
    if (playerDuplicates && playerDuplicates.length > 0) {
      let message = `Ein Spieler mit dem Namen "${selectedPlayer.first_name} ${selectedPlayer.last_name}" existiert bereits in der Spielerübersicht:\n\n`;
      
      playerDuplicates.forEach(p => {
        message += `  • ${p.first_name} ${p.last_name}${p.club ? ` (${p.club})` : ''}\n`;
      });
      
      message += '\nTrotzdem übernehmen?';
      
      const confirmAdd = window.confirm(message);
      if (!confirmAdd) return;
    }

    // Spieler in player_details-Tabelle einfügen
    // birth_date: Falls nur Jahrgang (z.B. "2005"), nicht übernehmen (null)
    let birthDate = selectedPlayer.birth_date;
    if (birthDate && birthDate.length === 4) {
      birthDate = null; // Nur Jahrgang - nicht übernehmen
    }
    
    const playerData = {
      first_name: selectedPlayer.first_name,
      last_name: selectedPlayer.last_name,
      birth_date: birthDate || null,
      position: selectedPlayer.position,
      club: selectedPlayer.club,
      phone: selectedPlayer.phone,
      transfermarkt_url: selectedPlayer.transfermarkt_url,
      listing: transferListing,
      responsibility: transferResponsibility,
    };

    const { error: insertError } = await supabase.from('player_details').insert(playerData);
    
    if (insertError) {
      alert('Fehler beim Übernehmen: ' + insertError.message);
      return;
    }

    // Spieler aus Scouting löschen
    const { error: deleteError } = await supabase.from('scouted_players').delete().eq('id', selectedPlayer.id);
    
    if (!deleteError) {
      setScoutedPlayers(prev => prev.filter(p => p.id !== selectedPlayer.id));
      setShowTransferModal(false);
      setShowDecisionModal(false);
      setShowPlayerDetailModal(false);
      setTransferListing('');
      setTransferResponsibility('');
      alert(`${selectedPlayer.first_name} ${selectedPlayer.last_name} wurde in die Spielerübersicht übernommen!`);
    }
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  const toggleYear = (year: string) => {
    setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  const toggleRating = (rating: number) => {
    setSelectedRatings(prev => prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]);
  };

  const clearPositions = () => setSelectedPositions([]);
  const clearYears = () => setSelectedYears([]);
  const clearRatings = () => setSelectedRatings([]);

  const onDragStart = (e: any, playerId: string) => {
    if (Platform.OS !== 'web') return;
    setDraggedPlayerId(playerId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', playerId);
    setTimeout(() => {
      const el = document.querySelector(`[data-player-id="${playerId}"]`);
      if (el) (el as HTMLElement).style.opacity = '0.4';
    }, 0);
  };

  const onDragEnd = () => {
    if (Platform.OS !== 'web') return;
    const el = document.querySelector(`[data-player-id="${draggedPlayerId}"]`);
    if (el) (el as HTMLElement).style.opacity = '1';
    setDraggedPlayerId(null);
    setDragOverStatus(null);
  };

  const onDragOver = (e: any, statusId: string) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStatus !== statusId) setDragOverStatus(statusId);
  };

  const onDragLeave = (e: any, statusId: string) => {
    if (Platform.OS !== 'web') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      if (dragOverStatus === statusId) setDragOverStatus(null);
    }
  };

  const onDrop = async (e: any, targetStatus: string) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain') || draggedPlayerId;
    if (playerId) {
      const player = scoutedPlayers.find(p => p.id === playerId);
      if (player && player.status !== targetStatus) {
        await updatePlayerStatus(playerId, targetStatus);
      }
    }
    setDraggedPlayerId(null);
    setDragOverStatus(null);
  };

  const openTransfermarkt = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const renderClubSelector = (
    searchTxt: string, setSearchTxt: (t: string) => void,
    showDrop: boolean, setShowDrop: (s: boolean) => void,
    onSelect: (c: string) => void
  ) => {
    const list = getFilteredClubs(searchTxt);
    return (
      <View style={styles.clubSelectorContainer}>
        <TextInput 
          style={styles.formInput} 
          value={searchTxt} 
          onChangeText={(t) => { setSearchTxt(t); onSelect(t); setShowDrop(t.length > 0 && getFilteredClubs(t).length > 0); }} 
          onFocus={() => { if (searchTxt.length > 0 && getFilteredClubs(searchTxt).length > 0) setShowDrop(true); }}
          onBlur={() => setTimeout(() => setShowDrop(false), 200)}
          placeholder="Verein suchen..." placeholderTextColor="#999"
          placeholderTextColor="#9ca3af"
        />
        {showDrop && list.length > 0 && (
          <View style={styles.clubDropdown}>
            <ScrollView style={styles.clubDropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {list.map((club) => (
                <TouchableOpacity key={club} style={styles.clubDropdownItem} onPress={() => { setSearchTxt(club); onSelect(club); setShowDrop(false); }}>
                  {getClubLogo(club) && <Image source={{ uri: getClubLogo(club)! }} style={styles.clubDropdownLogo} />}
                  <Text style={styles.clubDropdownText}>{club}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderPlayerCard = (player: ScoutedPlayer) => {
    const isDragging = draggedPlayerId === player.id;
    
    const cardContent = (
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={() => { 
          setSelectedPlayer(player); 
          setEditData({
            first_name: player.first_name, last_name: player.last_name, birth_date: player.birth_date,
            position: player.position, club: player.club, rating: player.rating, status: player.status,
            notes: player.notes, photo_url: player.photo_url, transfermarkt_url: player.transfermarkt_url,
            agent_name: player.agent_name, phone: player.phone, additional_info: player.additional_info,
            current_status: player.current_status,
          }); 
          setEditClubSearchText(player.club || ''); 
          setShowPlayerDetailModal(true); 
        }}
      >
        <View style={styles.cardHeader}>
          {getClubLogo(player.club) && <Image source={{ uri: getClubLogo(player.club)! }} style={styles.clubLogoCard} />}
          <View style={styles.cardInfo}>
            <Text style={styles.playerName}>{player.last_name}, {player.first_name}</Text>
            <Text style={styles.playerYear}>Jg. {getYearFromDate(player.birth_date)}</Text>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.positionBadgesRow}>
              {parsePositions(player.position).map((pos, idx) => (
                <View key={idx} style={styles.positionBadge}><Text style={styles.positionText}>{pos}</Text></View>
              ))}
            </View>
            {player.rating && <View style={styles.ratingBadgeCard}><Text style={styles.ratingTextCard}>⭐ {player.rating}/10</Text></View>}
          </View>
        </View>
        {/* IST-Stand */}
        {player.current_status && (
          <View style={styles.currentStatusRow}>
            <Text style={styles.currentStatusText}>💬 {player.current_status}</Text>
          </View>
        )}
      </TouchableOpacity>
    );

    if (Platform.OS === 'web') {
      return (
        <div key={player.id} data-player-id={player.id} draggable onDragStart={(e) => onDragStart(e, player.id)} onDragEnd={onDragEnd}
          style={{ backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'grab', opacity: isDragging ? 0.4 : 1 }}>
          {cardContent}
        </div>
      );
    }
    return <View key={player.id} style={styles.playerCard}>{cardContent}</View>;
  };

  const renderKanbanColumn = (status: typeof SCOUTING_STATUS[0]) => {
    const players = getPlayersByStatus(status.id);
    const isDropTarget = dragOverStatus === status.id;
    
    if (Platform.OS === 'web') {
      return (
        <div key={status.id} onDragOver={(e) => onDragOver(e, status.id)} onDragLeave={(e) => onDragLeave(e, status.id)} onDrop={(e) => onDrop(e, status.id)}
          style={{ 
            flex: 1,
            minWidth: 250,
            backgroundColor: isDropTarget ? '#dbeafe' : '#f1f5f9', 
            borderRadius: 12, 
            padding: 12, 
            border: isDropTarget ? '2px dashed #3b82f6' : '2px solid transparent', 
            transition: 'background-color 0.2s', 
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 250px)',
          }}>
          <View style={styles.kanbanHeader}>
            <View style={styles.kanbanHeaderTop}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={styles.kanbanTitle}>{status.label}</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{players.length}</Text></View>
            </View>
            <Text style={styles.kanbanDescription}>{status.description}</Text>
          </View>
          <div style={{ flex: 1, overflowY: 'scroll', paddingRight: 4 }}>
            {players.map(player => renderPlayerCard(player))}
          </div>
        </div>
      );
    }
    return (
      <View style={[styles.kanbanColumn, isDropTarget && styles.kanbanColumnDropTarget]} key={status.id}>
        <View style={styles.kanbanHeader}>
          <View style={styles.kanbanHeaderTop}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.kanbanTitle}>{status.label}</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{players.length}</Text></View>
          </View>
          <Text style={styles.kanbanDescription}>{status.description}</Text>
        </View>
        <ScrollView style={styles.kanbanContent} showsVerticalScrollIndicator={false}>
          {players.map(player => renderPlayerCard(player))}
        </ScrollView>
      </View>
    );
  };

  const renderListView = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Name</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>Geb.</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Pos.</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Verein</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Berater</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Rating</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Scout</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Status</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.3 }]}>TM</Text>
      </View>
      <ScrollView>
        {filteredPlayers.map(player => (
          <TouchableOpacity key={player.id} style={styles.tableRow} onPress={() => { 
            setSelectedPlayer(player); 
            setEditData({ first_name: player.first_name, last_name: player.last_name, birth_date: player.birth_date,
              position: player.position, club: player.club, rating: player.rating, status: player.status,
              notes: player.notes, photo_url: player.photo_url, transfermarkt_url: player.transfermarkt_url, 
              agent_name: player.agent_name, phone: player.phone, additional_info: player.additional_info,
              current_status: player.current_status }); 
            setEditClubSearchText(player.club || ''); 
            setShowPlayerDetailModal(true); 
          }}>
            <Text style={[styles.tableCell, styles.tableCellText, { flex: 1.6 }]}>{player.last_name}, {player.first_name}</Text>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>{getYearFromDate(player.birth_date)}</Text>
            <View style={[styles.tableCell, { flex: 0.8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
              {parsePositions(player.position).map((pos, idx) => (
                <View key={idx} style={styles.positionBadgeSmall}><Text style={styles.positionTextSmall}>{pos}</Text></View>
              ))}
            </View>
            <Text style={[styles.tableCell, { flex: 1.4 }]} numberOfLines={1}>{player.club}</Text>
            <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>{player.agent_name || '-'}</Text>
            <View style={[styles.tableCell, { flex: 0.7, flexDirection: 'row' }]}>
              {player.rating ? <View style={styles.ratingBadgeList}><Text style={styles.ratingTextList}>⭐ {player.rating}/10</Text></View> : <Text style={styles.tableCell}>-</Text>}
            </View>
            <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>{player.scout_name}</Text>
            <Text style={[styles.tableCell, { flex: 1.1, color: SCOUTING_STATUS.find(s => s.id === player.status)?.color }]}>
              {SCOUTING_STATUS.find(s => s.id === player.status)?.label}
            </Text>
            <View style={[styles.tableCell, { flex: 0.3 }]}>
              {player.transfermarkt_url && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); openTransfermarkt(player.transfermarkt_url!); }}>
                  <Image source={TransfermarktLogo} style={styles.tmLogoSmall} />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Check if a game player is already in the scouted_players database (by name match)
  const isPlayerInDatabase = (player: GamePlayer): boolean => {
    return scoutedPlayers.some(sp => 
      sp.last_name?.toLowerCase() === player.last_name?.toLowerCase() &&
      sp.first_name?.toLowerCase() === player.first_name?.toLowerCase() &&
      !sp.archived
    );
  };

  // Add game player to database from search results
  const addSearchPlayerToDatabase = (player: GamePlayer & { game?: ScoutingGame, team_name?: string }) => {
    const clubName = player.team_name || '';
    
    setNewPlayer({
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      birth_date: player.birth_year || '2005',
      position: player.position || 'ST',
      club: clubName,
      rating: player.rating || 5,
      notes: player.notes || '',
      status: 'gesichtet',
      photo_url: '',
      transfermarkt_url: '',
      agent_name: '',
      phone: '',
      additional_info: '',
      current_status: ''
    });
    setNewPlayerClubSearch(clubName);
    setShowAddPlayerModal(true);
  };

  const renderGamesTab = () => {
    const gamesToShow = gamesViewMode === 'upcoming' ? upcomingGames : gamesViewMode === 'archive' ? archivedGames : [];
    const hasSearchOrFilter = gamesSearchQuery.trim() || selectedGamesRatings.length > 0 || selectedGamesYears.length > 0;
    const totalResults = searchResultsEvents.length + searchResultsPlayers.length;
    
    const closeGamesDropdowns = () => {
      setShowGamesRatingDropdown(false);
      setShowGamesYearDropdown(false);
    };
    
    return (
      <Pressable style={styles.gamesContainer} onPress={closeGamesDropdowns}>
        {/* Search Results */}
        {gamesViewMode === 'search' && (
          <ScrollView>
            {/* Events Results */}
            {searchResultsEvents.length > 0 && (
              <>
                <View style={styles.searchResultsHeader}>
                  <Text style={styles.searchResultsTitle}>Events ({searchResultsEvents.length})</Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Datum</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Art</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Beschreibung</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Mannschaft</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Scout</Text>
                </View>
                {searchResultsEvents.map(game => (
                  <TouchableOpacity 
                    key={game.id} 
                    style={styles.tableRow} 
                    onPress={() => openGameDetail(game)}
                  >
                    <Text style={[styles.tableCell, { flex: 1 }]}>{formatGameDate(game.date)}</Text>
                    <Text style={[styles.tableCell, { flex: 0.8, color: '#6b7280' }]}>{game.game_type || '-'}</Text>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }]}>{game.description || '-'}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6 }]}>{game.age_group || '-'}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{game.scout_name || '-'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Players Results */}
            {searchResultsPlayers.length > 0 && (
              <>
                <View style={[styles.searchResultsHeader, searchResultsEvents.length > 0 && { marginTop: 16 }]}>
                  <Text style={styles.searchResultsTitle}>Spieler ({searchResultsPlayers.length})</Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Position</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Verein</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.45 }]}>Jahrgang</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.55 }]}>Einschätzung</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>Notiz</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Event</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}></Text>
                </View>
                {searchResultsPlayers.map(player => {
                  const inDatabase = isPlayerInDatabase(player);
                  return (
                    <View key={player.id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.tableCellText, { flex: 1 }]}>
                        {player.last_name}{player.first_name ? `, ${player.first_name}` : ''}
                      </Text>
                      <View style={[styles.tableCell, { flex: 0.7 }]}>
                        {player.position ? (
                          <View style={styles.positionBadgeSmall}><Text style={styles.positionTextSmall}>{player.position}</Text></View>
                        ) : (
                          <Text>-</Text>
                        )}
                      </View>
                      <Text style={[styles.tableCell, { flex: 0.8 }]}>{player.team_name || '-'}</Text>
                      <Text style={[styles.tableCell, { flex: 0.45 }]}>{player.birth_year || '-'}</Text>
                      <View style={[styles.tableCell, { flex: 0.55 }]}>
                        {player.rating ? (
                          <View style={styles.ratingBadgeTight}><Text style={styles.ratingTextTight}>⭐ {player.rating}/10</Text></View>
                        ) : (
                          <Text>-</Text>
                        )}
                      </View>
                      <TouchableOpacity 
                        style={[styles.tableCell, { flex: 0.4 }]}
                        onPress={() => {
                          if (player.notes) {
                            setSelectedGamePlayer(player);
                            setEditingPlayerNotes(player.notes);
                            setShowPlayerNotesModal(true);
                          }
                        }}
                      >
                        <Text style={{ color: player.notes ? '#3b82f6' : '#9ca3af' }}>{player.notes ? '📝' : '-'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.tableCell, { flex: 0.9 }]}
                        onPress={() => player.game && openGameDetail(player.game)}
                      >
                        <Text style={{ color: '#3b82f6' }}>{player.game?.description || '-'}</Text>
                      </TouchableOpacity>
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        {inDatabase ? (
                          <View style={styles.addedToDatabaseBtn}>
                            <Text style={styles.addedToDatabaseBtnText}>wurde zur Spieler-Datenbank hinzugefügt</Text>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={styles.addToDatabaseBtn}
                            onPress={() => addSearchPlayerToDatabase(player)}
                          >
                            <Text style={styles.addToDatabaseBtnText}>zur Spieler-Datenbank hinzufügen</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {totalResults === 0 && (
              <View style={styles.emptyArchiv}>
                <Text style={styles.emptyArchivText}>
                  {gamesSearchQuery ? `Keine Ergebnisse für "${gamesSearchQuery}"` : 'Keine Ergebnisse für die ausgewählten Filter'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Games List (upcoming or archive) */}
        {gamesViewMode !== 'search' && (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Datum</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Art</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Beschreibung</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Mannschaft</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Scout</Text>
            </View>
            <ScrollView>
              {gamesToShow.map(game => (
                <TouchableOpacity 
                  key={game.id} 
                  style={[styles.tableRow, isGameToday(game.date) && styles.tableRowToday]} 
                  onPress={() => openGameDetail(game)}
                >
                  <Text style={[styles.tableCell, { flex: 1 }, isGameToday(game.date) && styles.tableCellToday]}>{formatGameDate(game.date)}</Text>
                  <Text style={[styles.tableCell, { flex: 0.8, color: isGameToday(game.date) ? '#166534' : '#6b7280' }]}>{game.game_type || '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }, isGameToday(game.date) && styles.tableCellToday]}>{game.description || `${game.home_team} vs ${game.away_team}`}</Text>
                  <Text style={[styles.tableCell, { flex: 0.6 }, isGameToday(game.date) && styles.tableCellToday]}>{game.age_group || '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }, isGameToday(game.date) && styles.tableCellToday]}>{game.scout_name || '-'}</Text>
                </TouchableOpacity>
              ))}
              {gamesToShow.length === 0 && (
                <View style={styles.emptyArchiv}>
                  <Text style={styles.emptyArchivText}>
                    {gamesViewMode === 'upcoming' ? 'Keine anstehenden Termine' : 'Keine archivierten Termine'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </Pressable>
    );
  };

  const renderArchivView = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Geb.</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Pos.</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Verein</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Grund</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Archiviert am</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}></Text>
      </View>
      <ScrollView>
        {archivedPlayers.length === 0 ? (
          <View style={styles.emptyArchiv}>
            <Text style={styles.emptyArchivText}>Keine archivierten Spieler</Text>
          </View>
        ) : (
          archivedPlayers.map(player => (
            <View key={player.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableCellText, { flex: 2 }]}>{player.last_name}, {player.first_name}</Text>
              <Text style={[styles.tableCell, { flex: 0.5 }]}>{getYearFromDate(player.birth_date)}</Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>{player.position}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{player.club}</Text>
              <Text style={[styles.tableCell, { flex: 2, color: '#64748b', fontStyle: 'italic' }]}>{player.archive_reason || '-'}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{player.archived_at ? new Date(player.archived_at).toLocaleDateString('de-DE') : '-'}</Text>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <TouchableOpacity style={styles.restoreButton} onPress={() => restorePlayer(player.id)}>
                  <Text style={styles.restoreButtonText}>Wiederherstellen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderPlayerForm = (
    data: any, setData: (d: any) => void,
    clubSearch: string, setClubSearch: (t: string) => void,
    showClubDrop: boolean, setShowClubDrop: (s: boolean) => void
  ) => (
    <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      {/* Erste Säule: Grunddaten + Kontakt */}
      <View style={[styles.detailInfo, { zIndex: 9999 }]}>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Vorname *</Text>
            <TextInput style={styles.formInput} value={data.first_name} onChangeText={(t) => setData({...data, first_name: t})} placeholder="Vorname" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Nachname *</Text>
            <TextInput style={styles.formInput} value={data.last_name} onChangeText={(t) => setData({...data, last_name: t})} placeholder="Nachname" placeholderTextColor="#9ca3af" />
          </View>
        </View>
        <View style={[styles.formRow, { zIndex: 9999 }]}>
          <View style={[styles.formField, { zIndex: 9999 }]}>
            <Text style={styles.formLabel}>Verein</Text>
            {renderClubSelector(clubSearch, setClubSearch, showClubDrop, setShowClubDrop, (c) => setData({...data, club: c}))}
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Geburtsdatum / Jahrgang</Text>
            <TextInput style={styles.formInput} value={data.birth_date || ''} onChangeText={(t) => setData({...data, birth_date: t})} placeholder="YYYY-MM-DD oder YYYY" placeholderTextColor="#9ca3af" />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Kontakt</Text>
            <TextInput 
              style={styles.formInput} 
              value={data.phone || ''} 
              onChangeText={(t) => setData({...data, phone: t})} 
              placeholder="Telefonnummer..." placeholderTextColor="#999"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>IST-Stand</Text>
            <TextInput 
              style={styles.formInput} 
              value={data.current_status || ''} 
              onChangeText={(t) => setData({...data, current_status: t})} 
              placeholder="z.B. Termin am 15.01." placeholderTextColor="#999"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      </View>

      {/* Zweite Säule: Position + Einschätzung */}
      <View style={[styles.detailInfo, { zIndex: 1 }]}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Position:</Text>
          <View style={styles.positionPickerSmall}>
            <TouchableOpacity 
              style={[styles.positionOptionSmall, (!data.position || data.position === '') && styles.positionOptionSelected]} 
              onPress={() => setData({...data, position: ''})}
            >
              <Text style={[styles.positionOptionTextSmall, (!data.position || data.position === '') && styles.positionOptionTextSelected]}>-</Text>
            </TouchableOpacity>
            {POSITIONS.map(pos => {
              const currentPositions = parsePositions(data.position || '');
              const isSelected = currentPositions.includes(pos);
              return (
                <TouchableOpacity 
                  key={pos} 
                  style={[styles.positionOptionSmall, isSelected && styles.positionOptionSelected]} 
                  onPress={() => {
                    const newPositions = isSelected 
                      ? currentPositions.filter(p => p !== pos)
                      : [...currentPositions, pos];
                    setData({...data, position: formatPositions(newPositions)});
                  }}
                >
                  <Text style={[styles.positionOptionTextSmall, isSelected && styles.positionOptionTextSelected]}>{pos}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Einschätzung:</Text>
          <View style={styles.ratingPickerSmall}>
            <TouchableOpacity style={[styles.ratingOptionSmall, !data.rating && styles.ratingOptionSelected]} onPress={() => setData({...data, rating: null})}>
              <Text style={[styles.ratingOptionTextSmall, !data.rating && styles.ratingOptionTextSelected]}>-</Text>
            </TouchableOpacity>
            {[1,2,3,4,5,6,7,8,9,10].map(r => (
              <TouchableOpacity key={r} style={[styles.ratingOptionSmall, data.rating === r && styles.ratingOptionSelected]} onPress={() => setData({...data, rating: r})}>
                <Text style={[styles.ratingOptionTextSmall, data.rating === r && styles.ratingOptionTextSelected]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Dritte Säule: Transfermarkt + Scout */}
      <View style={styles.detailInfo}>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Transfermarkt Link</Text>
          <View style={styles.tmInputRow}>
            <TextInput 
              style={[styles.formInput, { flex: 1 }]} 
              value={data.transfermarkt_url || ''} 
              onChangeText={(t) => setData({...data, transfermarkt_url: t})} 
              placeholder="https://www.transfermarkt.de/spieler/profil/..." placeholderTextColor="#999"
              placeholderTextColor="#9ca3af"
            />
            {data.transfermarkt_url && (
              <TouchableOpacity style={styles.tmButton} onPress={() => openTransfermarkt(data.transfermarkt_url)}>
                <Image source={TransfermarktLogo} style={styles.tmLogoMedium} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Vierte Säule: Weitere Infos */}
      <View style={[styles.detailSection, { marginBottom: 10 }]}>
        <Text style={styles.detailSectionTitle}>Weitere Infos</Text>
        <TextInput style={[styles.formInput, styles.textArea]} value={data.additional_info || ''} onChangeText={(t) => setData({...data, additional_info: t})} placeholder="Weitere Informationen..." placeholderTextColor="#9ca3af" multiline />
      </View>

      {/* Ganz unten: Fußballerische Einschätzung */}
      <View style={[styles.detailSection, { marginBottom: 20 }]}>
        <Text style={styles.detailSectionTitle}>Fußballerische Einschätzung</Text>
        <TextInput style={[styles.formInput, styles.textArea]} value={data.notes || ''} onChangeText={(t) => setData({...data, notes: t})} placeholder="Fußballerische Einschätzung..." placeholderTextColor="#9ca3af" multiline />
      </View>
    </ScrollView>
  );

  const getPositionFilterLabel = () => {
    if (selectedPositions.length === 0) return 'Position';
    if (selectedPositions.length === 1) return selectedPositions[0];
    return `${selectedPositions.length} Positionen`;
  };

  const getYearFilterLabel = () => {
    if (selectedYears.length === 0) return 'Jahrgang';
    if (selectedYears.length === 1) return `Jg. ${selectedYears[0]}`;
    return `${selectedYears.length} Jahrgänge`;
  };

  const getRatingFilterLabel = () => {
    if (selectedRatings.length === 0) return 'Rating';
    if (selectedRatings.length === 1) return `${selectedRatings[0]}/10`;
    return `${selectedRatings.length} Ratings`;
  };

  // Alle Dropdowns schließen
  const closeAllDropdowns = () => {
    setShowPositionDropdown(false);
    setShowYearDropdown(false);
    setShowRatingDropdown(false);
    setShowGamesYearDropdown(false);
    setShowGamesRatingDropdown(false);
  };

  const closeAddPlayerModal = () => {
    setShowAddPlayerModal(false);
    setNewPlayerClubSearch('');
    setShowNewPlayerClubDropdown(false);
    setAddingGamePlayerId(null);
    
    // Reopen the game detail modal if we came from there
    if (gameToReopenAfterAdd) {
      setTimeout(() => {
        openGameDetail(gameToReopenAfterAdd);
        setGameToReopenAfterAdd(null);
      }, 100);
    }
  };

  return (
    <Pressable style={[styles.container, isMobile && styles.containerMobile]} onPress={closeAllDropdowns}>
      <Sidebar navigation={navigation} activeScreen="scouting" profile={profile} />
      <View style={styles.mainContent}>
        {/* Header Banner - weiß mit Titel mittig */}
        <View style={styles.headerBanner}>
          <TouchableOpacity style={styles.filterButton} onPress={() => navigation.navigate('AdvisorDashboard')}>
            <Text style={styles.filterButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.headerBannerCenter}>
            <Text style={styles.title}>Scouting Area</Text>
            <Text style={styles.subtitle}>Manage Talente, Berichte und Spieltermine.</Text>
          </View>
          <View style={styles.headerTabs}>
            <TouchableOpacity style={[styles.filterButton, activeTab === 'spieler' && styles.filterButtonActive]} onPress={() => setActiveTab('spieler')}>
              <Text style={[styles.filterButtonText, activeTab === 'spieler' && styles.filterButtonTextActive]}>Spieler-Datenbank</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterButton, activeTab === 'spiele' && styles.filterButtonActive]} onPress={() => setActiveTab('spiele')}>
              <Text style={[styles.filterButtonText, activeTab === 'spiele' && styles.filterButtonTextActive]}>Scouting-Termine</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder={activeTab === 'spieler' ? "Spieler, Verein suchen..." : "Spieler, Verein, Event suchen..."} 
              placeholderTextColor="#9ca3af" 
              value={activeTab === 'spieler' ? searchText : gamesSearchQuery} 
              onChangeText={(text) => {
                if (activeTab === 'spieler') {
                  setSearchText(text);
                } else {
                  setGamesSearchQuery(text);
                  if (text.trim()) {
                    setGamesViewMode('search');
                  } else {
                    setGamesViewMode('upcoming');
                  }
                }
              }} 
            />
            {activeTab === 'spiele' && gamesSearchQuery && (
              <TouchableOpacity onPress={() => { setGamesSearchQuery(''); setGamesViewMode('upcoming'); }}>
                <Text style={{ fontSize: 16, color: '#9ca3af', marginLeft: 8 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {activeTab === 'spieler' && (
            <View style={styles.filterContainer}>
              <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
                <TouchableOpacity style={[styles.filterButton, selectedPositions.length > 0 && styles.filterButtonActive]} 
                  onPress={(e) => { e.stopPropagation(); setShowPositionDropdown(!showPositionDropdown); setShowYearDropdown(false); setShowRatingDropdown(false); }}>
                  <Text style={[styles.filterButtonText, selectedPositions.length > 0 && styles.filterButtonTextActive]}>{getPositionFilterLabel()} ▼</Text>
                </TouchableOpacity>
                {showPositionDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Positionen wählen</Text>
                      {selectedPositions.length > 0 && <TouchableOpacity onPress={clearPositions}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {POSITIONS.map(pos => {
                        const isSelected = selectedPositions.includes(pos);
                        const count = scoutedPlayers.filter(p => p.position === pos).length;
                        return (
                          <TouchableOpacity key={pos} style={styles.filterCheckboxItem} onPress={() => togglePosition(pos)}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>{pos}</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowPositionDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>

              <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
                <TouchableOpacity style={[styles.filterButton, selectedYears.length > 0 && styles.filterButtonActive]} 
                  onPress={(e) => { e.stopPropagation(); setShowYearDropdown(!showYearDropdown); setShowPositionDropdown(false); setShowRatingDropdown(false); }}>
                  <Text style={[styles.filterButtonText, selectedYears.length > 0 && styles.filterButtonTextActive]}>{getYearFilterLabel()} ▼</Text>
                </TouchableOpacity>
                {showYearDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Jahrgänge wählen</Text>
                      {selectedYears.length > 0 && <TouchableOpacity onPress={clearYears}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {availableYears.map(year => {
                        const isSelected = selectedYears.includes(year);
                        const count = scoutedPlayers.filter(p => getYearFromDate(p.birth_date) === year).length;
                        return (
                          <TouchableOpacity key={year} style={styles.filterCheckboxItem} onPress={() => toggleYear(year)}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>{year}</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowYearDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>

              <View style={[styles.dropdownContainer, { zIndex: 10 }]}>
                <TouchableOpacity style={[styles.filterButton, selectedRatings.length > 0 && styles.filterButtonActive]} 
                  onPress={(e) => { e.stopPropagation(); setShowRatingDropdown(!showRatingDropdown); setShowPositionDropdown(false); setShowYearDropdown(false); }}>
                  <Text style={[styles.filterButtonText, selectedRatings.length > 0 && styles.filterButtonTextActive]}>{getRatingFilterLabel()} ▼</Text>
                </TouchableOpacity>
                {showRatingDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Einschätzung wählen</Text>
                      {selectedRatings.length > 0 && <TouchableOpacity onPress={clearRatings}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {[1,2,3,4,5,6,7,8,9,10].map(rating => {
                        const isSelected = selectedRatings.includes(rating);
                        const count = activePlayers.filter(p => p.rating === rating).length;
                        return (
                          <TouchableOpacity key={rating} style={styles.filterCheckboxItem} onPress={() => toggleRating(rating)}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>⭐ {rating}/10</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowRatingDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {activeTab === 'spiele' && (
            <View style={styles.filterContainer}>
              <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
                <TouchableOpacity style={[styles.filterButton, selectedGamesYears.length > 0 && styles.filterButtonActive]} 
                  onPress={(e) => { e.stopPropagation(); setShowGamesYearDropdown(!showGamesYearDropdown); setShowGamesRatingDropdown(false); }}>
                  <Text style={[styles.filterButtonText, selectedGamesYears.length > 0 && styles.filterButtonTextActive]}>
                    {selectedGamesYears.length === 0 ? 'Jahrgang' : selectedGamesYears.length === 1 ? selectedGamesYears[0] : `${selectedGamesYears.length} Jahrgänge`} ▼
                  </Text>
                </TouchableOpacity>
                {showGamesYearDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Jahrgänge wählen</Text>
                      {selectedGamesYears.length > 0 && <TouchableOpacity onPress={() => setSelectedGamesYears([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {availableGamesYears.map(year => {
                        const isSelected = selectedGamesYears.includes(year);
                        const count = allGamePlayers.filter(p => p.birth_year === year).length;
                        return (
                          <TouchableOpacity key={year} style={styles.filterCheckboxItem} onPress={() => {
                            setSelectedGamesYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
                            setGamesViewMode('search');
                          }}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>{year}</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowGamesYearDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>

              <View style={[styles.dropdownContainer, { zIndex: 10 }]}>
                <TouchableOpacity style={[styles.filterButton, selectedGamesRatings.length > 0 && styles.filterButtonActive]} 
                  onPress={(e) => { e.stopPropagation(); setShowGamesRatingDropdown(!showGamesRatingDropdown); setShowGamesYearDropdown(false); }}>
                  <Text style={[styles.filterButtonText, selectedGamesRatings.length > 0 && styles.filterButtonTextActive]}>
                    {selectedGamesRatings.length === 0 ? 'Einschätzung' : selectedGamesRatings.length === 1 ? `⭐ ${selectedGamesRatings[0]}/10` : `${selectedGamesRatings.length} Einsch.`} ▼
                  </Text>
                </TouchableOpacity>
                {showGamesRatingDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Einschätzung wählen</Text>
                      {selectedGamesRatings.length > 0 && <TouchableOpacity onPress={() => setSelectedGamesRatings([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {[10,9,8,7,6,5,4,3,2,1].map(rating => {
                        const isSelected = selectedGamesRatings.includes(rating);
                        const count = allGamePlayers.filter(p => p.rating === rating).length;
                        return (
                          <TouchableOpacity key={rating} style={styles.filterCheckboxItem} onPress={() => {
                            setSelectedGamesRatings(prev => prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]);
                            setGamesViewMode('search');
                          }}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>⭐ {rating}/10</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowGamesRatingDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View style={styles.viewToggle}>
            {activeTab === 'spieler' ? (
              <>
                <TouchableOpacity style={[styles.viewButton, viewMode === 'kanban' && styles.viewButtonActive]} onPress={() => setViewMode('kanban')}>
                  <Text style={[styles.viewButtonText, viewMode === 'kanban' && styles.viewButtonTextActive]}>▦</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.viewButton, viewMode === 'liste' && styles.viewButtonActive]} onPress={() => setViewMode('liste')}>
                  <Text style={[styles.viewButtonText, viewMode === 'liste' && styles.viewButtonTextActive]}>☰</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.viewButton, viewMode === 'archiv' && styles.viewButtonActive]} onPress={() => setViewMode('archiv')}>
                  <Text style={[styles.viewButtonText, viewMode === 'archiv' && styles.viewButtonTextActive]}>Archiv ({archivedPlayersCount})</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.viewButton, gamesViewMode === 'upcoming' && styles.viewButtonActive]} onPress={() => { setGamesViewMode('upcoming'); setGamesSearchQuery(''); setSelectedGamesRatings([]); setSelectedGamesYears([]); }}>
                  <Text style={[styles.viewButtonText, gamesViewMode === 'upcoming' && styles.viewButtonTextActive]}>Anstehend ({upcomingGames.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.viewButton, gamesViewMode === 'archive' && styles.viewButtonActive]} onPress={() => { setGamesViewMode('archive'); setGamesSearchQuery(''); setSelectedGamesRatings([]); setSelectedGamesYears([]); }}>
                  <Text style={[styles.viewButtonText, gamesViewMode === 'archive' && styles.viewButtonTextActive]}>Archiv ({archivedGames.length})</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.filterButton} onPress={() => activeTab === 'spieler' ? setShowAddPlayerModal(true) : setShowAddGameModal(true)}>
            <Text style={styles.filterButtonText}>{activeTab === 'spieler' ? 'neuen Spieler anlegen' : 'neues Spiel anlegen'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'spieler' ? (
            viewMode === 'kanban' ? (
              <View style={styles.kanbanContainer}>
                {SCOUTING_STATUS.map(status => renderKanbanColumn(status))}
              </View>
            ) : viewMode === 'liste' ? (
              renderListView()
            ) : (
              renderArchivView()
            )
          ) : renderGamesTab()}
        </View>
      </View>

      {/* Add Player Modal */}
      <Modal visible={showAddPlayerModal} transparent animationType="fade">
        <View style={styles.modalOverlayTop}>
          <View style={[styles.modalContent, { overflow: 'visible' }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.modalTitle}>Neuen Spieler hinzufügen</Text>
              <TouchableOpacity onPress={closeAddPlayerModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {renderPlayerForm(newPlayer, setNewPlayer, newPlayerClubSearch, setNewPlayerClubSearch, showNewPlayerClubDropdown, setShowNewPlayerClubDropdown)}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeAddPlayerModal}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addScoutedPlayer}><Text style={styles.saveButtonText}>Hinzufügen</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Game Modal */}
      <Modal visible={showAddGameModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={closeAllGameDropdowns}>
          <Pressable style={[styles.modalContent, { overflow: 'visible', maxWidth: 500 }]} onPress={closeAllGameDropdowns}>
            <View style={styles.detailHeader}>
              <Text style={styles.modalTitle}>Neues Spiel anlegen</Text>
              <TouchableOpacity onPress={() => { setShowAddGameModal(false); closeAllGameDropdowns(); }} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Datum mit Dropdown */}
            <View style={[styles.formField, { zIndex: 400 }]}>
              <Text style={styles.formLabel}>Datum *</Text>
              <View style={styles.datePickerRow}>
                <View style={{ position: 'relative', flex: 1 }}>
                  <TouchableOpacity 
                    style={styles.dateDropdownButton}
                    onPress={(e) => { e.stopPropagation(); closeAllGameDropdowns(); setShowGameDatePicker(true); setGameDatePart('day'); }}
                  >
                    <Text style={styles.dateDropdownText}>
                      {parseDateToParts(newGame.date)?.day || 'Tag'}
                    </Text>
                    <Text>▼</Text>
                  </TouchableOpacity>
                  {showGameDatePicker && gameDatePart === 'day' && (
                    <View style={styles.datePickerList}>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {DAYS.map((d) => (
                          <TouchableOpacity 
                            key={d} 
                            style={styles.datePickerItem}
                            onPress={() => {
                              const parts = parseDateToParts(newGame.date) || { day: 1, month: new Date().getMonth(), year: new Date().getFullYear() };
                              setNewGame({ ...newGame, date: buildDateFromParts(d, parts.month, parts.year) });
                              setGameDatePart(null);
                              setShowGameDatePicker(false);
                            }}
                          >
                            <Text style={styles.datePickerItemText}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View style={{ position: 'relative', flex: 2 }}>
                  <TouchableOpacity 
                    style={styles.dateDropdownButton}
                    onPress={(e) => { e.stopPropagation(); closeAllGameDropdowns(); setShowGameDatePicker(true); setGameDatePart('month'); }}
                  >
                    <Text style={styles.dateDropdownText}>
                      {parseDateToParts(newGame.date) ? MONTHS[parseDateToParts(newGame.date)!.month] : 'Monat'}
                    </Text>
                    <Text>▼</Text>
                  </TouchableOpacity>
                  {showGameDatePicker && gameDatePart === 'month' && (
                    <View style={styles.datePickerList}>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {MONTHS.map((m, idx) => (
                          <TouchableOpacity 
                            key={m} 
                            style={styles.datePickerItem}
                            onPress={() => {
                              const parts = parseDateToParts(newGame.date) || { day: 1, month: 0, year: new Date().getFullYear() };
                              setNewGame({ ...newGame, date: buildDateFromParts(parts.day, idx, parts.year) });
                              setGameDatePart(null);
                              setShowGameDatePicker(false);
                            }}
                          >
                            <Text style={styles.datePickerItemText}>{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View style={{ position: 'relative', flex: 1 }}>
                  <TouchableOpacity 
                    style={styles.dateDropdownButton}
                    onPress={(e) => { e.stopPropagation(); closeAllGameDropdowns(); setShowGameDatePicker(true); setGameDatePart('year'); }}
                  >
                    <Text style={styles.dateDropdownText}>
                      {parseDateToParts(newGame.date)?.year || 'Jahr'}
                    </Text>
                    <Text>▼</Text>
                  </TouchableOpacity>
                  {showGameDatePicker && gameDatePart === 'year' && (
                    <View style={styles.datePickerList}>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {YEARS.map((y) => (
                          <TouchableOpacity 
                            key={y} 
                            style={styles.datePickerItem}
                            onPress={() => {
                              const parts = parseDateToParts(newGame.date) || { day: 1, month: new Date().getMonth(), year: new Date().getFullYear() };
                              setNewGame({ ...newGame, date: buildDateFromParts(parts.day, parts.month, y) });
                              setGameDatePart(null);
                              setShowGameDatePicker(false);
                            }}
                          >
                            <Text style={styles.datePickerItemText}>{y}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Art - Dropdown mit manueller Eingabe */}
            <View style={[styles.formField, { zIndex: 300 }]}>
              <Text style={styles.formLabel}>Art</Text>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  style={styles.dateDropdownButton}
                  onPress={(e) => { e.stopPropagation(); closeAllGameDropdowns(); setShowGameTypePicker(true); }}
                >
                  <Text style={styles.dateDropdownText}>
                    {newGame.game_type || 'Art auswählen...'}
                  </Text>
                  <Text>▼</Text>
                </TouchableOpacity>
                {showGameTypePicker && (
                  <Pressable style={styles.datePickerList} onPress={(e) => e.stopPropagation()}>
                    <TextInput
                      style={[styles.formInput, { margin: 8, marginBottom: 0 }]}
                      value={newGame.game_type}
                      onChangeText={(t) => setNewGame({ ...newGame, game_type: t })}
                      placeholder="Eigene Art eingeben..." placeholderTextColor="#999"
                      placeholderTextColor="#9ca3af"
                      onFocus={(e) => e.stopPropagation?.()}
                    />
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                      {GAME_TYPES.map((type) => (
                        <TouchableOpacity 
                          key={type} 
                          style={styles.datePickerItem}
                          onPress={() => {
                            setNewGame({ ...newGame, game_type: type });
                            setShowGameTypePicker(false);
                          }}
                        >
                          <Text style={styles.datePickerItemText}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Spiel/Beschreibung */}
            <View style={[styles.formField, { zIndex: 1 }]}>
              <Text style={styles.formLabel}>Spiel/Beschreibung *</Text>
              <TextInput 
                style={styles.formInput} 
                value={newGame.description} 
                onChangeText={(t) => setNewGame({...newGame, description: t})} 
                placeholder="z.B. Hallenmasters Wieseck" 
                placeholderTextColor="#9ca3af"
                onFocus={closeAllGameDropdowns}
              />
            </View>

            {/* Jahrgang - Dropdown */}
            <View style={[styles.formField, { zIndex: 200 }]}>
              <Text style={styles.formLabel}>Jahrgang</Text>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  style={styles.dateDropdownButton}
                  onPress={(e) => { e.stopPropagation(); closeAllGameDropdowns(); setShowAgeGroupPicker(true); }}
                >
                  <Text style={styles.dateDropdownText}>
                    {newGame.age_group || 'Jahrgang auswählen...'}
                  </Text>
                  <Text>▼</Text>
                </TouchableOpacity>
                {showAgeGroupPicker && (
                  <View style={styles.datePickerList}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {AGE_GROUPS.map((age) => (
                        <TouchableOpacity 
                          key={age} 
                          style={styles.datePickerItem}
                          onPress={() => {
                            setNewGame({ ...newGame, age_group: age });
                            setShowAgeGroupPicker(false);
                          }}
                        >
                          <Text style={styles.datePickerItemText}>{age}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Scout - Dropdown */}
            <View style={[styles.formField, { zIndex: 100 }]}>
              <Text style={styles.formLabel}>Scout</Text>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  style={styles.dateDropdownButton}
                  onPress={(e) => { e.stopPropagation(); closeAllGameDropdowns(); setShowScoutPicker(true); }}
                >
                  <Text style={styles.dateDropdownText}>
                    {newGame.scout_id ? advisors.find(a => a.id === newGame.scout_id)?.first_name + ' ' + advisors.find(a => a.id === newGame.scout_id)?.last_name : 'Scout auswählen...'}
                  </Text>
                  <Text>▼</Text>
                </TouchableOpacity>
                {showScoutPicker && (
                  <View style={styles.datePickerList}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {advisors.map((advisor) => (
                        <TouchableOpacity 
                          key={advisor.id} 
                          style={styles.datePickerItem}
                          onPress={() => {
                            setNewGame({ ...newGame, scout_id: advisor.id });
                            setShowScoutPicker(false);
                          }}
                        >
                          <Text style={styles.datePickerItemText}>{advisor.first_name} {advisor.last_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowAddGameModal(false); closeAllGameDropdowns(); }}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addScoutingGame}>
                <Text style={styles.saveButtonText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Game Detail Modal - Expanded */}
      {selectedGame && (
        <Modal visible={showGameDetailModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={closeAllEditDropdowns}>
            <Pressable style={[styles.modalContentLarge, { maxWidth: 1100, width: '95%', height: '85%', overflow: 'visible' }]} onPress={closeAllEditDropdowns}>
              {/* Header with Description */}
              <View style={[styles.gameDetailHeader, { zIndex: 100 }]}>
                <View style={styles.gameDetailHeaderLeft}>
                  {isEditingGame ? (
                    <TextInput 
                      style={styles.gameDetailTitleInput} 
                      value={editGameData.description || ''} 
                      onChangeText={(t) => setEditGameData({...editGameData, description: t})}
                      placeholder="Beschreibung" placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={styles.gameDetailTitle}>{selectedGame.description || 'Scouting-Termin'}</Text>
                  )}
                  <View style={[styles.gameDetailMeta, { zIndex: 50 }]}>
                    {isEditingGame ? (
                      <>
                        {/* Datum Dropdown */}
                        <View style={[styles.gameDetailMetaItem, { zIndex: 40 }]}>
                          <Text style={styles.gameDetailMetaLabel}>Datum:</Text>
                          <View style={styles.editDateRow}>
                            <View style={{ position: 'relative' }}>
                              <TouchableOpacity 
                                style={styles.editDateBtn}
                                onPress={(e) => { e.stopPropagation(); closeAllEditDropdowns(); setShowEditDatePicker(true); setEditDatePart('day'); }}
                              >
                                <Text style={styles.editDateBtnText}>{parseDateToParts(editGameData.date || '')?.day || 'Tag'}</Text>
                              </TouchableOpacity>
                              {showEditDatePicker && editDatePart === 'day' && (
                                <View style={styles.editDropdownList}>
                                  <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                    {DAYS.map((d) => (
                                      <TouchableOpacity key={d} style={styles.editDropdownItem} onPress={() => {
                                        const parts = parseDateToParts(editGameData.date || '') || { day: 1, month: new Date().getMonth(), year: new Date().getFullYear() };
                                        setEditGameData({ ...editGameData, date: buildDateFromParts(d, parts.month, parts.year) });
                                        setShowEditDatePicker(false); setEditDatePart(null);
                                      }}>
                                        <Text style={styles.editDropdownItemText}>{d}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}
                            </View>
                            <View style={{ position: 'relative' }}>
                              <TouchableOpacity 
                                style={styles.editDateBtn}
                                onPress={(e) => { e.stopPropagation(); closeAllEditDropdowns(); setShowEditDatePicker(true); setEditDatePart('month'); }}
                              >
                                <Text style={styles.editDateBtnText}>{parseDateToParts(editGameData.date || '') ? MONTHS[parseDateToParts(editGameData.date || '')!.month] : 'Monat'}</Text>
                              </TouchableOpacity>
                              {showEditDatePicker && editDatePart === 'month' && (
                                <View style={styles.editDropdownList}>
                                  <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                    {MONTHS.map((m, idx) => (
                                      <TouchableOpacity key={m} style={styles.editDropdownItem} onPress={() => {
                                        const parts = parseDateToParts(editGameData.date || '') || { day: 1, month: 0, year: new Date().getFullYear() };
                                        setEditGameData({ ...editGameData, date: buildDateFromParts(parts.day, idx, parts.year) });
                                        setShowEditDatePicker(false); setEditDatePart(null);
                                      }}>
                                        <Text style={styles.editDropdownItemText}>{m}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}
                            </View>
                            <View style={{ position: 'relative' }}>
                              <TouchableOpacity 
                                style={styles.editDateBtn}
                                onPress={(e) => { e.stopPropagation(); closeAllEditDropdowns(); setShowEditDatePicker(true); setEditDatePart('year'); }}
                              >
                                <Text style={styles.editDateBtnText}>{parseDateToParts(editGameData.date || '')?.year || 'Jahr'}</Text>
                              </TouchableOpacity>
                              {showEditDatePicker && editDatePart === 'year' && (
                                <View style={styles.editDropdownList}>
                                  <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                    {YEARS.map((y) => (
                                      <TouchableOpacity key={y} style={styles.editDropdownItem} onPress={() => {
                                        const parts = parseDateToParts(editGameData.date || '') || { day: 1, month: new Date().getMonth(), year: new Date().getFullYear() };
                                        setEditGameData({ ...editGameData, date: buildDateFromParts(parts.day, parts.month, y) });
                                        setShowEditDatePicker(false); setEditDatePart(null);
                                      }}>
                                        <Text style={styles.editDropdownItemText}>{y}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        {/* Art Dropdown */}
                        <View style={[styles.gameDetailMetaItem, { zIndex: 30 }]}>
                          <Text style={styles.gameDetailMetaLabel}>Art:</Text>
                          <View style={{ position: 'relative' }}>
                            <TouchableOpacity 
                              style={styles.editDateBtn}
                              onPress={(e) => { e.stopPropagation(); closeAllEditDropdowns(); setShowEditGameTypePicker(true); }}
                            >
                              <Text style={styles.editDateBtnText}>{editGameData.game_type || 'Auswählen'}</Text>
                            </TouchableOpacity>
                            {showEditGameTypePicker && (
                              <Pressable style={styles.editDropdownList} onPress={(e) => e.stopPropagation()}>
                                <TextInput
                                  style={[styles.formInput, { margin: 4, fontSize: 12 }]}
                                  value={editGameData.game_type || ''}
                                  onChangeText={(t) => setEditGameData({ ...editGameData, game_type: t })}
                                  placeholder="Eigene Art..." placeholderTextColor="#999"
                                  placeholderTextColor="#9ca3af"
                                />
                                <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                  {GAME_TYPES.map((type) => (
                                    <TouchableOpacity key={type} style={styles.editDropdownItem} onPress={() => {
                                      setEditGameData({ ...editGameData, game_type: type });
                                      setShowEditGameTypePicker(false);
                                    }}>
                                      <Text style={styles.editDropdownItemText}>{type}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </Pressable>
                            )}
                          </View>
                        </View>
                        {/* Jahrgang Dropdown */}
                        <View style={[styles.gameDetailMetaItem, { zIndex: 20 }]}>
                          <Text style={styles.gameDetailMetaLabel}>Jahrgang:</Text>
                          <View style={{ position: 'relative' }}>
                            <TouchableOpacity 
                              style={styles.editDateBtn}
                              onPress={(e) => { e.stopPropagation(); closeAllEditDropdowns(); setShowEditAgeGroupPicker(true); }}
                            >
                              <Text style={styles.editDateBtnText}>{editGameData.age_group || 'Auswählen'}</Text>
                            </TouchableOpacity>
                            {showEditAgeGroupPicker && (
                              <View style={styles.editDropdownList}>
                                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                  {AGE_GROUPS.map((age) => (
                                    <TouchableOpacity key={age} style={styles.editDropdownItem} onPress={() => {
                                      setEditGameData({ ...editGameData, age_group: age });
                                      setShowEditAgeGroupPicker(false);
                                    }}>
                                      <Text style={styles.editDropdownItemText}>{age}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.gameDetailMetaText}>{formatGameDate(selectedGame.date)}</Text>
                        {selectedGame.game_type && <Text style={styles.gameDetailMetaText}>• {selectedGame.game_type}</Text>}
                        {selectedGame.age_group && <Text style={styles.gameDetailMetaText}>• {selectedGame.age_group}</Text>}
                        {selectedGame.scout_name && <Text style={styles.gameDetailMetaText}>• {selectedGame.scout_name}</Text>}
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.gameDetailHeaderRight}>
                  {isEditingGame ? (
                    <>
                      <TouchableOpacity style={styles.headerBtn} onPress={() => { setIsEditingGame(false); closeAllEditDropdowns(); }}>
                        <Text style={styles.headerBtnText}>Abbrechen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.headerBtn, styles.headerBtnPrimary]} onPress={() => { saveGameEdit(); setIsEditingGame(false); closeAllEditDropdowns(); }}>
                        <Text style={styles.headerBtnTextPrimary}>Speichern</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.headerBtn} onPress={() => { setIsEditingGame(true); setEditGameData(selectedGame); }}>
                      <Text style={styles.headerBtnText}>Bearbeiten</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { setShowGameDetailModal(false); setIsEditingGame(false); setSelectedTeam(null); closeAllEditDropdowns(); }} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Two Column Layout */}
              <View style={styles.gameDetailBody}>
                {/* Left Column - Teams */}
                <View style={styles.teamsColumn}>
                  <Text style={styles.columnTitle}>Mannschaften</Text>
                  <View style={styles.addTeamContainer}>
                    <TextInput
                      style={styles.addTeamInputNew}
                      value={newTeamName}
                      onChangeText={setNewTeamName}
                      placeholder="Neue Mannschaft..." placeholderTextColor="#999"
                      placeholderTextColor="#9ca3af"
                      onSubmitEditing={addTeam}
                    />
                    <TouchableOpacity style={styles.addTeamBtnNew} onPress={addTeam}>
                      <Text style={styles.addTeamBtnTextNew}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.teamsList}>
                    {gameTeams.map(team => (
                      <TouchableOpacity 
                        key={team.id}
                        style={[styles.teamItem, selectedTeam?.id === team.id && styles.teamItemSelected]}
                        onPress={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
                      >
                        <Text style={[styles.teamItemText, selectedTeam?.id === team.id && styles.teamItemTextSelected]}>
                          {team.team_name}
                        </Text>
                        <Text style={[styles.teamPlayerCount, selectedTeam?.id === team.id && { color: '#9ca3af' }]}>
                          {gamePlayers.filter(p => p.team_id === team.id).length}
                        </Text>
                        <TouchableOpacity 
                          style={styles.teamDeleteBtn}
                          onPress={() => { if (confirm(`"${team.team_name}" löschen?`)) deleteTeam(team.id); }}
                        >
                          <Text style={[styles.teamDeleteBtnText, selectedTeam?.id === team.id && { color: '#9ca3af' }]}>✕</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Right Column - Players */}
                <View style={styles.playersColumn}>
                  {selectedTeam ? (
                    <>
                      <View style={styles.playersHeaderRow}>
                        <Text style={styles.columnTitle}>Spieler - {selectedTeam.team_name}</Text>
                      </View>
                      
                      {/* Add Player Row - Now at top */}
                      <View style={[styles.addPlayerRowTop, { zIndex: 50 }]}>
                        <TextInput
                          style={[styles.addPlayerInputNew, { width: 40 }]}
                          value={newGamePlayer.number}
                          onChangeText={(t) => setNewGamePlayer({...newGamePlayer, number: t})}
                          placeholder="Nr." placeholderTextColor="#999"
                          placeholderTextColor="#9ca3af"
                          onSubmitEditing={addGamePlayer}
                        />
                        {/* Position Dropdown */}
                        <View style={{ position: 'relative', zIndex: 40 }}>
                          <TouchableOpacity 
                            style={[styles.addPlayerDropdownBtn, { width: 50 }]}
                            onPress={(e) => { e.stopPropagation(); setShowNewPlayerPositionPicker(!showNewPlayerPositionPicker); setShowNewPlayerRatingPicker(false); }}
                          >
                            <Text style={styles.addPlayerDropdownBtnText}>{newGamePlayer.position || 'Pos.'}</Text>
                            <Text style={styles.addPlayerDropdownArrow}>▼</Text>
                          </TouchableOpacity>
                          {showNewPlayerPositionPicker && (
                            <View style={styles.addPlayerDropdownList}>
                              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                <TouchableOpacity style={styles.addPlayerDropdownItem} onPress={() => { setNewGamePlayer({...newGamePlayer, position: ''}); setShowNewPlayerPositionPicker(false); }}>
                                  <Text style={styles.addPlayerDropdownItemText}>-</Text>
                                </TouchableOpacity>
                                {POSITIONS.map((pos) => (
                                  <TouchableOpacity key={pos} style={styles.addPlayerDropdownItem} onPress={() => { setNewGamePlayer({...newGamePlayer, position: pos}); setShowNewPlayerPositionPicker(false); }}>
                                    <Text style={styles.addPlayerDropdownItemText}>{pos}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                        <TextInput
                          style={[styles.addPlayerInputNew, { width: 100 }]}
                          value={newGamePlayer.last_name}
                          onChangeText={(t) => setNewGamePlayer({...newGamePlayer, last_name: t})}
                          placeholder="Nachname" placeholderTextColor="#999"
                          placeholderTextColor="#9ca3af"
                          onSubmitEditing={addGamePlayer}
                        />
                        <TextInput
                          style={[styles.addPlayerInputNew, { width: 80 }]}
                          value={newGamePlayer.first_name}
                          onChangeText={(t) => setNewGamePlayer({...newGamePlayer, first_name: t})}
                          placeholder="Vorname" placeholderTextColor="#999"
                          placeholderTextColor="#9ca3af"
                          onSubmitEditing={addGamePlayer}
                        />
                        <TextInput
                          style={[styles.addPlayerInputNew, { width: 75 }]}
                          value={newGamePlayer.birth_year}
                          onChangeText={(t) => setNewGamePlayer({...newGamePlayer, birth_year: t})}
                          placeholder="Jahrgang" placeholderTextColor="#999"
                          placeholderTextColor="#9ca3af"
                          onSubmitEditing={addGamePlayer}
                        />
                        {/* Einschätzung Dropdown */}
                        <View style={{ position: 'relative', zIndex: 30 }}>
                          <TouchableOpacity 
                            style={[styles.addPlayerDropdownBtn, { width: 70 }, newGamePlayer.rating !== null && styles.addPlayerDropdownBtnRating]}
                            onPress={(e) => { e.stopPropagation(); setShowNewPlayerRatingPicker(!showNewPlayerRatingPicker); setShowNewPlayerPositionPicker(false); }}
                          >
                            <Text style={[styles.addPlayerDropdownBtnText, newGamePlayer.rating !== null && styles.addPlayerDropdownBtnTextRating]}>
                              {newGamePlayer.rating !== null ? `⭐ ${newGamePlayer.rating}` : 'Einsch.'}
                            </Text>
                            <Text style={[styles.addPlayerDropdownArrow, newGamePlayer.rating !== null && styles.addPlayerDropdownArrowRating]}>▼</Text>
                          </TouchableOpacity>
                          {showNewPlayerRatingPicker && (
                            <View style={styles.addPlayerDropdownList}>
                              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                <TouchableOpacity style={styles.addPlayerDropdownItem} onPress={() => { setNewGamePlayer({...newGamePlayer, rating: null}); setShowNewPlayerRatingPicker(false); }}>
                                  <Text style={styles.addPlayerDropdownItemText}>-</Text>
                                </TouchableOpacity>
                                {[1,2,3,4,5,6,7,8,9,10].map((r) => (
                                  <TouchableOpacity key={r} style={[styles.addPlayerDropdownItem, newGamePlayer.rating === r && styles.addPlayerDropdownItemActive]} onPress={() => { setNewGamePlayer({...newGamePlayer, rating: r}); setShowNewPlayerRatingPicker(false); }}>
                                    <Text style={[styles.addPlayerDropdownItemText, newGamePlayer.rating === r && styles.addPlayerDropdownItemTextActive]}>⭐ {r}/10</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity style={styles.addPlayerBtnNew} onPress={addGamePlayer}>
                          <Text style={styles.addPlayerBtnTextNew}>+</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Players Table Header */}
                      <View style={styles.playersTableHeaderNew}>
                        <Text style={[styles.playersHeaderCellNew, { width: 35 }]}>Nr.</Text>
                        <Text style={[styles.playersHeaderCellNew, { width: 40 }]}>Pos.</Text>
                        <Text style={[styles.playersHeaderCellNew, { width: 85 }]}>Nachname</Text>
                        <Text style={[styles.playersHeaderCellNew, { width: 70 }]}>Vorname</Text>
                        <Text style={[styles.playersHeaderCellNew, { width: 60 }]}>Jahrgang</Text>
                        <Text style={[styles.playersHeaderCellNew, { width: 90 }]}>Einschätzung</Text>
                        <Text style={[styles.playersHeaderCellNew, { width: 38 }]}>Notiz</Text>
                        <Text style={[styles.playersHeaderCellNew, { flex: 1 }]}></Text>
                      </View>

                      {/* Players List */}
                      <ScrollView style={styles.playersListScroll}>
                        {gamePlayers.filter(p => p.team_id === selectedTeam.id).map(player => (
                          <TouchableOpacity key={player.id} style={styles.playersTableRowNew} onPress={() => openPlayerNotes(player)}>
                            <Text style={[styles.playersCellNew, { width: 35 }]}>{player.number || '-'}</Text>
                            <View style={[styles.playersCellNew, { width: 40 }]}>
                              {player.position ? (
                                <View style={styles.positionBadgeSmall}><Text style={styles.positionTextSmall}>{player.position}</Text></View>
                              ) : (
                                <Text>-</Text>
                              )}
                            </View>
                            <Text style={[styles.playersCellNew, { width: 85 }]}>{player.last_name || '-'}</Text>
                            <Text style={[styles.playersCellNew, { width: 70 }]}>{player.first_name || '-'}</Text>
                            <Text style={[styles.playersCellNew, { width: 60 }]}>{player.birth_year || '-'}</Text>
                            <View style={[styles.playersCellNew, { width: 90 }]}>
                              {player.rating ? (
                                <View style={styles.ratingBadgeTight}><Text style={styles.ratingTextTight}>⭐ {player.rating}/10</Text></View>
                              ) : (
                                <Text>-</Text>
                              )}
                            </View>
                            <View style={[styles.playersCellNew, { width: 38, alignItems: 'center' }]}>
                              <Text style={styles.notesBtnNew}>{player.notes ? '📝' : '-'}</Text>
                            </View>
                            <View style={{ flex: 1 }} />
                            {player.added_to_database ? (
                              <View style={styles.addedToDatabaseBtn}>
                                <Text style={styles.addedToDatabaseBtnText}>wurde zur Spieler-Datenbank hinzugefügt</Text>
                              </View>
                            ) : (
                              <TouchableOpacity 
                                style={styles.addToDatabaseBtn}
                                onPress={(e) => { e.stopPropagation(); addGamePlayerToDatabase(player); }}
                              >
                                <Text style={styles.addToDatabaseBtnText}>zur Spieler-Datenbank hinzufügen</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                              style={styles.deletePlayerBtn}
                              onPress={(e) => { e.stopPropagation(); deleteGamePlayer(player.id); }}
                            >
                              <Text style={styles.deleteBtnSmall}>🗑️</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  ) : (
                    <View style={styles.noTeamSelected}>
                      <Text style={styles.noTeamSelectedText}>← Mannschaft auswählen</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Bottom Buttons */}
              <View style={styles.gameDetailFooter}>
                <TouchableOpacity style={styles.deleteButton} onPress={() => { 
                  if (confirm('Spiel wirklich löschen? Alle Mannschaften und Spieler werden ebenfalls gelöscht.')) {
                    deleteScoutingGame(selectedGame.id); 
                    setShowGameDetailModal(false); 
                  }
                }}>
                  <Text style={styles.deleteButtonText}>Spiel löschen</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Player Edit Modal - Higher z-index */}
      {showPlayerNotesModal && (
        <Modal visible={showPlayerNotesModal} transparent animationType="fade">
          <Pressable style={[styles.modalOverlay, { zIndex: 9999 }]} onPress={() => { setShowEditPlayerPositionPicker(false); setShowEditPlayerRatingPicker(false); }}>
            <Pressable style={[styles.modalContent, { maxWidth: 500, zIndex: 10000, overflow: 'visible' }]} onPress={() => { setShowEditPlayerPositionPicker(false); setShowEditPlayerRatingPicker(false); }}>
              <View style={styles.detailHeader}>
                <Text style={styles.modalTitle}>Spieler bearbeiten</Text>
                <TouchableOpacity onPress={() => { setShowPlayerNotesModal(false); setShowEditPlayerPositionPicker(false); setShowEditPlayerRatingPicker(false); }} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              {selectedGamePlayer && (
                <>
                  <View style={[styles.playerEditRow, { zIndex: 30 }]}>
                    <View style={[styles.playerEditField, { width: 50 }]}>
                      <Text style={styles.playerEditLabel}>Nr.</Text>
                      <TextInput
                        style={styles.playerEditInput}
                        value={selectedGamePlayer.number || ''}
                        onChangeText={(t) => updateSelectedGamePlayer('number', t)}
                        placeholder="-" placeholderTextColor="#999"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    {/* Position Dropdown */}
                    <View style={[styles.playerEditField, { width: 80, zIndex: 40 }]}>
                      <Text style={styles.playerEditLabel}>Position</Text>
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity 
                          style={styles.playerEditDropdownBtn}
                          onPress={(e) => { e.stopPropagation(); setShowEditPlayerPositionPicker(!showEditPlayerPositionPicker); setShowEditPlayerRatingPicker(false); }}
                        >
                          <Text style={styles.playerEditDropdownBtnText}>{selectedGamePlayer.position || '-'}</Text>
                          <Text style={styles.playerEditDropdownArrow}>▼</Text>
                        </TouchableOpacity>
                        {showEditPlayerPositionPicker && (
                          <View style={styles.playerEditDropdownList}>
                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                              <TouchableOpacity style={styles.playerEditDropdownItem} onPress={() => { updateSelectedGamePlayer('position', ''); setShowEditPlayerPositionPicker(false); }}>
                                <Text style={styles.playerEditDropdownItemText}>-</Text>
                              </TouchableOpacity>
                              {POSITIONS.map((pos) => (
                                <TouchableOpacity key={pos} style={[styles.playerEditDropdownItem, selectedGamePlayer.position === pos && styles.playerEditDropdownItemActive]} onPress={() => { updateSelectedGamePlayer('position', pos); setShowEditPlayerPositionPicker(false); }}>
                                  <Text style={[styles.playerEditDropdownItemText, selectedGamePlayer.position === pos && styles.playerEditDropdownItemTextActive]}>{pos}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[styles.playerEditField, { flex: 1 }]}>
                      <Text style={styles.playerEditLabel}>Nachname</Text>
                      <TextInput
                        style={styles.playerEditInput}
                        value={selectedGamePlayer.last_name || ''}
                        onChangeText={(t) => updateSelectedGamePlayer('last_name', t)}
                        placeholder="Nachname" placeholderTextColor="#999"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <View style={[styles.playerEditField, { flex: 1 }]}>
                      <Text style={styles.playerEditLabel}>Vorname</Text>
                      <TextInput
                        style={styles.playerEditInput}
                        value={selectedGamePlayer.first_name || ''}
                        onChangeText={(t) => updateSelectedGamePlayer('first_name', t)}
                        placeholder="Vorname" placeholderTextColor="#999"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                  <View style={[styles.playerEditRow, { zIndex: 20 }]}>
                    <View style={[styles.playerEditField, { width: 80 }]}>
                      <Text style={styles.playerEditLabel}>Jahrgang</Text>
                      <TextInput
                        style={styles.playerEditInput}
                        value={selectedGamePlayer.birth_year || ''}
                        onChangeText={(t) => updateSelectedGamePlayer('birth_year', t)}
                        placeholder="2008" placeholderTextColor="#999"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    {/* Einschätzung Dropdown */}
                    <View style={[styles.playerEditField, { width: 100, zIndex: 30 }]}>
                      <Text style={styles.playerEditLabel}>Einschätzung</Text>
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity 
                          style={[styles.playerEditDropdownBtn, selectedGamePlayer.rating !== null && styles.playerEditDropdownBtnRating]}
                          onPress={(e) => { e.stopPropagation(); setShowEditPlayerRatingPicker(!showEditPlayerRatingPicker); setShowEditPlayerPositionPicker(false); }}
                        >
                          <Text style={[styles.playerEditDropdownBtnText, selectedGamePlayer.rating !== null && styles.playerEditDropdownBtnTextRating]}>
                            {selectedGamePlayer.rating !== null ? `${selectedGamePlayer.rating}/10` : '-'}
                          </Text>
                          <Text style={[styles.playerEditDropdownArrow, selectedGamePlayer.rating !== null && styles.playerEditDropdownArrowRating]}>▼</Text>
                        </TouchableOpacity>
                        {showEditPlayerRatingPicker && (
                          <View style={styles.playerEditDropdownList}>
                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                              <TouchableOpacity style={styles.playerEditDropdownItem} onPress={() => { updateSelectedGamePlayerRating(null); setShowEditPlayerRatingPicker(false); }}>
                                <Text style={styles.playerEditDropdownItemText}>-</Text>
                              </TouchableOpacity>
                              {[1,2,3,4,5,6,7,8,9,10].map((r) => (
                                <TouchableOpacity key={r} style={[styles.playerEditDropdownItem, selectedGamePlayer.rating === r && styles.playerEditDropdownItemActive]} onPress={() => { updateSelectedGamePlayerRating(r); setShowEditPlayerRatingPicker(false); }}>
                                  <Text style={[styles.playerEditDropdownItemText, selectedGamePlayer.rating === r && styles.playerEditDropdownItemTextActive]}>⭐ {r}/10</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={[styles.playerEditField, { zIndex: 1 }]}>
                    <Text style={styles.playerEditLabel}>Notizen</Text>
                    <TextInput
                      style={[styles.playerEditInput, styles.textArea, { minHeight: 100 }]}
                      value={editingPlayerNotes}
                      onChangeText={setEditingPlayerNotes}
                      placeholder="Notizen zum Spieler..." placeholderTextColor="#999"
                      placeholderTextColor="#9ca3af"
                      multiline
                    />
                  </View>
                </>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPlayerNotesModal(false)}>
                  <Text style={styles.cancelButtonText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={savePlayerNotes}>
                  <Text style={styles.saveButtonText}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Player Detail Modal - New Layout */}
      {selectedPlayer && (
        <Modal visible={showPlayerDetailModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContentLarge, { overflow: 'visible' }]}>
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderLeft}>
                  <Text style={styles.detailName}>{selectedPlayer.first_name} {selectedPlayer.last_name}</Text>
                  <View style={styles.detailClubRow}>
                    <Text style={styles.detailClub}>{selectedPlayer.club || '-'}</Text>
                    {getClubLogo(selectedPlayer.club) && (
                      <Image source={{ uri: getClubLogo(selectedPlayer.club)! }} style={styles.detailClubLogo} />
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setShowPlayerDetailModal(false); setIsEditing(false); setShowEditClubDropdown(false); }} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {isEditing ? (
                renderPlayerForm(editData, setEditData, editClubSearchText, setEditClubSearchText, showEditClubDropdown, setShowEditClubDropdown)
              ) : (
                <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                  {/* Two Column Layout */}
                  <View style={styles.detailTwoColumn}>
                    {/* Left Column: Grunddaten */}
                    <View style={styles.detailColumnLeft}>
                      <View style={styles.detailInfo}>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Geburtsdatum</Text>
                          <Text style={styles.detailValueLarge}>{formatBirthDisplay(selectedPlayer.birth_date)}</Text>
                        </View>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Position</Text>
                          <View style={styles.positionBadgesRowDetail}>
                            {parsePositions(selectedPlayer.position).map((pos, idx) => (
                              <View key={idx} style={styles.positionBadge}><Text style={styles.positionText}>{pos}</Text></View>
                            ))}
                          </View>
                        </View>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Einschätzung</Text>
                          {selectedPlayer.rating ? (
                            <View style={styles.ratingBadgeLarge}><Text style={styles.ratingTextLarge}>⭐ {selectedPlayer.rating}/10</Text></View>
                          ) : (
                            <Text style={styles.detailValueLarge}>-</Text>
                          )}
                        </View>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Kontakt</Text>
                          <Text style={styles.detailValueLarge}>{selectedPlayer.phone || '-'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Column: Transfermarkt + Scout */}
                    <View style={styles.detailColumnRight}>
                      <View style={styles.detailInfo}>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Transfermarkt</Text>
                          {selectedPlayer.transfermarkt_url ? (
                            <TouchableOpacity onPress={() => openTransfermarkt(selectedPlayer.transfermarkt_url!)} style={styles.tmLinkRowDetail}>
                              <Image source={TransfermarktLogo} style={styles.tmLogoDetail} />
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.detailValueLarge}>-</Text>
                          )}
                        </View>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Scout</Text>
                          <Text style={styles.detailValueLarge}>{selectedPlayer.scout_name || '-'}</Text>
                        </View>
                      </View>
                      {/* Weitere Infos */}
                      <View style={styles.detailInfoScout}>
                        <View style={styles.detailRowVertical}>
                          <Text style={styles.detailLabelSmall}>Weitere Infos</Text>
                          <Text style={styles.detailValueLarge}>{selectedPlayer.additional_info || '-'}</Text>
                        </View>
                        <View style={[styles.detailRowVertical, { marginBottom: 0 }]}>
                          <Text style={styles.detailLabelSmall}>IST-Stand</Text>
                          <Text style={styles.detailValueLarge}>{selectedPlayer.current_status || '-'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Fußballerische Einschätzung in eigener Säule */}
                  <View style={[styles.detailInfo, { marginTop: 16 }]}>
                    <View style={[styles.detailRowVertical, { marginBottom: 0 }]}>
                      <Text style={styles.detailLabelSmall}>Fußballerische Einschätzung</Text>
                      <Text style={styles.detailValueLarge}>{selectedPlayer.notes || '-'}</Text>
                    </View>
                  </View>
                </ScrollView>
              )}

              <View style={styles.modalButtons}>
                {isEditing ? (
                  <>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => deleteScoutedPlayer(selectedPlayer.id)}><Text style={styles.deleteButtonText}>Löschen</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => { setIsEditing(false); setShowEditClubDropdown(false); }}><Text style={styles.cancelButtonText}>Abbrechen</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.saveButton} onPress={updateScoutedPlayer}><Text style={styles.saveButtonText}>Speichern</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.decisionButton} onPress={() => { setShowPlayerDetailModal(false); setShowDecisionModal(true); }}><Text style={styles.decisionButtonText}>Entscheidung</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}><Text style={styles.editButtonText}>Bearbeiten</Text></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Entscheidungs-Modal */}
      <Modal visible={showDecisionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.decisionModalContent}>
            <Text style={styles.decisionModalTitle}>Entscheidung treffen</Text>
            <Text style={styles.decisionModalSubtitle}>{selectedPlayer?.first_name} {selectedPlayer?.last_name}</Text>
            
            <View style={styles.decisionButtonsContainer}>
              <TouchableOpacity style={styles.transferButton} onPress={() => { setShowDecisionModal(false); setShowTransferModal(true); }}>
                <Text style={styles.transferButtonIcon}>✓</Text>
                <Text style={styles.transferButtonText}>Übernehmen</Text>
                <Text style={styles.transferButtonSubtext}>In Spielerübersicht</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.archiveButton} onPress={() => { setShowDecisionModal(false); setShowArchiveModal(true); }}>
                <Text style={styles.archiveButtonIcon}>✗</Text>
                <Text style={styles.archiveButtonText}>Archivieren</Text>
                <Text style={styles.archiveButtonSubtext}>Ins Archiv verschieben</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.decisionCancelButton} onPress={() => setShowDecisionModal(false)}>
              <Text style={styles.decisionCancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Archiv-Modal */}
      <Modal visible={showArchiveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Spieler archivieren</Text>
            <Text style={styles.modalSubtitle}>{selectedPlayer?.first_name} {selectedPlayer?.last_name}</Text>
            
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Grund für Archivierung</Text>
              <TextInput 
                style={[styles.formInput, styles.textArea]} 
                value={archiveReason} 
                onChangeText={setArchiveReason} 
                placeholder="z.B. Kein Interesse, Spieler hat abgesagt, andere Agentur gewählt..." placeholderTextColor="#999"
                placeholderTextColor="#9ca3af"
                multiline
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowArchiveModal(false); setArchiveReason(''); }}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.archiveConfirmButton} onPress={archivePlayer}>
                <Text style={styles.archiveConfirmButtonText}>Archivieren</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transfer/Übernahme-Modal */}
      <Modal visible={showTransferModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Spieler übernehmen</Text>
            <Text style={styles.modalSubtitle}>{selectedPlayer?.first_name} {selectedPlayer?.last_name} in die Spielerübersicht übernehmen</Text>
            
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Listung *</Text>
              <View style={styles.listingSelector}>
                {LISTINGS.map(listing => (
                  <TouchableOpacity 
                    key={listing} 
                    style={[styles.listingOption, transferListing === listing && styles.listingOptionSelected]}
                    onPress={() => setTransferListing(listing)}
                  >
                    <Text style={[styles.listingOptionText, transferListing === listing && styles.listingOptionTextSelected]}>{listing}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Zuständiger Berater *</Text>
              <View style={styles.advisorSelector}>
                {advisors.map(advisor => (
                  <TouchableOpacity 
                    key={advisor.id} 
                    style={[styles.advisorOption, transferResponsibility === `${advisor.first_name} ${advisor.last_name}` && styles.advisorOptionSelected]}
                    onPress={() => setTransferResponsibility(`${advisor.first_name} ${advisor.last_name}`)}
                  >
                    <Text style={[styles.advisorOptionText, transferResponsibility === `${advisor.first_name} ${advisor.last_name}` && styles.advisorOptionTextSelected]}>
                      {advisor.first_name} {advisor.last_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowTransferModal(false); setTransferListing(''); setTransferResponsibility(''); }}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.transferConfirmButton} onPress={transferToPlayers}>
                <Text style={styles.transferConfirmButtonText}>Übernehmen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  containerMobile: { flexDirection: 'column' },
  mainContent: { flex: 1 },
  
  // Header Banner - weiß mit Titel mittig
  headerBanner: { flexDirection: 'row', alignItems: 'center', padding: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerBannerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  headerTabs: { flexDirection: 'row', gap: 8 },
  headerTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  headerTabActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  headerTabIcon: { fontSize: 16, marginRight: 8 },
  headerTabText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  headerTabTextActive: { color: '#fff' },
  
  // Toolbar - weiß umrandet
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 100 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  filterContainer: { flexDirection: 'row', gap: 8 },
  dropdownContainer: { position: 'relative' },
  filterButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  filterButtonActive: { backgroundColor: '#e0f2fe', borderColor: '#3b82f6' },
  filterButtonText: { fontSize: 14, color: '#64748b' },
  filterButtonTextActive: { color: '#0369a1' },
  filterDropdownMulti: { position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, zIndex: 1000, overflow: 'hidden' },
  filterDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  filterDropdownTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  filterClearText: { fontSize: 12, color: '#ef4444' },
  filterCheckboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  filterCheckboxText: { flex: 1, fontSize: 14, color: '#333' },
  filterCountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, color: '#64748b' },
  filterDoneButton: { padding: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  filterDoneText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  noDataText: { padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  viewToggle: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, padding: 4 },
  viewButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  viewButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  viewButtonText: { fontSize: 14, color: '#64748b' },
  addButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#1a1a1a' },
  addButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  kanbanContainer: { flex: 1, flexDirection: 'row', gap: 12 },
  kanbanColumn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12, minHeight: 400, minWidth: 200 },
  kanbanColumnDropTarget: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#3b82f6', borderStyle: 'dashed' },
  kanbanHeader: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  kanbanHeaderTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  kanbanTitle: { fontSize: 14, fontWeight: '600', color: '#475569', flex: 1 },
  kanbanDescription: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', lineHeight: 14 },
  countBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  kanbanContent: { flex: 1 },
  playerCard: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardContent: { padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  clubLogoCard: { width: 32, height: 32, resizeMode: 'contain', marginRight: 10 },
  cardInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  playerYear: { fontSize: 14, color: '#64748b', marginTop: 2 },
  playerClub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  positionBadgesRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' },
  ratingBadgeCard: { backgroundColor: '#dcfce7', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  ratingTextCard: { fontSize: 10, fontWeight: '600', color: '#166534' },
  birthYear: { fontSize: 11, color: '#64748b' },
  clubLogoSmall: { width: 28, height: 28, resizeMode: 'contain', marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  positionBadge: { backgroundColor: '#e0f2fe', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  positionText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  ratingBadge: { backgroundColor: '#dcfce7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  ratingText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  ratingBadgeSmall: { backgroundColor: '#dcfce7', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  ratingTextSmall: { fontSize: 11, fontWeight: '600', color: '#166534' },
  ratingBadgeList: { backgroundColor: '#dcfce7', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  ratingTextList: { fontSize: 12, fontWeight: '500', color: '#166534' },
  tmIconSmall: { padding: 2 },
  tmLogoSmall: { width: 24, height: 16, resizeMode: 'contain' },
  tmLogoMedium: { width: 32, height: 20, resizeMode: 'contain' },
  tmLogoLarge: { width: 40, height: 26, resizeMode: 'contain' },
  tmLogoInline: { width: 28, height: 18, resizeMode: 'contain' },
  tmButton: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, marginLeft: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  tmButtonLarge: { backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  tmLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tmLinkText: { fontSize: 14, color: '#0369a1', fontWeight: '500' },
  tmInputRow: { flexDirection: 'row', alignItems: 'center' },
  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableCell: { fontSize: 14, color: '#1a1a1a' },
  tableCellText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  ratingTextList: { color: '#166534', fontWeight: '600' },
  clubLogoTable: { width: 24, height: 24, resizeMode: 'contain' },
  positionBadgeSmall: { backgroundColor: '#e0f2fe', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  positionTextSmall: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  gamesContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  gamesSearchRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  gamesSearchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, fontSize: 14 },
  gamesSearchClear: { marginLeft: 8, padding: 8 },
  gamesSearchClearText: { fontSize: 16, color: '#9ca3af' },
  gamesViewToggle: { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  gamesViewBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
  gamesViewBtnActive: { backgroundColor: '#1a1a1a' },
  gamesViewBtnText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  gamesViewBtnTextActive: { color: '#fff' },
  searchResultsHeader: { padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  searchResultsTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  clubSelectorContainer: { position: 'relative', zIndex: 9999 },
  clubDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, zIndex: 9999, elevation: 9999 },
  clubDropdownScroll: { maxHeight: 200 },
  clubDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  clubDropdownLogo: { width: 24, height: 24, resizeMode: 'contain', marginRight: 10 },
  clubDropdownText: { fontSize: 14, color: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalOverlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90%', zIndex: 1 },
  modalContentLarge: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 800, maxHeight: '90%', zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  detailHeaderLeft: { flex: 1 },
  detailClubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  detailClubLogo: { width: 24, height: 24, resizeMode: 'contain' },
  detailTwoColumn: { flexDirection: 'row', gap: 20 },
  detailColumnLeft: { flex: 1 },
  detailColumnRight: { flex: 1 },
  detailRowVertical: { marginBottom: 16 },
  detailLabelSmall: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  detailValueLarge: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  positionBadgesRowDetail: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingBadgeLarge: { backgroundColor: '#dcfce7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  ratingTextLarge: { fontSize: 14, fontWeight: '600', color: '#166534' },
  tmLinkRowDetail: { flexDirection: 'row', alignItems: 'center' },
  tmLogoDetail: { width: 80, height: 24, resizeMode: 'contain' },
  detailInfoScout: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginTop: 12 },
  formRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formField: { flex: 1, marginBottom: 8 },
  formLabel: { fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  inputDisabled: { backgroundColor: '#f8fafc', color: '#64748b' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  positionPickerSmall: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  positionOptionSmall: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: '#f1f5f9' },
  positionOptionSelected: { backgroundColor: '#1a1a1a' },
  positionOptionTextSmall: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  positionOptionTextSelected: { color: '#fff' },
  ratingPickerSmall: { flexDirection: 'row', gap: 4, flex: 1 },
  ratingOptionSmall: { width: 26, height: 26, borderRadius: 4, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  ratingOptionSelected: { backgroundColor: '#1a1a1a' },
  ratingOptionTextSmall: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  ratingOptionTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelButtonText: { fontSize: 14, color: '#64748b' },
  saveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#10b981' },
  saveButtonText: { fontSize: 14, color: '#10b981', fontWeight: '500' },
  editButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#3b82f6' },
  editButtonText: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  deleteButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#ef4444', marginRight: 'auto' },
  deleteButtonText: { fontSize: 14, color: '#ef4444', fontWeight: '500' },
  decisionButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f59e0b', marginRight: 'auto' },
  decisionButtonText: { fontSize: 14, color: '#f59e0b', fontWeight: '500' },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { fontSize: 16, color: '#64748b' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, zIndex: 1000 },
  detailName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  detailClub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  detailInfo: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailLabel: { fontSize: 13, color: '#64748b', width: 100 },
  detailValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '500', flex: 1 },
  detailSection: { marginBottom: 16 },
  detailSectionTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 },
  notesText: { fontSize: 14, color: '#475569', lineHeight: 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
  editInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 8, fontSize: 14, backgroundColor: '#fff' },
  // IST-Stand auf Kanban-Karte
  currentStatusRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  currentStatusText: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  // Archiv
  emptyArchiv: { padding: 40, alignItems: 'center' },
  emptyArchivText: { fontSize: 14, color: '#94a3b8' },
  restoreButton: { backgroundColor: '#10b981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  restoreButtonText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  // Entscheidungs-Modal
  decisionModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 32, width: '90%', maxWidth: 450, alignItems: 'center' },
  decisionModalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  decisionModalSubtitle: { fontSize: 16, color: '#64748b', marginBottom: 24 },
  decisionButtonsContainer: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  transferButton: { backgroundColor: '#dcfce7', padding: 24, borderRadius: 12, alignItems: 'center', flex: 1, borderWidth: 2, borderColor: '#10b981' },
  transferButtonIcon: { fontSize: 32, color: '#10b981', marginBottom: 8 },
  transferButtonText: { fontSize: 16, fontWeight: '600', color: '#166534' },
  transferButtonSubtext: { fontSize: 12, color: '#166534', marginTop: 4 },
  archiveButton: { backgroundColor: '#fef2f2', padding: 24, borderRadius: 12, alignItems: 'center', flex: 1, borderWidth: 2, borderColor: '#ef4444' },
  archiveButtonIcon: { fontSize: 32, color: '#ef4444', marginBottom: 8 },
  archiveButtonText: { fontSize: 16, fontWeight: '600', color: '#991b1b' },
  archiveButtonSubtext: { fontSize: 12, color: '#991b1b', marginTop: 4 },
  decisionCancelButton: { paddingVertical: 12, paddingHorizontal: 24 },
  decisionCancelButtonText: { fontSize: 14, color: '#64748b' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  archiveConfirmButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#ef4444' },
  archiveConfirmButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  transferConfirmButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#10b981' },
  transferConfirmButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  listingSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  listingOption: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  listingOptionSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  listingOptionText: { fontSize: 13, color: '#64748b' },
  listingOptionTextSelected: { color: '#fff' },
  advisorSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  advisorOption: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  advisorOptionSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  advisorOptionText: { fontSize: 13, color: '#64748b' },
  advisorOptionTextSelected: { color: '#fff' },
  viewButtonTextActive: { color: '#1a1a1a', fontWeight: '600' },
  // Date Picker Styles
  datePickerRow: { flexDirection: 'row', gap: 8 },
  dateDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  dateDropdownText: { fontSize: 14, color: '#1a1a1a' },
  datePickerList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginTop: 4, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5 },
  datePickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  datePickerItemText: { fontSize: 14, color: '#1a1a1a' },
  // Chip Styles
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextSelected: { color: '#fff' },
  // Game Detail Modal Styles
  gameDetailDate: { fontSize: 14, color: '#64748b', marginTop: 4 },
  gameDetailContent: { paddingVertical: 16 },
  gameDetailRow: { flexDirection: 'row', marginBottom: 12 },
  gameDetailLabel: { fontSize: 14, color: '#64748b', width: 100 },
  gameDetailValue: { fontSize: 14, color: '#1a1a1a', flex: 1 },
  deleteButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#ef4444' },
  deleteButtonText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  editButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  editButtonText: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  // Today's game highlighting
  tableRowToday: { backgroundColor: '#dcfce7' },
  tableCellToday: { color: '#166534' },
  // Game Detail Modal - Two Column Layout
  gameDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 16 },
  gameDetailHeaderLeft: { flex: 1 },
  gameDetailHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gameDetailTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  gameDetailTitleInput: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#3b82f6', paddingBottom: 4 },
  gameDetailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  gameDetailMetaText: { fontSize: 14, color: '#64748b' },
  gameDetailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gameDetailMetaLabel: { fontSize: 12, color: '#64748b' },
  gameDetailMetaInput: { fontSize: 14, color: '#1a1a1a', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 4, minWidth: 80 },
  headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#f1f5f9' },
  headerBtnPrimary: { backgroundColor: '#3b82f6' },
  headerBtnText: { fontSize: 13, color: '#64748b' },
  headerBtnTextPrimary: { fontSize: 13, color: '#fff' },
  // Edit Dropdowns
  editDateRow: { flexDirection: 'row', gap: 4 },
  editDateBtn: { backgroundColor: '#f1f5f9', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, minWidth: 50 },
  editDateBtnText: { fontSize: 12, color: '#1a1a1a' },
  editDropdownList: { position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, marginTop: 2, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5, minWidth: 100 },
  editDropdownItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  editDropdownItemText: { fontSize: 12, color: '#1a1a1a' },
  // Two Column Body
  gameDetailBody: { flex: 1, flexDirection: 'row', gap: 20 },
  teamsColumn: { width: 220, borderRightWidth: 1, borderRightColor: '#e2e8f0', paddingRight: 16 },
  playersColumn: { flex: 1 },
  columnTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  playersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Teams List
  teamsList: { flex: 1, marginBottom: 12 },
  teamItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 },
  teamItemSelected: { backgroundColor: '#1a1a1a' },
  teamItemText: { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  teamItemTextSelected: { color: '#fff' },
  teamPlayerCount: { fontSize: 12, color: '#9ca3af', marginRight: 8 },
  teamDeleteBtn: { padding: 4 },
  teamDeleteBtnText: { fontSize: 12, color: '#9ca3af' },
  addTeamContainer: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  addTeamInputNew: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 8, fontSize: 13 },
  addTeamBtnNew: { backgroundColor: '#1a1a1a', width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  addTeamBtnTextNew: { color: '#fff', fontSize: 18, fontWeight: '600' },
  // Players Table
  addPlayerRowTop: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  playersTableHeaderNew: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 4, marginBottom: 4 },
  playersHeaderCellNew: { fontSize: 11, fontWeight: '600', color: '#64748b', paddingHorizontal: 4 },
  playersListScroll: { flex: 1 },
  playersTableRowNew: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  playersCellNew: { fontSize: 13, color: '#1a1a1a', paddingHorizontal: 4 },
  notesBtnNew: { fontSize: 14, color: '#64748b' },
  addToDatabaseBtn: { backgroundColor: '#1a1a1a', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginRight: 8 },
  addToDatabaseBtnText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  addedToDatabaseBtn: { backgroundColor: '#10b981', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginRight: 8 },
  addedToDatabaseBtnText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  deletePlayerBtn: { paddingHorizontal: 8 },
  deleteBtnSmall: { fontSize: 11 },
  ratingBadgeTight: { backgroundColor: '#dcfce7', paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4, alignSelf: 'flex-start' },
  ratingTextTight: { fontSize: 10, fontWeight: '600', color: '#166534' },
  // Add Player Row
  addPlayerRowNew: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  addPlayerInputNew: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 8, fontSize: 13 },
  addPlayerBtnNew: { backgroundColor: '#1a1a1a', width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  addPlayerBtnTextNew: { color: '#fff', fontSize: 18, fontWeight: '600' },
  // No Team Selected
  noTeamSelected: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noTeamSelectedText: { fontSize: 16, color: '#9ca3af' },
  // Footer
  gameDetailFooter: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'flex-start' },
  notesPlayerName: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  // Player Edit Modal
  playerEditRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  playerEditField: { marginBottom: 12 },
  playerEditLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  playerEditInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#1a1a1a' },
  positionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  positionChipSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  positionChipSmallSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  positionChipSmallText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  positionChipSmallTextSelected: { color: '#fff' },
  ratingChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingChipSmall: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  ratingChipSmallSelected: { backgroundColor: '#10b981', borderColor: '#10b981' },
  ratingChipSmallText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  ratingChipSmallTextSelected: { color: '#fff' },
  // Add Player Dropdowns
  addPlayerDropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  addPlayerDropdownBtnRating: { backgroundColor: '#dcfce7', borderColor: '#10b981' },
  addPlayerDropdownBtnText: { fontSize: 12, color: '#1a1a1a' },
  addPlayerDropdownBtnTextRating: { color: '#166534', fontWeight: '600' },
  addPlayerDropdownArrow: { fontSize: 8, color: '#9ca3af', marginLeft: 2 },
  addPlayerDropdownArrowRating: { color: '#166534' },
  addPlayerDropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, marginTop: 2, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5, minWidth: 80 },
  addPlayerDropdownItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  addPlayerDropdownItemActive: { backgroundColor: '#dcfce7' },
  addPlayerDropdownItemText: { fontSize: 12, color: '#1a1a1a' },
  addPlayerDropdownItemTextActive: { color: '#166534', fontWeight: '600' },
  // Edit Player Dropdowns
  playerEditDropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  playerEditDropdownBtnRating: { backgroundColor: '#dcfce7', borderColor: '#10b981' },
  playerEditDropdownBtnText: { fontSize: 14, color: '#1a1a1a' },
  playerEditDropdownBtnTextRating: { color: '#166534', fontWeight: '600' },
  playerEditDropdownArrow: { fontSize: 10, color: '#9ca3af', marginLeft: 4 },
  playerEditDropdownArrowRating: { color: '#166534' },
  playerEditDropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, marginTop: 2, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5 },
  playerEditDropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  playerEditDropdownItemActive: { backgroundColor: '#dcfce7' },
  playerEditDropdownItemText: { fontSize: 14, color: '#1a1a1a' },
  playerEditDropdownItemTextActive: { color: '#166534', fontWeight: '600' },
});
