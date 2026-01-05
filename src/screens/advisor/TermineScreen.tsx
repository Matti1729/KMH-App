import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { getRelevantTermine, convertToDbFormat, getLastUpdateDisplay, getDFBTermineCount, getHallenTermineCount } from '../../services/dfbTermine';
import { syncAllPlayerGames, getApiToken, registerApiToken } from '../../services/fussballDeApi';
import { Ionicons } from '@expo/vector-icons';

interface Termin {
  id: string;
  datum: string;
  datum_ende?: string;
  art: string;
  titel: string;
  jahrgang: string;
  ort: string;
  uebernahme_advisor_id: string;
  erstellt_von: string;
  quelle?: string;
  created_at: string;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface PlayerGame {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  game_type: string;
  location: string;
  player_id: string;
  player_name?: string;
  responsibility?: string;
  created_at: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
  responsibility: string;
}

interface ClubLogo {
  club_name: string;
  logo_url: string;
}

type ViewMode = 'dashboard' | 'spiele' | 'termine' | 'kalender';
type SortField = 'datum' | 'art' | 'titel' | 'jahrgang' | 'ort' | 'uebernahme';
type SortDirection = 'asc' | 'desc';

// Nur diese 3 Optionen beim Anlegen
const TERMIN_ARTEN = ['Nationalmannschaft', 'Hallenturnier', 'Sonstiges'];
const JAHRGAENGE = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U20', 'U21', 'U23', 'Herren', 'Sonstige'];

export function TermineScreen({ navigation }: any) {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [profile, setProfile] = useState<Advisor | null>(null);
  const [termine, setTermine] = useState<Termin[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; skipped: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTermin, setSelectedTermin] = useState<Termin | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Spiele unserer Spieler State
  const [playerGames, setPlayerGames] = useState<PlayerGame[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [gamesSearchText, setGamesSearchText] = useState('');
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showResponsibilityDropdown, setShowResponsibilityDropdown] = useState(false);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [newGame, setNewGame] = useState({ date: '', home_team: '', away_team: '', game_type: 'Liga', location: '', player_id: '' });
  const [syncingGames, setSyncingGames] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; playerName: string } | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('datum');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Form state
  const [formDatum, setFormDatum] = useState('');
  const [formDatumEnde, setFormDatumEnde] = useState('');
  const [formZeit, setFormZeit] = useState('');
  const [formArt, setFormArt] = useState('Sonstiges');
  const [formTitel, setFormTitel] = useState('');
  const [formJahrgang, setFormJahrgang] = useState('');
  const [formOrt, setFormOrt] = useState('');
  const [formUebernahme, setFormUebernahme] = useState('');

