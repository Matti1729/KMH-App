import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Platform, Linking } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';

const POSITIONS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];

const SCOUTING_STATUS = [
  { id: 'gesichtet', label: 'Gesichtet', color: '#10b981' },
  { id: 'in_beobachtung', label: 'In Beobachtung', color: '#f59e0b' },
  { id: 'kontaktiert', label: 'Kontaktiert', color: '#3b82f6' },
];

const LISTINGS = ['Karl Herzog Sportmanagement', 'PM Sportmanagement'];

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
    return date.toLocaleDateString('de-DE');
  } catch {
    return dateStr;
  }
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
    date: '', home_team: '', away_team: '', location: '', notes: ''
  });

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
      const { data: advisor } = await supabase.from('advisors').select('first_name, last_name').eq('id', user.id).single();
      if (advisor) setCurrentUserName(`${advisor.first_name} ${advisor.last_name}`);
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
    }
    setLoading(false);
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
      scout_id: currentUserId
    };
    
    const { error } = await supabase.from('scouted_players').insert(playerData);
    if (!error) {
      setShowAddPlayerModal(false);
      setNewPlayer({ first_name: '', last_name: '', birth_date: '2005', position: 'ST', club: '', rating: 5, notes: '', status: 'gesichtet', photo_url: '', transfermarkt_url: '', agent_name: '', phone: '', additional_info: '', current_status: '' });
      setNewPlayerClubSearch('');
      fetchScoutedPlayers();
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
    if (!newGame.date || !newGame.home_team || !newGame.away_team || !currentUserId) return;
    const { error } = await supabase.from('scouting_games').insert({ ...newGame, scout_id: currentUserId });
    if (!error) {
      setShowAddGameModal(false);
      setNewGame({ date: '', home_team: '', away_team: '', location: '', notes: '' });
      fetchScoutingGames();
    }
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

  const getPlayersByStatus = (status: string) => filteredPlayers.filter(p => p.status === status);

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
          placeholder="Verein suchen..." 
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
            <Text style={styles.playerName}>{player.first_name} {player.last_name}</Text>
            <Text style={styles.playerYear}>Jg. {getYearFromDate(player.birth_date)}</Text>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.positionBadgesRow}>
              {parsePositions(player.position).map((pos, idx) => (
                <View key={idx} style={styles.positionBadge}><Text style={styles.positionText}>{pos}</Text></View>
              ))}
            </View>
            <View style={styles.ratingBadgeCard}><Text style={styles.ratingTextCard}>⭐ {player.rating}/10</Text></View>
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
            width: 380, 
            backgroundColor: isDropTarget ? '#dbeafe' : '#f1f5f9', 
            borderRadius: 12, 
            marginRight: 16, 
            padding: 12, 
            border: isDropTarget ? '2px dashed #3b82f6' : '2px solid transparent', 
            transition: 'background-color 0.2s', 
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 250px)',
          }}>
          <View style={styles.kanbanHeader}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.kanbanTitle}>{status.label}</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{players.length}</Text></View>
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
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={styles.kanbanTitle}>{status.label}</Text>
          <View style={styles.countBadge}><Text style={styles.countText}>{players.length}</Text></View>
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
              <View style={styles.ratingBadgeList}><Text style={styles.ratingTextList}>⭐ {player.rating}/10</Text></View>
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

  const renderGamesTab = () => (
    <View style={styles.gamesContainer}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Datum</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Spiel</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Ort</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Scout</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}></Text>
      </View>
      <ScrollView>
        {scoutingGames.map(game => (
          <View key={game.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1 }]}>{new Date(game.date).toLocaleDateString('de-DE')}</Text>
            <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }]}>{game.home_team} vs {game.away_team}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{game.location}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{game.scout_name}</Text>
            <TouchableOpacity style={[styles.tableCell, { flex: 0.5 }]} onPress={() => deleteScoutingGame(game.id)}><Text>🗑️</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );

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
            <TextInput style={styles.formInput} value={data.first_name} onChangeText={(t) => setData({...data, first_name: t})} placeholder="Vorname" />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Nachname *</Text>
            <TextInput style={styles.formInput} value={data.last_name} onChangeText={(t) => setData({...data, last_name: t})} placeholder="Nachname" />
          </View>
        </View>
        <View style={[styles.formRow, { zIndex: 9999 }]}>
          <View style={[styles.formField, { zIndex: 9999 }]}>
            <Text style={styles.formLabel}>Verein</Text>
            {renderClubSelector(clubSearch, setClubSearch, showClubDrop, setShowClubDrop, (c) => setData({...data, club: c}))}
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Geburtsdatum / Jahrgang</Text>
            <TextInput style={styles.formInput} value={data.birth_date || ''} onChangeText={(t) => setData({...data, birth_date: t})} placeholder="YYYY-MM-DD oder YYYY" />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Kontakt</Text>
            <TextInput 
              style={styles.formInput} 
              value={data.phone || ''} 
              onChangeText={(t) => setData({...data, phone: t})} 
              placeholder="Telefonnummer..." 
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>IST-Stand</Text>
            <TextInput 
              style={styles.formInput} 
              value={data.current_status || ''} 
              onChangeText={(t) => setData({...data, current_status: t})} 
              placeholder="z.B. Termin am 15.01." 
            />
          </View>
        </View>
      </View>

      {/* Zweite Säule: Position + Einschätzung */}
      <View style={[styles.detailInfo, { zIndex: 1 }]}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Position:</Text>
          <View style={styles.positionPickerSmall}>
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
              placeholder="https://www.transfermarkt.de/spieler/profil/..." 
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
        <TextInput style={[styles.formInput, styles.textArea]} value={data.additional_info || ''} onChangeText={(t) => setData({...data, additional_info: t})} placeholder="Weitere Informationen..." multiline />
      </View>

      {/* Ganz unten: Fußballerische Einschätzung */}
      <View style={[styles.detailSection, { marginBottom: 20 }]}>
        <Text style={styles.detailSectionTitle}>Fußballerische Einschätzung</Text>
        <TextInput style={[styles.formInput, styles.textArea]} value={data.notes || ''} onChangeText={(t) => setData({...data, notes: t})} placeholder="Fußballerische Einschätzung..." multiline />
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

  return (
    <View style={styles.container}>
      <Sidebar activeScreen="Scouting" navigation={navigation} />
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <View>
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
            <TextInput style={styles.searchInput} placeholder="Spieler, Verein suchen..." value={searchText} onChangeText={setSearchText} />
          </View>
          
          <View style={styles.filterContainer}>
            <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity style={[styles.filterButton, selectedPositions.length > 0 && styles.filterButtonActive]} 
                onPress={() => { setShowPositionDropdown(!showPositionDropdown); setShowYearDropdown(false); }}>
                <Text style={[styles.filterButtonText, selectedPositions.length > 0 && styles.filterButtonTextActive]}>{getPositionFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showPositionDropdown && (
                <View style={styles.filterDropdownMulti}>
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
                </View>
              )}
            </View>

            <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
              <TouchableOpacity style={[styles.filterButton, selectedYears.length > 0 && styles.filterButtonActive]} 
                onPress={() => { setShowYearDropdown(!showYearDropdown); setShowPositionDropdown(false); }}>
                <Text style={[styles.filterButtonText, selectedYears.length > 0 && styles.filterButtonTextActive]}>{getYearFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showYearDropdown && (
                <View style={styles.filterDropdownMulti}>
                  <View style={styles.filterDropdownHeader}>
                    <Text style={styles.filterDropdownTitle}>Jahrgänge wählen</Text>
                    {selectedYears.length > 0 && <TouchableOpacity onPress={clearYears}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableYears.length === 0 ? (
                      <Text style={styles.noDataText}>Keine Spieler vorhanden</Text>
                    ) : (
                      availableYears.map(year => {
                        const isSelected = selectedYears.includes(year);
                        const count = scoutedPlayers.filter(p => getYearFromDate(p.birth_date) === year).length;
                        return (
                          <TouchableOpacity key={year} style={styles.filterCheckboxItem} onPress={() => toggleYear(year)}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>Jg. {year}</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowYearDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>

            {/* Rating Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 10 }]}>
              <TouchableOpacity style={[styles.filterButton, selectedRatings.length > 0 && styles.filterButtonActive]} 
                onPress={() => { setShowRatingDropdown(!showRatingDropdown); setShowPositionDropdown(false); setShowYearDropdown(false); }}>
                <Text style={[styles.filterButtonText, selectedRatings.length > 0 && styles.filterButtonTextActive]}>{getRatingFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showRatingDropdown && (
                <View style={styles.filterDropdownMulti}>
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
                </View>
              )}
            </View>
          </View>

          <View style={styles.viewToggle}>
            <TouchableOpacity style={[styles.viewButton, viewMode === 'kanban' && styles.viewButtonActive]} onPress={() => setViewMode('kanban')}>
              <Text style={[styles.viewButtonText, viewMode === 'kanban' && styles.viewButtonTextActive]}>Kanban</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewButton, viewMode === 'liste' && styles.viewButtonActive]} onPress={() => setViewMode('liste')}>
              <Text style={[styles.viewButtonText, viewMode === 'liste' && styles.viewButtonTextActive]}>Liste</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewButton, viewMode === 'archiv' && styles.viewButtonActive]} onPress={() => setViewMode('archiv')}>
              <Text style={[styles.viewButtonText, viewMode === 'archiv' && styles.viewButtonTextActive]}>Archiv ({archivedPlayersCount})</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.filterButton} onPress={() => activeTab === 'spieler' ? setShowAddPlayerModal(true) : setShowAddGameModal(true)}>
            <Text style={styles.filterButtonText}>{activeTab === 'spieler' ? 'neuen Spieler anlegen' : 'neues Spiel anlegen'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'spieler' ? (
            viewMode === 'kanban' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kanbanContainer}>
                {SCOUTING_STATUS.map(status => renderKanbanColumn(status))}
              </ScrollView>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { overflow: 'visible' }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.modalTitle}>Neuen Spieler hinzufügen</Text>
              <TouchableOpacity onPress={() => { setShowAddPlayerModal(false); setNewPlayerClubSearch(''); setShowNewPlayerClubDropdown(false); }} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {renderPlayerForm(newPlayer, setNewPlayer, newPlayerClubSearch, setNewPlayerClubSearch, showNewPlayerClubDropdown, setShowNewPlayerClubDropdown)}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowAddPlayerModal(false); setNewPlayerClubSearch(''); setShowNewPlayerClubDropdown(false); }}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addScoutedPlayer}><Text style={styles.saveButtonText}>Hinzufügen</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Game Modal */}
      <Modal visible={showAddGameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.modalTitle}>Scouting-Spiel hinzufügen</Text>
              <TouchableOpacity onPress={() => setShowAddGameModal(false)} style={styles.closeButton}><Text style={styles.closeButtonText}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formField}><Text style={styles.formLabel}>Datum</Text><TextInput style={styles.formInput} value={newGame.date} onChangeText={(t) => setNewGame({...newGame, date: t})} placeholder="YYYY-MM-DD" /></View>
              <View style={styles.formField}><Text style={styles.formLabel}>Ort</Text><TextInput style={styles.formInput} value={newGame.location} onChangeText={(t) => setNewGame({...newGame, location: t})} placeholder="Spielort" /></View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formField}><Text style={styles.formLabel}>Heimmannschaft</Text><TextInput style={styles.formInput} value={newGame.home_team} onChangeText={(t) => setNewGame({...newGame, home_team: t})} placeholder="Heim" /></View>
              <View style={styles.formField}><Text style={styles.formLabel}>Auswärtsmannschaft</Text><TextInput style={styles.formInput} value={newGame.away_team} onChangeText={(t) => setNewGame({...newGame, away_team: t})} placeholder="Auswärts" /></View>
            </View>
            <View style={styles.formField}><Text style={styles.formLabel}>Notizen</Text><TextInput style={[styles.formInput, styles.textArea]} value={newGame.notes} onChangeText={(t) => setNewGame({...newGame, notes: t})} placeholder="Notizen..." multiline /></View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddGameModal(false)}><Text style={styles.cancelButtonText}>Abbrechen</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addScoutingGame}><Text style={styles.saveButtonText}>Hinzufügen</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                          <View style={styles.ratingBadgeLarge}><Text style={styles.ratingTextLarge}>⭐ {selectedPlayer.rating}/10</Text></View>
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
                placeholder="z.B. Kein Interesse, Spieler hat abgesagt, andere Agentur gewählt..." 
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  mainContent: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  headerTabs: { flexDirection: 'row', gap: 8 },
  headerTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  headerTabActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  headerTabIcon: { fontSize: 16, marginRight: 8 },
  headerTabText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  headerTabTextActive: { color: '#fff' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, backgroundColor: '#fff', padding: 12, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, zIndex: 100 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12 },
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
  content: { flex: 1 },
  kanbanContainer: { flex: 1 },
  kanbanColumn: { width: 300, backgroundColor: '#f1f5f9', borderRadius: 12, marginRight: 16, padding: 12, minHeight: 400 },
  kanbanColumnDropTarget: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#3b82f6', borderStyle: 'dashed' },
  kanbanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  kanbanTitle: { fontSize: 14, fontWeight: '600', color: '#475569', flex: 1 },
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
  clubSelectorContainer: { position: 'relative', zIndex: 9999 },
  clubDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, zIndex: 9999, elevation: 9999 },
  clubDropdownScroll: { maxHeight: 200 },
  clubDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  clubDropdownLogo: { width: 24, height: 24, resizeMode: 'contain', marginRight: 10 },
  clubDropdownText: { fontSize: 14, color: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
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
});