  useEffect(() => { fetchProfile(); fetchAdvisors(); fetchTermine(); fetchPlayers(); fetchPlayerGames(); fetchClubLogos(); }, []);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('id, first_name, last_name, club, responsibility').order('last_name');
    if (data) setPlayers(data);
  };

  const fetchPlayerGames = async () => {
    const { data } = await supabase.from('player_games').select('*').order('date', { ascending: true });
    if (data) {
      // Player names hinzufügen
      const gamesWithNames = data.map(game => {
        const player = players.find(p => p.id === game.player_id);
        return {
          ...game,
          player_name: player ? `${player.first_name} ${player.last_name}` : '-',
          responsibility: player?.responsibility || '-'
        };
      });
      setPlayerGames(gamesWithNames);
    }
  };

  const fetchClubLogos = async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logos: Record<string, string> = {};
      data.forEach(cl => { logos[cl.club_name] = cl.logo_url; });
      setClubLogos(logos);
    }
  };

  // Re-fetch games when players change
  useEffect(() => {
    if (players.length > 0) {
      fetchPlayerGames();
    }
  }, [players]);

  const getClubLogo = (clubName: string): string | null => {
    return clubLogos[clubName] || null;
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('advisors').select('id, first_name, last_name, role').eq('id', user.id).single();
      if (data) setProfile(data);
    }
  };

  const fetchAdvisors = async () => {
    const { data } = await supabase.from('advisors').select('id, first_name, last_name').order('last_name');
    if (data) setAdvisors(data);
  };

  const fetchTermine = async () => {
    setLoading(true);
    const now = new Date();
    const oneDayAgo = new Date(); 
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Hole Termine wo:
    // 1. Startdatum >= gestern ODER
    // 2. Enddatum >= heute (noch laufende Termine)
    const { data, error } = await supabase
      .from('termine')
      .select('*')
      .or(`datum.gte.${oneDayAgo.toISOString()},datum_ende.gte.${now.toISOString()}`)
      .order('datum', { ascending: true });
    
    if (!error && data) setTermine(data);
    setLoading(false);
  };

  const getAdvisorName = (advisorId: string): string => {
    const advisor = advisors.find(a => a.id === advisorId);
    return advisor ? `${advisor.first_name} ${advisor.last_name}` : '-';
  };

  const resetForm = () => { 
    setFormDatum(''); setFormDatumEnde(''); setFormZeit(''); 
    setFormArt('Sonstiges'); setFormTitel(''); setFormJahrgang(''); 
    setFormOrt(''); setFormUebernahme(''); 
  };
  
  const openAddModal = () => { resetForm(); setShowAddModal(true); };

  const openEditModal = (termin: Termin) => {
    setSelectedTermin(termin);
    const date = new Date(termin.datum);
    setFormDatum(date.toISOString().split('T')[0]);
    const hours = date.getHours(), minutes = date.getMinutes();
    setFormZeit((hours !== 0 || minutes !== 0) ? date.toTimeString().slice(0, 5) : '');
    setFormDatumEnde(termin.datum_ende ? new Date(termin.datum_ende).toISOString().split('T')[0] : '');
    setFormArt(termin.art); setFormTitel(termin.titel); setFormJahrgang(termin.jahrgang || '');
    setFormOrt(termin.ort || ''); setFormUebernahme(termin.uebernahme_advisor_id || '');
    setShowEditModal(true);
  };

  const handleSaveTermin = async () => {
    if (!formDatum || !formTitel || !formArt) { alert('Bitte Datum, Art und Beschreibung ausfüllen'); return; }
    const datum = formZeit ? `${formDatum}T${formZeit}:00` : `${formDatum}T00:00:00`;
    const terminData = { 
      datum, datum_ende: formDatumEnde || null, art: formArt, titel: formTitel, 
      jahrgang: formJahrgang || null, ort: formOrt || null, 
      uebernahme_advisor_id: formUebernahme || null, erstellt_von: profile?.id 
    };
    const { error } = await supabase.from('termine').insert([terminData]);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowAddModal(false); resetForm(); fetchTermine(); }
  };

  const handleUpdateTermin = async () => {
    if (!selectedTermin || !formDatum || !formTitel || !formArt) { alert('Bitte Datum, Art und Beschreibung ausfüllen'); return; }
    const datum = formZeit ? `${formDatum}T${formZeit}:00` : `${formDatum}T00:00:00`;
    const { error } = await supabase.from('termine').update({ 
      datum, datum_ende: formDatumEnde || null, art: formArt, titel: formTitel, 
      jahrgang: formJahrgang || null, ort: formOrt || null, 
      uebernahme_advisor_id: formUebernahme || null 
    }).eq('id', selectedTermin.id);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowEditModal(false); setSelectedTermin(null); resetForm(); fetchTermine(); }
  };

  const handleDeleteTermin = async () => {
    if (!selectedTermin) return;
    const { error } = await supabase.from('termine').delete().eq('id', selectedTermin.id);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowEditModal(false); setSelectedTermin(null); fetchTermine(); }
  };

  const handleDFBSync = async () => {
    if (!profile?.id) { alert('Bitte zuerst anmelden'); return; }
    setSyncLoading(true); setSyncResult(null);
    try {
      const relevantTermine = getRelevantTermine();
      let added = 0, skipped = 0;
      const { data: existingTermine } = await supabase.from('termine').select('datum, jahrgang, titel').in('quelle', ['DFB', 'Hallenturnier']);
      const existingKeys = new Set((existingTermine || []).map(t => { 
        const date = new Date(t.datum).toISOString().split('T')[0]; 
        return `${date}_${t.jahrgang}_${t.titel}`; 
      }));
      for (const dfbTermin of relevantTermine) {
        const dbData = convertToDbFormat(dfbTermin, profile.id);
        const key = `${dfbTermin.datumStart}_${dfbTermin.jahrgang}_${dbData.titel}`;
        if (existingKeys.has(key)) { skipped++; continue; }
        const { error } = await supabase.from('termine').insert([dbData]);
        if (!error) { added++; } else { console.error('Fehler:', error); }
      }
      setSyncResult({ added, skipped }); fetchTermine();
    } catch (error) { console.error('Sync Fehler:', error); alert('Fehler beim Synchronisieren'); }
    finally { setSyncLoading(false); }
  };

  // Sorting functions
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Prüfen ob Nationalmannschaft oder Hallenturnier - muss vor getSortedTermine sein
  const isNationalmannschaft = (termin: Termin): boolean => {
    return termin.quelle === 'DFB' || termin.art === 'DFB-Maßnahme' || termin.art === 'DFB-Spiel' || termin.art === 'Nationalmannschaft';
  };
  
  const isHallenturnier = (termin: Termin): boolean => {
    return termin.quelle === 'Hallenturnier' || termin.art === 'Hallenturnier';
  };

  const getSortedTermine = (): Termin[] => {
    return [...termine].sort((a, b) => {
      let valueA: any, valueB: any;
      switch (sortField) {
        case 'datum':
          valueA = new Date(a.datum).getTime();
          valueB = new Date(b.datum).getTime();
          break;
        case 'art':
          // Alphabetisch nach angezeigtem Art-Namen
          const artA = isNationalmannschaft(a) ? 'Nationalmannschaft' : isHallenturnier(a) ? 'Hallenturnier' : a.art;
          const artB = isNationalmannschaft(b) ? 'Nationalmannschaft' : isHallenturnier(b) ? 'Hallenturnier' : b.art;
          valueA = artA?.toLowerCase() || '';
          valueB = artB?.toLowerCase() || '';
          break;
        case 'titel':
          valueA = a.titel?.toLowerCase() || '';
          valueB = b.titel?.toLowerCase() || '';
          break;
        case 'jahrgang':
          valueA = a.jahrgang?.toLowerCase() || '';
          valueB = b.jahrgang?.toLowerCase() || '';
          break;
        case 'ort':
          valueA = a.ort?.toLowerCase() || '';
          valueB = b.ort?.toLowerCase() || '';
          break;
        case 'uebernahme':
          valueA = getAdvisorName(a.uebernahme_advisor_id).toLowerCase();
          valueB = getAdvisorName(b.uebernahme_advisor_id).toLowerCase();
          break;
        default:
          return 0;
      }
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortIndicator = (field: SortField): string => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Datum formatieren mit kurzem Jahr (26 statt 2026)
  const formatDate = (termin: Termin): string => {
    const startDate = new Date(termin.datum);
    const formatShort = (d: Date) => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    };
    
    if (termin.datum_ende) {
      const endDate = new Date(termin.datum_ende);
      const startDay = startDate.getDate().toString().padStart(2, '0');
      const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
      // Wenn gleicher Monat, nur Tag anzeigen
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        return `${startDay}.-${formatShort(endDate)}`;
      }
      return `${startDay}.${startMonth}.-${formatShort(endDate)}`;
    }
    return formatShort(startDate);
  };

  // Zeit nur anzeigen wenn echte Zeit vorhanden (nicht 00:00, 01:00, 02:00 etc.)
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Wenn Stunde 0, 1 oder 2 und Minuten 0 ist, dann keine echte Zeit
    if ((hours === 0 || hours === 1 || hours === 2) && minutes === 0) return '';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const isTerminPast = (dateString: string, datumEnde?: string): boolean => {
    const now = new Date();
    // Wenn Enddatum vorhanden, prüfe ob das Enddatum in der Vergangenheit liegt
    if (datumEnde) {
      return new Date(datumEnde) < now;
    }
    // Sonst nur Startdatum prüfen
    return new Date(dateString) < now;
  };
  
  // Prüfen ob Termin heute ist
  const isTerminToday = (termin: Termin): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startDate = new Date(termin.datum);
    const endDate = termin.datum_ende ? new Date(termin.datum_ende) : startDate;
    
    // Termin ist heute wenn: Start <= heute < morgen ODER heute liegt zwischen Start und Ende
    return (startDate >= today && startDate < tomorrow) || 
           (startDate <= today && endDate >= today);
  };
  
  const getUpcomingTermineCount = (): number => termine.filter(t => new Date(t.datum) >= new Date()).length;
  const getUrgentTermineCount = (): number => { 
    const now = new Date(); 
    const in7Days = new Date(now.getTime() + 7*24*60*60*1000); 
    return termine.filter(t => { const d = new Date(t.datum); return d >= now && d <= in7Days; }).length; 
  };

  // Art-Anzeige: DFB-Maßnahme, DFB-Spiel etc. → "Nationalmannschaft"
  const getDisplayArt = (art: string): string => {
    if (art === 'DFB-Maßnahme' || art === 'DFB-Spiel' || art === 'DFB' || art === 'Nationalmannschaft') {
      return 'Nationalmannschaft';
    }
    return art;
  };

  const DashboardCard = ({ id, children, style, onPress, hoverStyle }: { 
    id: string; children: React.ReactNode; style?: any; onPress?: () => void; hoverStyle?: any; 
  }) => (
    <Pressable 
      onPress={onPress} 
      onHoverIn={() => setHoveredCard(id)} 
      onHoverOut={() => setHoveredCard(null)} 
      style={[styles.card, style, hoveredCard === id && (hoverStyle || styles.cardHovered)]}
    >
      {children}
    </Pressable>
  );

  const SortableHeader = ({ field, label, style }: { field: SortField; label: string; style: any }) => (
    <TouchableOpacity onPress={() => handleSort(field)} style={[style, styles.sortableHeader]}>
      <Text style={styles.termineTableHeaderText}>{label} {getSortIndicator(field)}</Text>
    </TouchableOpacity>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <DashboardCard id="spiele" style={styles.mainCard} onPress={() => setViewMode('spiele')} hoverStyle={styles.mainCardHovered}>
            <View style={styles.mainCardContent}>
              <View style={styles.mainCardLeft}>
                <Text style={styles.mainCardTitle}>Spiele unserer Spieler</Text>
                <Text style={styles.mainCardSubtitle}>Alle Partien deiner Mandanten{'\n'}im Überblick</Text>
                <View style={styles.mainCardFooter}><Text style={styles.mainCardLink}>Zur Übersicht</Text><Text style={styles.mainCardArrow}>→</Text></View>
              </View>
              <View style={styles.mainCardRight}><Text style={styles.mainCardIcon}>⚽</Text></View>
            </View>
          </DashboardCard>
          <View style={styles.rightColumn}>
            <DashboardCard id="termine" style={styles.termineCard} onPress={() => setViewMode('termine')} hoverStyle={styles.lightCardHovered}>
              <View style={styles.termineHeader}>
                <View style={styles.termineIcon}><Text style={styles.termineIconText}>📋</Text></View>
                <Text style={styles.termineCount}>{getUpcomingTermineCount()}</Text>
              </View>
              <View style={styles.termineFooter}>
                <Text style={styles.termineTitle}>Weitere Termine</Text>
                <Text style={styles.termineSubtitle}>Meetings & Lehrgänge</Text>
              </View>
            </DashboardCard>
            <DashboardCard id="kalender" style={styles.kalenderCard} onPress={() => setViewMode('kalender')} hoverStyle={styles.darkCardHovered}>
              {getUrgentTermineCount() > 0 && <View style={styles.urgentBadge}><Text style={styles.urgentBadgeText}>{getUrgentTermineCount()} diese Woche</Text></View>}
              <View style={styles.kalenderIcon}><Text style={styles.kalenderIconText}>📅</Text></View>
              <View style={styles.kalenderFooter}>
                <Text style={styles.kalenderTitle}>Kalender</Text>
                <Text style={styles.kalenderSubtitle}>Übersicht & Export</Text>
              </View>
            </DashboardCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderWeitereTermine = () => {
    const sortedTermine = getSortedTermine();
    const dfbCount = getDFBTermineCount();
    const hallenCount = getHallenTermineCount();
    
    return (
      <View style={styles.scoutingMainContent}>
        {/* Header Banner - wie Scouting */}
        <View style={styles.scoutingHeaderBanner}>
          <TouchableOpacity style={styles.scoutingFilterButton} onPress={() => setViewMode('dashboard')}>
            <Text style={styles.scoutingFilterButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.scoutingHeaderBannerCenter}>
            <Text style={styles.scoutingTitle}>Weitere Termine</Text>
            <Text style={styles.scoutingSubtitle}>{dfbCount} DFB-Nationalmannschaftstermine & {hallenCount} Hallenturniere</Text>
          </View>
          <View style={styles.termineHeaderButtons}>
            <TouchableOpacity onPress={() => setShowSyncModal(true)} style={styles.scoutingFilterButton}>
              <Text style={styles.scoutingFilterButtonText}>🔄 Aktualisieren</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openAddModal} style={styles.scoutingFilterButton}>
              <Text style={styles.scoutingFilterButtonText}>+ Neuer Termin</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabelle */}
        <View style={styles.scoutingContent}>
          <View style={styles.scoutingGamesContainer}>
            <View style={styles.termineTableHeader}>
              <SortableHeader field="datum" label="Datum" style={styles.termineColDatum} />
              <View style={styles.termineColZeit}><Text style={styles.termineTableHeaderText}>Zeit</Text></View>
              <SortableHeader field="art" label="Art" style={styles.termineColArt} />
              <SortableHeader field="titel" label="Beschreibung" style={styles.termineColTitel} />
              <SortableHeader field="jahrgang" label="Jahrgang" style={styles.termineColJahrgang} />
              <SortableHeader field="ort" label="Ort" style={styles.termineColOrt} />
              <SortableHeader field="uebernahme" label="Übernahme" style={styles.termineColUebernahme} />
            </View>
            
            <ScrollView>
              {loading ? (
                <Text style={styles.loadingText}>Laden...</Text>
              ) : sortedTermine.length === 0 ? (
                <View style={styles.scoutingEmptyState}>
                  <Text style={styles.scoutingEmptyText}>Keine Termine vorhanden</Text>
                  <TouchableOpacity onPress={() => setShowSyncModal(true)} style={[styles.scoutingFilterButton, { marginTop: 16 }]}>
                    <Text style={styles.scoutingFilterButtonText}>DFB & Hallen-Termine laden</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                sortedTermine.map((termin) => {
                  const isPast = isTerminPast(termin.datum, termin.datum_ende);
                  const isToday = isTerminToday(termin);
                  const isNM = isNationalmannschaft(termin);
                  const isHT = isHallenturnier(termin);
                  const time = formatTime(termin.datum);
                  
                  return (
                    <TouchableOpacity 
                      key={termin.id} 
                      style={[
                        styles.termineTableRow, 
                        isPast && styles.termineTableRowPast,
                        isToday && !isPast && styles.termineTableRowToday
                      ]} 
                      onPress={() => openEditModal(termin)}
                    >
                      <Text style={[styles.termineTableCell, styles.termineColDatum, isPast && styles.termineCellPast]}>{formatDate(termin)}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColZeit, isPast && styles.termineCellPast]}>{time || '-'}</Text>
                      <View style={styles.termineColArt}>
                        <View style={[
                          styles.artBadge, 
                          isNM ? styles.artNationalmannschaft : isHT ? styles.artHallenturnier : styles.artSonstige,
                          isPast && styles.artBadgePast
                        ]}>
                          <Text style={[
                            styles.artBadgeText, 
                            isNM ? styles.artNationalmannschaftText : isHT ? styles.artHallenturnierText : null
                          ]}>
                            {isNM ? 'Nationalmannschaft' : isHT ? 'Hallenturnier' : getDisplayArt(termin.art)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.termineTableCell, styles.termineColTitel, isPast && styles.termineCellPast]} numberOfLines={1}>{termin.titel}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColJahrgang, isPast && styles.termineCellPast]}>{termin.jahrgang || '-'}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColOrt, isPast && styles.termineCellPast]} numberOfLines={1}>{termin.ort || '-'}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColUebernahme, isPast && styles.termineCellPast]}>{getAdvisorName(termin.uebernahme_advisor_id)}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  // Spiele Filter Logik
  const availableResponsibilities = useMemo(() => {
    const responsibilities = new Set<string>();
    players.forEach(p => { if (p.responsibility) responsibilities.add(p.responsibility); });
    return Array.from(responsibilities).sort();
  }, [players]);

  const availablePlayers = useMemo(() => {
    return players.map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      club: p.club
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const filteredGames = useMemo(() => {
    let games = [...playerGames];
    
    // Text-Suche
    if (gamesSearchText) {
      const search = gamesSearchText.toLowerCase();
      games = games.filter(g => 
        g.home_team?.toLowerCase().includes(search) ||
        g.away_team?.toLowerCase().includes(search) ||
        g.player_name?.toLowerCase().includes(search) ||
        g.location?.toLowerCase().includes(search)
      );
    }
    
    // Zuständigkeit Filter
    if (selectedResponsibilities.length > 0) {
      games = games.filter(g => selectedResponsibilities.includes(g.responsibility || ''));
    }
    
    // Spieler Filter
    if (selectedPlayers.length > 0) {
      games = games.filter(g => selectedPlayers.includes(g.player_id));
    }
    
    return games;
  }, [playerGames, gamesSearchText, selectedResponsibilities, selectedPlayers]);

  const toggleResponsibility = (resp: string) => {
    setSelectedResponsibilities(prev => 
      prev.includes(resp) ? prev.filter(r => r !== resp) : [...prev, resp]
    );
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) ? prev.filter(p => p !== playerId) : [...prev, playerId]
    );
  };

  const closeAllGameDropdowns = () => {
    setShowResponsibilityDropdown(false);
    setShowPlayerDropdown(false);
  };

  // Sync Spiele von fussball.de API
  const syncPlayerGames = async () => {
    setSyncingGames(true);
    setSyncProgress({ current: 0, total: players.length, playerName: '' });
    
    try {
      // Prüfen ob API Token vorhanden
      const token = await getApiToken(supabase);
      
      if (!token) {
        // Token registrieren Dialog
        Alert.alert(
          'API Token benötigt',
          'Um Spiele von fussball.de zu laden, wird ein API Token benötigt. Möchtest du einen Token registrieren?',
          [
            { text: 'Abbrechen', style: 'cancel', onPress: () => setSyncingGames(false) },
            { 
              text: 'Token registrieren', 
              onPress: async () => {
                const email = prompt('E-Mail für API Registrierung:');
                if (email) {
                  const newToken = await registerApiToken(supabase, email);
                  if (newToken) {
                    Alert.alert('Erfolg', 'API Token wurde registriert. Bitte erneut synchronisieren.');
                  } else {
                    Alert.alert('Fehler', 'Token konnte nicht registriert werden.');
                  }
                }
                setSyncingGames(false);
              }
            }
          ]
        );
        return;
      }
      
      // Spieler mit fussball_de_club_id laden
      const { data: playersWithClubId } = await supabase
        .from('players')
        .select('id, first_name, last_name, club, fussball_de_club_id');
      
      if (!playersWithClubId || playersWithClubId.length === 0) {
        Alert.alert('Hinweis', 'Keine Spieler vorhanden.');
        setSyncingGames(false);
        return;
      }
      
      // Sync durchführen
      const result = await syncAllPlayerGames(
        supabase,
        playersWithClubId,
        (current, total, playerName) => {
          setSyncProgress({ current, total, playerName });
        }
      );
      
      // Ergebnis anzeigen
      let message = `Synchronisierung abgeschlossen!\n\n`;
      message += `✅ ${result.added} neue Spiele hinzugefügt\n`;
      message += `🔄 ${result.updated} Spiele aktualisiert`;
      
      if (result.errors.length > 0) {
        message += `\n\n⚠️ ${result.errors.length} Fehler:\n`;
        message += result.errors.slice(0, 3).join('\n');
        if (result.errors.length > 3) {
          message += `\n... und ${result.errors.length - 3} weitere`;
        }
      }
      
      Alert.alert('Sync Ergebnis', message);
      
      // Spiele neu laden
      await fetchPlayerGames();
      
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Fehler', 'Fehler bei der Synchronisierung: ' + error.message);
    } finally {
      setSyncingGames(false);
      setSyncProgress(null);
    }
  };

  const addPlayerGame = async () => {
    if (!newGame.date || !newGame.home_team || !newGame.away_team || !newGame.player_id) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    
    const { error } = await supabase.from('player_games').insert([{
      date: newGame.date,
      home_team: newGame.home_team,
      away_team: newGame.away_team,
      game_type: newGame.game_type,
      location: newGame.location,
      player_id: newGame.player_id
    }]);
    
    if (error) {
      alert('Fehler: ' + error.message);
    } else {
      setShowAddGameModal(false);
      setNewGame({ date: '', home_team: '', away_team: '', game_type: 'Liga', location: '', player_id: '' });
      fetchPlayerGames();
    }
  };

  const deletePlayerGame = async (gameId: string) => {
    const { error } = await supabase.from('player_games').delete().eq('id', gameId);
    if (!error) fetchPlayerGames();
  };

  const renderSpieleUnsererSpieler = () => {
    const isAnyDropdownOpen = showResponsibilityDropdown || showPlayerDropdown;
    
    const getResponsibilityFilterLabel = () => {
      if (selectedResponsibilities.length === 0) return 'Zuständigkeit';
      if (selectedResponsibilities.length === 1) return selectedResponsibilities[0];
      return `${selectedResponsibilities.length} Zuständigkeiten`;
    };

    const getPlayerFilterLabel = () => {
      if (selectedPlayers.length === 0) return 'Spieler';
      if (selectedPlayers.length === 1) {
        const player = availablePlayers.find(p => p.id === selectedPlayers[0]);
        return player?.name || 'Spieler';
      }
      return `${selectedPlayers.length} Spieler`;
    };
    
    return (
      <View style={styles.scoutingMainContent}>
        {/* Header Banner - wie Scouting */}
        <View style={styles.scoutingHeaderBanner}>
          <TouchableOpacity style={styles.scoutingFilterButton} onPress={() => setViewMode('dashboard')}>
            <Text style={styles.scoutingFilterButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.scoutingHeaderBannerCenter}>
            <Text style={styles.scoutingTitle}>Spiele unserer Spieler</Text>
            <Text style={styles.scoutingSubtitle}>Alle Termine und Partien unserer Spieler im Überblick für die nächsten 8 Wochen</Text>
          </View>
          <TouchableOpacity 
            style={[styles.scoutingFilterButton, syncingGames && { opacity: 0.6 }]} 
            onPress={syncPlayerGames}
            disabled={syncingGames}
          >
            <Text style={styles.scoutingFilterButtonText}>
              {syncingGames 
                ? (syncProgress ? `⏳ ${syncProgress.current}/${syncProgress.total}` : '⏳ Lädt...') 
                : '🔄 Aktualisieren'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Toolbar - wie Scouting */}
        <View style={styles.scoutingToolbar}>
          <View style={styles.spieleSearchContainer}>
            <Text style={styles.scoutingSearchIcon}>🔍</Text>
            <TextInput 
              style={styles.scoutingSearchInput} 
              placeholder="Spieler, Verein suchen..." 
              value={gamesSearchText} 
              onChangeText={setGamesSearchText} 
            />
          </View>
          
          <View style={styles.scoutingFilterContainer}>
            {/* Spieler Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity 
                style={[styles.scoutingFilterButton, selectedPlayers.length > 0 && styles.scoutingFilterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); setShowPlayerDropdown(!showPlayerDropdown); setShowResponsibilityDropdown(false); }}
              >
                <Text style={[styles.scoutingFilterButtonText, selectedPlayers.length > 0 && styles.scoutingFilterButtonTextActive]}>
                  {getPlayerFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showPlayerDropdown && (
                <Pressable style={styles.scoutingFilterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.scoutingFilterDropdownHeader}>
                    <Text style={styles.scoutingFilterDropdownTitle}>Spieler wählen</Text>
                    {selectedPlayers.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedPlayers([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availablePlayers.length === 0 ? (
                      <Text style={styles.scoutingNoDataText}>Keine Spieler vorhanden</Text>
                    ) : (
                      availablePlayers.map(player => {
                        const isSelected = selectedPlayers.includes(player.id);
                        const count = playerGames.filter(g => g.player_id === player.id).length;
                        return (
                          <TouchableOpacity key={player.id} style={styles.scoutingFilterCheckboxItem} onPress={() => togglePlayer(player.id)}>
                            <View style={[styles.scoutingCheckbox, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={styles.scoutingFilterCheckboxText}>{player.name}</Text>
                            <Text style={styles.scoutingFilterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={styles.scoutingFilterDoneButton} onPress={() => setShowPlayerDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Zuständigkeit Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity 
                style={[styles.scoutingFilterButton, selectedResponsibilities.length > 0 && styles.scoutingFilterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); setShowResponsibilityDropdown(!showResponsibilityDropdown); setShowPlayerDropdown(false); }}
              >
                <Text style={[styles.scoutingFilterButtonText, selectedResponsibilities.length > 0 && styles.scoutingFilterButtonTextActive]}>
                  {getResponsibilityFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showResponsibilityDropdown && (
                <Pressable style={styles.scoutingFilterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.scoutingFilterDropdownHeader}>
                    <Text style={styles.scoutingFilterDropdownTitle}>Zuständigkeit wählen</Text>
                    {selectedResponsibilities.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedResponsibilities([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableResponsibilities.length === 0 ? (
                      <Text style={styles.scoutingNoDataText}>Keine Spieler vorhanden</Text>
                    ) : (
                      availableResponsibilities.map(resp => {
                        const isSelected = selectedResponsibilities.includes(resp);
                        const count = playerGames.filter(g => g.responsibility === resp).length;
                        return (
                          <TouchableOpacity key={resp} style={styles.scoutingFilterCheckboxItem} onPress={() => toggleResponsibility(resp)}>
                            <View style={[styles.scoutingCheckbox, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={styles.scoutingFilterCheckboxText}>{resp}</Text>
                            <Text style={styles.scoutingFilterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={styles.scoutingFilterDoneButton} onPress={() => setShowResponsibilityDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.scoutingFilterButton} onPress={() => setShowAddGameModal(true)}>
            <Text style={styles.scoutingFilterButtonText}>+ Neues Spiel</Text>
          </TouchableOpacity>
        </View>

        {/* Overlay zum Schließen */}
        {isAnyDropdownOpen && (
          <Pressable style={styles.scoutingDropdownOverlay} onPress={closeAllGameDropdowns} />
        )}

        {/* Tabelle - wie Scouting */}
        <View style={styles.scoutingContent}>
          <View style={styles.scoutingGamesContainer}>
            <View style={styles.scoutingTableHeader}>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Datum</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 2 }]}>Spiel</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Art</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Ort</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Spieler</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Zuständigkeit</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.5 }]}></Text>
            </View>
            <ScrollView>
              {filteredGames.length === 0 ? (
                <View style={styles.scoutingEmptyState}>
                  <Text style={styles.scoutingEmptyText}>Keine Spiele vorhanden</Text>
                  <Text style={[styles.scoutingEmptyText, { marginTop: 8 }]}>Klicke auf "🔄 Aktualisieren" um Spiele von fussball.de zu laden</Text>
                </View>
              ) : (
                filteredGames.map(game => {
                  const homelogo = getClubLogo(game.home_team);
                  const awaylogo = getClubLogo(game.away_team);
                  
                  return (
                    <View key={game.id} style={styles.scoutingTableRow}>
                      <Text style={[styles.scoutingTableCell, { flex: 1 }]}>
                        {new Date(game.date).toLocaleDateString('de-DE')}
                      </Text>
                      <View style={[styles.scoutingTableCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                        {homelogo && <Image source={{ uri: homelogo }} style={styles.scoutingClubLogo} />}
                        <Text style={styles.scoutingMatchText}>{game.home_team} vs {game.away_team}</Text>
                        {awaylogo && <Image source={{ uri: awaylogo }} style={styles.scoutingClubLogo} />}
                      </View>
                      <Text style={[styles.scoutingTableCell, { flex: 1 }]}>{game.game_type || 'Liga'}</Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1 }]}>{game.location || '-'}</Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1, fontWeight: '600' }]}>{game.player_name || '-'}</Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1 }]}>{game.responsibility || '-'}</Text>
                      <TouchableOpacity style={[styles.scoutingTableCell, { flex: 0.5 }]} onPress={() => deletePlayerGame(game.id)}>
                        <Text>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderKalenderPlaceholder = () => (
    <View style={styles.placeholderContainer}>
      <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButtonTop}>
        <Ionicons name="arrow-back" size={20} color="#666" />
      </TouchableOpacity>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderIcon}>📅</Text>
        <Text style={styles.placeholderTitle}>Kalenderansicht</Text>
        <Text style={styles.placeholderText}>Übersichtliche Monatsansicht mit allen Terminen{'\n'}und Export-Funktion.</Text>
        <View style={styles.comingSoonLarge}><Text style={styles.comingSoonLargeText}>COMING SOON</Text></View>
      </View>
    </View>
  );

  const renderAddEditModal = (isEdit: boolean) => {
    const showModal = isEdit ? showEditModal : showAddModal;
    return (
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>
              <View style={styles.formRow}>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Datum *</Text>
                  <TextInput style={styles.formInput} value={formDatum} onChangeText={setFormDatum} placeholder="YYYY-MM-DD" />
                </View>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Datum bis</Text>
                  <TextInput style={styles.formInput} value={formDatumEnde} onChangeText={setFormDatumEnde} placeholder="YYYY-MM-DD" />
                </View>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Zeit</Text>
                  <TextInput style={styles.formInput} value={formZeit} onChangeText={setFormZeit} placeholder="HH:MM" />
                </View>
              </View>
              <Text style={styles.formLabel}>Art *</Text>
              <View style={styles.artSelector}>
                {TERMIN_ARTEN.map((art) => (
                  <TouchableOpacity key={art} style={[styles.artOption, formArt === art && styles.artOptionSelected]} onPress={() => setFormArt(art)}>
                    <Text style={[styles.artOptionText, formArt === art && styles.artOptionTextSelected]}>{art}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Beschreibung *</Text>
              <TextInput style={styles.formInput} value={formTitel} onChangeText={setFormTitel} placeholder="z.B. Lehrgang, Meeting, ..." />
              <Text style={styles.formLabel}>Jahrgang</Text>
              <View style={styles.selectWrapper}>
                <select
                  style={styles.selectInput as any}
                  value={formJahrgang}
                  onChange={(e: any) => setFormJahrgang(e.target.value)}
                >
                  <option value="">- Kein Jahrgang -</option>
                  {JAHRGAENGE.map((jg) => (
                    <option key={jg} value={jg}>{jg}</option>
                  ))}
                </select>
              </View>
              <Text style={styles.formLabel}>Ort</Text>
              <TextInput style={styles.formInput} value={formOrt} onChangeText={setFormOrt} placeholder="z.B. Frankfurt, DFB-Campus..." />
              <Text style={styles.formLabel}>Übernahme durch</Text>
              <View style={styles.selectWrapper}>
                <select
                  style={styles.selectInput as any}
                  value={formUebernahme}
                  onChange={(e: any) => setFormUebernahme(e.target.value)}
                >
                  <option value="">- Keine Auswahl -</option>
                  {advisors.map((adv) => (
                    <option key={adv.id} value={adv.id}>{adv.first_name} {adv.last_name}</option>
                  ))}
                </select>
              </View>
              <View style={styles.modalButtons}>
                {isEdit && (
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTermin}>
                    <Text style={styles.deleteButtonText}>Löschen</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.cancelButton} onPress={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); }}>
                  <Text style={styles.cancelButtonText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={isEdit ? handleUpdateTermin : handleSaveTermin}>
                  <Text style={styles.saveButtonText}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderSyncModal = () => (
    <Modal visible={showSyncModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.syncModalContent}>
          <Text style={styles.modalTitle}>🇩🇪 Termine synchronisieren</Text>
          <Text style={styles.syncDescription}>
            Lädt {getDFBTermineCount()} DFB-Nationalmannschaftstermine und {getHallenTermineCount()} Hallenturniere.{'\n'}
            Bereits vorhandene Termine werden übersprungen.
          </Text>
          <Text style={styles.syncStand}>Stand: {getLastUpdateDisplay()}</Text>
          {syncLoading ? (
            <View style={styles.syncLoadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.syncLoadingText}>Synchronisiere...</Text>
            </View>
          ) : syncResult ? (
            <View style={styles.syncResultContainer}>
              <Text style={styles.syncResultTitle}>✓ Synchronisierung abgeschlossen</Text>
              <Text style={styles.syncResultText}>{syncResult.added} neue Termine hinzugefügt</Text>
              <Text style={styles.syncResultText}>{syncResult.skipped} bereits vorhanden (übersprungen)</Text>
            </View>
          ) : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowSyncModal(false); setSyncResult(null); }}>
              <Text style={styles.cancelButtonText}>{syncResult ? 'Schließen' : 'Abbrechen'}</Text>
            </TouchableOpacity>
            {!syncResult && (
              <TouchableOpacity style={styles.saveButton} onPress={handleDFBSync} disabled={syncLoading}>
                <Text style={styles.saveButtonText}>Jetzt synchronisieren</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'spiele': return renderSpieleUnsererSpieler();
      case 'termine': return renderWeitereTermine();
      case 'kalender': return renderKalenderPlaceholder();
      default: return renderDashboard();
    }
  };

  return (
    <View style={styles.container}>
      <Sidebar navigation={navigation} activeScreen="termine" profile={profile} />
      <View style={styles.mainContent}>
        {viewMode === 'dashboard' && (
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Termine</Text>
              <Text style={styles.headerSubtitle}>Übersicht aller Termine</Text>
            </View>
          </View>
        )}
        {renderContent()}
      </View>
      {renderAddEditModal(false)}
      {renderAddEditModal(true)}
      {renderSyncModal()}
      
      {/* Add Player Game Modal */}
      <Modal visible={showAddGameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neues Spiel hinzufügen</Text>
              <TouchableOpacity onPress={() => setShowAddGameModal(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Datum *</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newGame.date} 
                  onChangeText={(t) => setNewGame({...newGame, date: t})} 
                  placeholder="YYYY-MM-DD" 
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Art</Text>
                <View style={styles.selectWrapper}>
                  <select 
                    style={styles.selectInput as any}
                    value={newGame.game_type}
                    onChange={(e) => setNewGame({...newGame, game_type: e.target.value})}
                  >
                    <option value="Liga">Liga</option>
                    <option value="Pokal">Pokal</option>
                    <option value="Freundschaftsspiel">Freundschaftsspiel</option>
                    <option value="Turnier">Turnier</option>
                  </select>
                </View>
              </View>
            </View>
            
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Heimmannschaft *</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newGame.home_team} 
                  onChangeText={(t) => setNewGame({...newGame, home_team: t})} 
                  placeholder="Heim" 
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Auswärtsmannschaft *</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newGame.away_team} 
                  onChangeText={(t) => setNewGame({...newGame, away_team: t})} 
                  placeholder="Auswärts" 
                />
              </View>
            </View>
            
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Ort</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newGame.location} 
                  onChangeText={(t) => setNewGame({...newGame, location: t})} 
                  placeholder="Spielort" 
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Spieler *</Text>
                <View style={styles.selectWrapper}>
                  <select 
                    style={styles.selectInput as any}
                    value={newGame.player_id}
                    onChange={(e) => setNewGame({...newGame, player_id: e.target.value})}
                  >
                    <option value="">Spieler auswählen...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                    ))}
                  </select>
                </View>
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddGameModal(false)}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addPlayerGame}>
                <Text style={styles.saveButtonText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' },
  mainContent: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  gridContainer: { maxWidth: 1000, width: '100%' },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  card: { borderRadius: 20, overflow: 'hidden', cursor: 'pointer' as any },
  cardHovered: { transform: [{ scale: 1.02 }], shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  lightCardHovered: { backgroundColor: '#f0f0f0', transform: [{ scale: 1.01 }] },
  darkCardHovered: { backgroundColor: '#2a2a2a', transform: [{ scale: 1.02 }] },
  mainCardHovered: { backgroundColor: '#fafafa', transform: [{ scale: 1.005 }] },
  mainCard: { flex: 2, backgroundColor: '#fff', padding: 28, minHeight: 280, borderWidth: 1, borderColor: '#eee' },
  mainCardContent: { flex: 1, flexDirection: 'row' },
  mainCardLeft: { flex: 1, justifyContent: 'space-between' },
  mainCardRight: { width: 120, alignItems: 'center', justifyContent: 'center' },
  mainCardIcon: { fontSize: 80, opacity: 0.15 },
  comingSoonBadge: { backgroundColor: '#fff3cd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  comingSoonBadgeText: { fontSize: 11, fontWeight: '600', color: '#856404', letterSpacing: 0.5 },
  mainCardTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  mainCardSubtitle: { fontSize: 14, color: '#888', lineHeight: 22 },
  mainCardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto' as any, paddingTop: 20 },
  mainCardLink: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  mainCardArrow: { fontSize: 16, marginLeft: 8, color: '#1a1a1a' },
  rightColumn: { flex: 1, gap: 16 },
  termineCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderWidth: 1, borderColor: '#eee', justifyContent: 'space-between' },
  termineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  termineIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  termineIconText: { fontSize: 18 },
  termineCount: { fontSize: 32, fontWeight: '700', color: '#1a1a1a' },
  termineFooter: { marginTop: 'auto' as any },
  termineTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  termineSubtitle: { fontSize: 12, color: '#888', marginTop: 4 },
  kalenderCard: { flex: 1, backgroundColor: '#1a1a1a', padding: 20, position: 'relative', justifyContent: 'space-between' },
  urgentBadge: { position: 'absolute', top: 20, right: 20 },
  urgentBadgeText: { fontSize: 12, fontWeight: '600', color: '#ff6b6b' },
  kalenderIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  kalenderIconText: { fontSize: 18 },
  kalenderFooter: { marginTop: 'auto' as any },
  kalenderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  kalenderSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  listContainer: { flex: 1 },
  listHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { marginRight: 12 },
  backButtonInner: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#f5f5f5', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backButtonTop: { position: 'absolute', top: 20, left: 20 },
  listTitle: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerButtons: { flexDirection: 'row', gap: 12 },
  syncButton: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center' },
  syncButtonText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  syncButtonSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  addButton: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  
  // Info Banner - grau
  dfbBanner: { backgroundColor: '#e9ecef', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#dee2e6' },
  dfbBannerText: { fontSize: 13, color: '#495057', fontWeight: '500', textAlign: 'center' },

  // Table styles - schwarzer Header
  tableHeader: { flexDirection: 'row', backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 16 },
  tableHeaderText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sortableHeader: { cursor: 'pointer' as any },
  tableBody: { flex: 1, backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  tableRowPast: { backgroundColor: '#fafafa' },
  tableRowToday: { backgroundColor: '#e9ecef' },
  tableCell: { fontSize: 14, color: '#333' },
  cellPast: { color: '#999' },
  colDatum: { flex: 1, minWidth: 90 },
  colZeit: { flex: 0.6, minWidth: 50 },
  colArt: { flex: 1.3, minWidth: 120 },
  colTitel: { flex: 2, minWidth: 150, marginLeft: 8 },
  colJahrgang: { flex: 0.6, minWidth: 55 },
  colOrt: { flex: 1.1, minWidth: 90 },
  colUebernahme: { flex: 1.1, minWidth: 90 },
  
  // Art Badges
  artBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  artBadgePast: { opacity: 0.6 },
  artBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  // Nationalmannschaft - hellrot
  artNationalmannschaft: { backgroundColor: '#f8d7da' },
  artNationalmannschaftText: { color: '#721c24' },
  
  // Hallenturnier - hellblau
  artHallenturnier: { backgroundColor: '#d1ecf1' },
  artHallenturnierText: { color: '#0c5460' },
  
  // Sonstige
  artSonstige: { backgroundColor: '#6c757d' },
  
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16, marginBottom: 16 },
  emptyDfbButton: { backgroundColor: '#e9ecef', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  emptyDfbButtonText: { color: '#495057', fontWeight: '600', fontSize: 14 },
  placeholderContainer: { flex: 1, position: 'relative' },
  placeholderContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderIcon: { fontSize: 80, marginBottom: 20 },
  placeholderTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  placeholderText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  comingSoonLarge: { backgroundColor: '#fff3cd', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, marginTop: 30 },
  comingSoonLargeText: { fontSize: 16, fontWeight: '600', color: '#856404' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600 },
  syncModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 450 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  syncDescription: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  syncStand: { fontSize: 12, color: '#999', marginBottom: 20 },
  syncLoadingContainer: { alignItems: 'center', paddingVertical: 20 },
  syncLoadingText: { marginTop: 12, color: '#666' },
  syncResultContainer: { backgroundColor: '#d4edda', padding: 16, borderRadius: 10, marginBottom: 20 },
  syncResultTitle: { fontSize: 16, fontWeight: '600', color: '#155724', marginBottom: 8 },
  syncResultText: { fontSize: 14, color: '#155724' },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  formHalf: { flex: 1 },
  formThird: { flex: 1 },
  formLabel: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 12 },
  formInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  selectWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  selectInput: { padding: 12, fontSize: 15, border: 'none', width: '100%', backgroundColor: '#fff' },
  artSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  artOption: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  artOptionSelected: { backgroundColor: '#000', borderColor: '#000' },
  artOptionText: { fontSize: 13, color: '#333' },
  artOptionTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 24, gap: 8 },
  deleteButton: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  deleteButtonText: { color: '#ff4444', fontWeight: '600' },
  cancelButton: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  
  // Scouting-Style für Spiele unserer Spieler
  scoutingMainContent: { flex: 1, backgroundColor: '#f8fafc' },
  scoutingHeaderBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scoutingHeaderBannerCenter: { alignItems: 'center', flex: 1 },
  scoutingTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  scoutingSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  scoutingToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 100 },
  scoutingSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, flex: 1, maxWidth: 300 },
  spieleSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, flex: 1, maxWidth: 500 },
  scoutingSearchIcon: { fontSize: 16, marginRight: 8 },
  scoutingSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, outlineStyle: 'none' as any },
  scoutingFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 },
  scoutingDropdownContainer: { position: 'relative' as any },
  scoutingFilterButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  scoutingFilterButtonActive: { backgroundColor: '#e0f2fe', borderColor: '#3b82f6' },
  scoutingFilterButtonText: { fontSize: 14, color: '#64748b' },
  scoutingFilterButtonTextActive: { color: '#0369a1' },
  scoutingFilterDropdownMulti: { position: 'absolute' as any, top: '100%', left: 0, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, minWidth: 220, marginTop: 4, zIndex: 1001, borderWidth: 1, borderColor: '#e5e7eb' },
  scoutingFilterDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  scoutingFilterDropdownTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  scoutingFilterClearText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
  scoutingFilterCheckboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  scoutingCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  scoutingCheckboxSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  scoutingCheckmark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scoutingFilterCheckboxText: { flex: 1, fontSize: 14, color: '#333' },
  scoutingFilterCountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, color: '#64748b' },
  scoutingFilterDoneButton: { padding: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  scoutingFilterDoneText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  scoutingNoDataText: { padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  scoutingDropdownOverlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  scoutingContent: { flex: 1, padding: 16 },
  scoutingGamesContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  scoutingTableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scoutingTableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any },
  scoutingTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  scoutingTableCell: { fontSize: 14, color: '#1a1a1a' },
  scoutingClubLogo: { width: 24, height: 24, resizeMode: 'contain' as any, marginHorizontal: 4 },
  scoutingMatchText: { fontWeight: '500' },
  scoutingEmptyState: { padding: 40, alignItems: 'center' },
  scoutingEmptyText: { fontSize: 14, color: '#94a3b8' },
  
  // Weitere Termine Styles
  termineHeaderButtons: { flexDirection: 'row', gap: 8 },
  termineTableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  termineTableHeaderText: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any },
  termineTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  termineTableRowPast: { backgroundColor: '#fafafa' },
  termineTableRowToday: { backgroundColor: '#f0fdf4' },
  termineTableCell: { fontSize: 14, color: '#1a1a1a' },
  termineCellPast: { color: '#94a3b8' },
  termineColDatum: { flex: 1, minWidth: 90 },
  termineColZeit: { flex: 0.6, minWidth: 50 },
  termineColArt: { flex: 1.3, minWidth: 120 },
  termineColTitel: { flex: 2, minWidth: 150 },
  termineColJahrgang: { flex: 0.6, minWidth: 55 },
  termineColOrt: { flex: 1.1, minWidth: 90 },
  termineColUebernahme: { flex: 1.1, minWidth: 90 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { fontSize: 16, color: '#64748b' },
});
