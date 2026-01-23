import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Platform, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTheme } from '../../contexts/ThemeContext';

const TRANSFER_STATUS = [
  { id: 'ideen', label: 'IDEEN', color: '#64748b' },
  { id: 'offen', label: 'OFFEN / INTERESSE', color: '#3b82f6' },
  { id: 'absage', label: 'ABSAGE', color: '#ef4444' },
];

const POSITION_FULL: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linksaußen',
  'RA': 'Rechtsaußen',
  'ST': 'Stürmer',
  'Torwart': 'Torwart',
  'Innenverteidiger': 'Innenverteidiger',
  'Linker Verteidiger': 'Linker Verteidiger',
  'Rechter Verteidiger': 'Rechter Verteidiger',
  'Defensives Mittelfeld': 'Defensives Mittelfeld',
  'Zentrales Mittelfeld': 'Zentrales Mittelfeld',
  'Offensives Mittelfeld': 'Offensives Mittelfeld',
  'Linksaußen': 'Linksaußen',
  'Rechtsaußen': 'Rechtsaußen',
  'Stürmer': 'Stürmer',
};

const getFullPosition = (pos: string): string => {
  if (!pos) return '-';
  const positions = pos.split(',').map(p => p.trim());
  return positions.map(p => POSITION_FULL[p] || p).join(', ');
};

const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const getDaysUntilReminder = (createdAt: string, reminderDays: number | null): number | null => {
  if (reminderDays === null || reminderDays === undefined || reminderDays < 0) return null;
  const created = new Date(createdAt);
  const reminderDate = new Date(created);
  reminderDate.setDate(reminderDate.getDate() + reminderDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reminderDate.setHours(0, 0, 0, 0);
  const diff = reminderDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

interface TransferClub {
  id: string;
  player_id: string;
  club_name: string;
  status: string;
  advisor_name: string;
  last_contact: string;
  notes: string;
  reminder_days: number;
  created_at: string;
  updated_at: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  birth_date: string;
  club: string;
  contract_end: string;
  photo_url: string;
  responsibility: string;
}

interface ClubLogo {
  club_name: string;
  logo_url: string;
}

type ViewMode = 'kanban' | 'liste';

type MobileTab = 'ideen' | 'offen' | 'absage';

export function TransferDetailScreen({ route, navigation }: any) {
  const { playerId, highlightClub } = route.params;
  const isMobile = useIsMobile();
  const { colors, isDark } = useTheme();
  const [player, setPlayer] = useState<Player | null>(null);
  const [clubs, setClubs] = useState<TransferClub[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [allClubNames, setAllClubNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [mobileTab, setMobileTab] = useState<MobileTab>('ideen');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState<TransferClub | null>(null);
  
  // Form states
  const [clubSearch, setClubSearch] = useState('');
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    club_name: '',
    status: 'ideen',
    advisor_name: '',
    last_contact: '',
    notes: '',
    reminder_days: 30,
  });
  
  // Date picker states
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  
  // Reminder options
  const REMINDER_OPTIONS = [
    { value: -1, label: 'Keine Erinnerung' },
    { value: 0, label: 'Heute' },
    ...Array.from({ length: 60 }, (_, i) => ({ 
      value: i + 1, 
      label: `${i + 1} ${i + 1 === 1 ? 'Tag' : 'Tage'}` 
    }))
  ];
  
  // Date constants
  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const currentYear = new Date().getFullYear();
  // Jahre von aktuellem Jahr bis 2070, plus 10 Jahre zurück
  const YEARS = [
    ...Array.from({ length: 2070 - currentYear + 1 }, (_, i) => currentYear + i),
    ...Array.from({ length: 10 }, (_, i) => currentYear - i - 1)
  ].sort((a, b) => a - b);
  
  // Drag state for web
  const [draggedClub, setDraggedClub] = useState<TransferClub | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayer();
    fetchClubs();
    fetchClubLogos();
  }, []);

  // Auto-switch to correct tab when highlightClub is provided
  useEffect(() => {
    if (highlightClub && clubs.length > 0) {
      const club = clubs.find(c => c.club_name === highlightClub);
      if (club) {
        setMobileTab(club.status as MobileTab);
      }
    }
  }, [highlightClub, clubs]);

  const fetchPlayer = async () => {
    const { data } = await supabase
      .from('player_details')
      .select('id, first_name, last_name, position, birth_date, club, contract_end, photo_url, responsibility')
      .eq('id', playerId)
      .single();
    if (data) setPlayer(data);
  };

  const fetchClubs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transfer_clubs')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (data) setClubs(data);
    setLoading(false);
  };

  const fetchClubLogos = async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logoMap: Record<string, string> = {};
      const names: string[] = [];
      data.forEach((item: ClubLogo) => {
        logoMap[item.club_name] = item.logo_url;
        names.push(item.club_name);
      });
      setClubLogos(logoMap);
      setAllClubNames(names.sort());
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    if (clubLogos[clubName]) return clubLogos[clubName];
    for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || 
          logoClub.toLowerCase().includes(clubName.toLowerCase())) {
        return logoUrl;
      }
    }
    return null;
  };

  const getFilteredClubNames = (search: string): string[] => {
    if (!search || search.length < 2) return [];
    return allClubNames.filter(c => c.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    // Parse YYYY-MM-DD direkt ohne Timezone-Probleme
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parts[2].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[0];
      return `${day}.${month}.${year}`;
    }
    return '-';
  };

  const parseDateToParts = (dateStr: string): { day: number; month: number; year: number } | null => {
    if (!dateStr) return null;
    // Parse YYYY-MM-DD direkt
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-basiert für Konsistenz
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { day, month, year };
  };

  const buildDateFromParts = (day: number, month: number, year: number): string => {
    // month ist 0-basiert (0=Januar, 11=Dezember)
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const closeAllDropdowns = () => {
    setShowDayPicker(false);
    setShowMonthPicker(false);
    setShowYearPicker(false);
    setShowClubSuggestions(false);
    setShowReminderPicker(false);
  };

  const addClub = async () => {
    if (!formData.club_name.trim()) return;
    
    const { error } = await supabase.from('transfer_clubs').insert({
      player_id: playerId,
      club_name: formData.club_name,
      status: formData.status,
      advisor_name: formData.advisor_name,
      last_contact: formData.last_contact || null,
      notes: formData.notes,
      reminder_days: formData.reminder_days === -1 ? null : formData.reminder_days,
    });
    
    if (!error) {
      setShowAddModal(false);
      resetForm();
      fetchClubs();
    }
  };

  const updateClub = async () => {
    if (!selectedClub) return;
    
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('transfer_clubs')
      .update({
        club_name: formData.club_name,
        status: formData.status,
        advisor_name: formData.advisor_name,
        last_contact: formData.last_contact || null,
        notes: formData.notes,
        reminder_days: formData.reminder_days === -1 ? null : formData.reminder_days,
        updated_at: now,
        // Wenn reminder_days geändert wurde, setze created_at auf jetzt damit die Berechnung stimmt
        ...(selectedClub.reminder_days !== formData.reminder_days ? { created_at: now } : {}),
      })
      .eq('id', selectedClub.id);
    
    if (!error) {
      setShowEditModal(false);
      setSelectedClub(null);
      resetForm();
      fetchClubs();
    }
  };

  const deleteClub = async (clubId: string) => {
    await supabase.from('transfer_clubs').delete().eq('id', clubId);
    fetchClubs();
    setShowEditModal(false);
    setSelectedClub(null);
  };

  const updateClubStatus = async (clubId: string, newStatus: string) => {
    await supabase
      .from('transfer_clubs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', clubId);
    fetchClubs();
  };

  const resetForm = () => {
    setFormData({
      club_name: '',
      status: 'ideen',
      advisor_name: '',
      last_contact: '',
      notes: '',
      reminder_days: 30,
    });
    setClubSearch('');
    closeAllDropdowns();
  };

  const openEditModal = (club: TransferClub) => {
    setSelectedClub(club);
    setFormData({
      club_name: club.club_name,
      status: club.status,
      advisor_name: club.advisor_name || '',
      last_contact: club.last_contact || '',
      notes: club.notes || '',
      reminder_days: club.reminder_days === null || club.reminder_days === undefined ? -1 : club.reminder_days,
    });
    setClubSearch(club.club_name);
    closeAllDropdowns();
    setShowEditModal(true);
  };

  // Drag & Drop handlers for web
  const handleDragStart = (club: TransferClub) => {
    setDraggedClub(club);
  };

  const handleDragOver = (e: any, statusId: string) => {
    e.preventDefault();
    setDropTarget(statusId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: any, newStatus: string) => {
    e.preventDefault();
    if (draggedClub && draggedClub.status !== newStatus) {
      updateClubStatus(draggedClub.id, newStatus);
    }
    setDraggedClub(null);
    setDropTarget(null);
  };

  const getClubsByStatus = (statusId: string): TransferClub[] => {
    return clubs
      .filter(c => c.status === statusId)
      .sort((a, b) => {
        const daysA = getDaysUntilReminder(a.created_at, a.reminder_days);
        const daysB = getDaysUntilReminder(b.created_at, b.reminder_days);

        // Beide haben Erinnerung -> nach Tagen sortieren (nächste zuerst)
        if (daysA !== null && daysB !== null) {
          if (daysA !== daysB) return daysA - daysB;
          // Gleiche Tage -> alphabetisch
          return a.club_name.localeCompare(b.club_name, 'de');
        }

        // Nur A hat Erinnerung -> A zuerst
        if (daysA !== null) return -1;

        // Nur B hat Erinnerung -> B zuerst
        if (daysB !== null) return 1;

        // Keine Erinnerung -> alphabetisch
        return a.club_name.localeCompare(b.club_name, 'de');
      });
  };

  const renderClubCard = (club: TransferClub) => {
    const logo = getClubLogo(club.club_name);
    const isHighlighted = highlightClub && club.club_name === highlightClub;
    const daysUntil = getDaysUntilReminder(club.created_at, club.reminder_days);
    
    const renderReminderBadge = () => {
      if (daysUntil === null) return null;
      if (daysUntil < 0) {
        return (
          <View style={styles.reminderBadgeOverdue}>
            <Text style={styles.reminderBadgeOverdueText}>vor {Math.abs(daysUntil)} {Math.abs(daysUntil) === 1 ? 'Tag' : 'Tagen'}</Text>
          </View>
        );
      }
      if (daysUntil === 0) {
        return (
          <View style={styles.reminderBadgeToday}>
            <Text style={styles.reminderBadgeTodayText}>Heute</Text>
          </View>
        );
      }
      return (
        <View style={styles.reminderBadge}>
          <Text style={styles.reminderBadgeText}>in {daysUntil} {daysUntil === 1 ? 'Tag' : 'Tagen'}</Text>
        </View>
      );
    };
    
    if (Platform.OS === 'web') {
      return (
        <div
          key={club.id}
          draggable
          onDragStart={() => handleDragStart(club)}
          onDragEnd={() => { setDraggedClub(null); setDropTarget(null); }}
          style={{
            cursor: 'grab',
            opacity: draggedClub?.id === club.id ? 0.5 : 1,
          }}
        >
          <TouchableOpacity style={[styles.clubCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, isHighlighted && styles.clubCardHighlighted]} onPress={() => openEditModal(club)}>
            {renderReminderBadge()}
            <View style={styles.clubCardHeader}>
              {logo && (
                <Image source={{ uri: logo }} style={styles.clubLogo} />
              )}
              <Text style={[styles.clubName, { color: colors.text }]}>{club.club_name}</Text>
            </View>
            {club.advisor_name && (
              <View style={styles.clubCardRow}>
                <Text style={styles.clubCardIcon}>👤</Text>
                <Text style={[styles.clubCardText, { color: colors.textSecondary }]}>{club.advisor_name}</Text>
              </View>
            )}
            {club.last_contact && (
              <View style={styles.clubCardRow}>
                <Text style={styles.clubCardIcon}>🕐</Text>
                <Text style={[styles.clubCardText, { color: colors.textSecondary }]}>Letzter Kontakt: {formatDate(club.last_contact)}</Text>
              </View>
            )}
            {club.notes && (
              <Text style={[styles.clubNotes, { color: colors.textSecondary, borderTopColor: colors.border }]}>"{club.notes}"</Text>
            )}
          </TouchableOpacity>
        </div>
      );
    }

    return (
      <TouchableOpacity key={club.id} style={[styles.clubCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, isHighlighted && styles.clubCardHighlighted]} onPress={() => openEditModal(club)}>
        {renderReminderBadge()}
        <View style={styles.clubCardHeader}>
          {logo && (
            <Image source={{ uri: logo }} style={styles.clubLogo} />
          )}
          <Text style={[styles.clubName, { color: colors.text }]}>{club.club_name}</Text>
        </View>
        {club.advisor_name && (
          <View style={styles.clubCardRow}>
            <Text style={styles.clubCardIcon}>👤</Text>
            <Text style={[styles.clubCardText, { color: colors.textSecondary }]}>{club.advisor_name}</Text>
          </View>
        )}
        {club.last_contact && (
          <View style={styles.clubCardRow}>
            <Text style={styles.clubCardIcon}>🕐</Text>
            <Text style={[styles.clubCardText, { color: colors.textSecondary }]}>Letzter Kontakt: {formatDate(club.last_contact)}</Text>
          </View>
        )}
        {club.notes && (
          <Text style={[styles.clubNotes, { color: colors.textSecondary, borderTopColor: colors.border }]}>"{club.notes}"</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderKanbanColumn = (status: typeof TRANSFER_STATUS[0]) => {
    const columnClubs = getClubsByStatus(status.id);
    const isDropTarget = dropTarget === status.id;

    if (Platform.OS === 'web') {
      return (
        <div
          key={status.id}
          onDragOver={(e) => handleDragOver(e, status.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status.id)}
          style={{
            flex: 1,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: 10,
            padding: 10,
            border: isDropTarget ? '2px dashed #3b82f6' : `1px solid ${colors.border}`,
            transition: 'background-color 0.2s',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <View style={styles.kanbanHeader}>
            <Text style={[styles.kanbanTitle, { color: colors.textSecondary }]}>{status.label}</Text>
            <View style={[styles.countBadge, { backgroundColor: status.color }]}>
              <Text style={styles.countText}>{columnClubs.length}</Text>
            </View>
          </View>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {columnClubs.length === 0 ? (
              <Text style={[styles.emptyColumn, { color: colors.textMuted }]}>Leer</Text>
            ) : (
              columnClubs.map(club => renderClubCard(club))
            )}
          </div>
        </div>
      );
    }

    return (
      <View key={status.id} style={[styles.kanbanColumn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isDropTarget && styles.kanbanColumnDropTarget]}>
        <View style={styles.kanbanHeader}>
          <Text style={[styles.kanbanTitle, { color: colors.textSecondary }]}>{status.label}</Text>
          <View style={[styles.countBadge, { backgroundColor: status.color }]}>
            <Text style={styles.countText}>{columnClubs.length}</Text>
          </View>
        </View>
        <ScrollView style={styles.kanbanContent} showsVerticalScrollIndicator={false}>
          {columnClubs.length === 0 ? (
            <Text style={[styles.emptyColumn, { color: colors.textMuted }]}>Leer</Text>
          ) : (
            columnClubs.map(club => renderClubCard(club))
          )}
        </ScrollView>
      </View>
    );
  };

  const renderListView = () => (
    <View style={[styles.tableContainer, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
        <Text style={[styles.tableHeaderCell, { flex: 2, color: colors.textSecondary }]}>Verein</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.2, color: colors.textSecondary }]}>Ansprechpartner</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, color: colors.textSecondary }]}>Letzter Kontakt</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, color: colors.textSecondary }]}>Status</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2, color: colors.textSecondary }]}>Notiz</Text>
      </View>
      <ScrollView>
        {clubs.map(club => (
          <TouchableOpacity key={club.id} style={[styles.tableRow, { borderBottomColor: colors.border }]} onPress={() => openEditModal(club)}>
            <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
              {getClubLogo(club.club_name) && (
                <Image source={{ uri: getClubLogo(club.club_name)! }} style={styles.tableLogo} />
              )}
              <Text style={[styles.tableCellText, { color: colors.text }]}>{club.club_name}</Text>
            </View>
            <Text style={[styles.tableCell, { flex: 1.2, color: colors.text }]}>{club.advisor_name || '-'}</Text>
            <Text style={[styles.tableCell, { flex: 1, color: colors.text }]}>{club.last_contact ? formatDate(club.last_contact) : '-'}</Text>
            <View style={[styles.tableCell, { flex: 1 }]}>
              <View style={[styles.statusBadge, { backgroundColor: TRANSFER_STATUS.find(s => s.id === club.status)?.color }]}>
                <Text style={styles.statusBadgeText}>{TRANSFER_STATUS.find(s => s.id === club.status)?.label}</Text>
              </View>
            </View>
            <Text style={[styles.tableCell, { flex: 2, color: colors.text }]} numberOfLines={1}>{club.notes || '-'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderForm = () => {
    const filteredClubs = getFilteredClubNames(clubSearch);
    
    // Parse existing date direkt aus String
    const dateParts = parseDateToParts(formData.last_contact);
    const displayDay = dateParts?.day ?? null;
    const displayMonth = dateParts?.month ?? null;
    const displayYear = dateParts?.year ?? null;
    
    // For building new dates, use current values or sensible defaults
    const buildDay = displayDay ?? 1;
    const buildMonth = displayMonth ?? new Date().getMonth();
    const buildYear = displayYear ?? currentYear;
    
    const updateDatePart = (part: 'day' | 'month' | 'year', value: number) => {
      let newDay = buildDay;
      let newMonth = buildMonth;
      let newYear = buildYear;
      
      if (part === 'day') newDay = value;
      if (part === 'month') newMonth = value;
      if (part === 'year') newYear = value;
      
      // Ensure day is valid for the month (month ist 0-basiert)
      const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
      if (newDay > maxDays) newDay = maxDays;
      
      setFormData({ ...formData, last_contact: buildDateFromParts(newDay, newMonth, newYear) });
    };
    
    return (
      <Pressable onPress={() => closeAllDropdowns()}>
        <View style={[styles.formRow, { zIndex: 300 }]}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Verein *</Text>
          <View style={styles.autocompleteContainer}>
            <TouchableOpacity
              style={[styles.clubDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
              onPress={() => { closeAllDropdowns(); setShowClubSuggestions(!showClubSuggestions); }}
            >
              <Text style={[styles.clubDropdownText, { color: colors.text }, !formData.club_name && { color: colors.textMuted }]}>
                {formData.club_name || 'Verein auswählen...'}
              </Text>
              <Text style={[styles.clubDropdownArrow, { color: colors.textSecondary }]}>▼</Text>
            </TouchableOpacity>
            {showClubSuggestions && (
              <Pressable style={[styles.clubSuggestionsList, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
                <TextInput
                  style={[styles.clubSearchInput, { backgroundColor: colors.inputBackground, borderBottomColor: colors.border, color: colors.text }]}
                  value={clubSearch}
                  onChangeText={(text) => {
                    setClubSearch(text);
                  }}
                  placeholder="Suchen oder eigenen Namen eingeben..."
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <ScrollView style={styles.clubSuggestionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {/* Option für eigenen Namen wenn Text eingegeben */}
                  {clubSearch.length >= 2 && !allClubNames.some(n => n.toLowerCase() === clubSearch.toLowerCase()) && (
                    <TouchableOpacity
                      style={[styles.clubSuggestionItem, styles.clubSuggestionItemCustom, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setFormData({ ...formData, club_name: clubSearch });
                        setClubSearch('');
                        setShowClubSuggestions(false);
                      }}
                    >
                      <Text style={styles.clubSuggestionTextCustom}>"{clubSearch}" verwenden</Text>
                    </TouchableOpacity>
                  )}
                  {(clubSearch.length >= 2 ? filteredClubs : allClubNames.slice(0, 15)).map(name => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.clubSuggestionItem, { borderBottomColor: colors.border }, formData.club_name === name && styles.clubSuggestionItemSelected]}
                      onPress={() => {
                        setFormData({ ...formData, club_name: name });
                        setClubSearch('');
                        setShowClubSuggestions(false);
                      }}
                    >
                      <Text style={[styles.clubSuggestionText, { color: colors.text }, formData.club_name === name && styles.clubSuggestionTextSelected]}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Status</Text>
          <View style={styles.statusSelector}>
            {TRANSFER_STATUS.map(status => (
              <TouchableOpacity
                key={status.id}
                style={[styles.statusOption, { backgroundColor: colors.surfaceSecondary }, formData.status === status.id && { backgroundColor: status.color }]}
                onPress={() => { setFormData({ ...formData, status: status.id }); closeAllDropdowns(); }}
              >
                <Text style={[styles.statusOptionText, { color: colors.textSecondary }, formData.status === status.id && { color: '#fff' }]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ansprechpartner</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
            value={formData.advisor_name}
            onChangeText={(text) => setFormData({ ...formData, advisor_name: text })}
            onFocus={() => closeAllDropdowns()}
            placeholder="z.B. Sportdirektor Max Müller"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={[styles.formRow, { zIndex: 200 }]}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Letzter Kontakt</Text>
          <View style={styles.datePickerRow}>
            {/* Day Picker */}
            <View style={[styles.datePickerFieldSmall, { zIndex: showDayPicker ? 210 : 1 }]}>
              <TouchableOpacity
                style={[styles.dateDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => { closeAllDropdowns(); setShowDayPicker(!showDayPicker); }}
              >
                <Text style={[styles.dateDropdownText, { color: colors.text }, !displayDay && { color: colors.textMuted }]}>{displayDay || 'Tag'}</Text>
                <Text style={[styles.dateDropdownArrow, { color: colors.textSecondary }]}>▼</Text>
              </TouchableOpacity>
              {showDayPicker && (
                <View style={[styles.datePickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {DAYS.map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.datePickerItem, { borderBottomColor: colors.border }, displayDay === d && styles.datePickerItemSelected]}
                        onPress={() => {
                          updateDatePart('day', d);
                          setShowDayPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, { color: colors.text }, displayDay === d && styles.datePickerItemTextSelected]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Month Picker */}
            <View style={[styles.datePickerFieldMedium, { zIndex: showMonthPicker ? 210 : 1 }]}>
              <TouchableOpacity
                style={[styles.dateDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => { closeAllDropdowns(); setShowMonthPicker(!showMonthPicker); }}
              >
                <Text style={[styles.dateDropdownText, { color: colors.text }, displayMonth === null && { color: colors.textMuted }]}>{displayMonth !== null ? MONTHS[displayMonth] : 'Monat'}</Text>
                <Text style={[styles.dateDropdownArrow, { color: colors.textSecondary }]}>▼</Text>
              </TouchableOpacity>
              {showMonthPicker && (
                <View style={[styles.datePickerList, { minWidth: 110, backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {MONTHS.map((m, idx) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.datePickerItem, { borderBottomColor: colors.border }, displayMonth === idx && styles.datePickerItemSelected]}
                        onPress={() => {
                          updateDatePart('month', idx);
                          setShowMonthPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, { color: colors.text }, displayMonth === idx && styles.datePickerItemTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Year Picker */}
            <View style={[styles.datePickerFieldSmall, { zIndex: showYearPicker ? 210 : 1 }]}>
              <TouchableOpacity
                style={[styles.dateDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => { closeAllDropdowns(); setShowYearPicker(!showYearPicker); }}
              >
                <Text style={[styles.dateDropdownText, { color: colors.text }, !displayYear && { color: colors.textMuted }]}>{displayYear || 'Jahr'}</Text>
                <Text style={[styles.dateDropdownArrow, { color: colors.textSecondary }]}>▼</Text>
              </TouchableOpacity>
              {showYearPicker && (
                <View style={[styles.datePickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {YEARS.map((y) => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.datePickerItem, { borderBottomColor: colors.border }, displayYear === y && styles.datePickerItemSelected]}
                        onPress={() => {
                          updateDatePart('year', y);
                          setShowYearPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, { color: colors.text }, displayYear === y && styles.datePickerItemTextSelected]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.formRow, { zIndex: 50 }]}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Erinnerung in</Text>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={[styles.reminderDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
              onPress={() => {
                setShowReminderPicker(!showReminderPicker);
                setShowDayPicker(false);
                setShowMonthPicker(false);
                setShowYearPicker(false);
                setShowClubSuggestions(false);
              }}
            >
              <Text style={[styles.reminderDropdownText, { color: colors.text }]}>
                {formData.reminder_days === -1
                  ? 'Keine Erinnerung'
                  : formData.reminder_days === 0
                    ? 'Heute'
                    : `${formData.reminder_days} Tage`
                }
              </Text>
              <Text style={{ color: colors.textSecondary }}>▼</Text>
            </TouchableOpacity>
            {showReminderPicker && (
              <View style={[styles.reminderDropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {REMINDER_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.reminderDropdownItem,
                        { borderBottomColor: colors.border },
                        formData.reminder_days === option.value && styles.reminderDropdownItemSelected
                      ]}
                      onPress={() => {
                        setFormData({ ...formData, reminder_days: option.value });
                        setShowReminderPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.reminderDropdownItemText,
                        { color: colors.text },
                        formData.reminder_days === option.value && styles.reminderDropdownItemTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notizen</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            onFocus={() => closeAllDropdowns()}
            placeholder="z.B. Interesse hinterlegt beim Sportdirektor"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>
      </Pressable>
    );
  };

  if (!player) {
    if (isMobile) {
      return (
        <SafeAreaView style={[styles.mobileContainer, { backgroundColor: colors.background }]}>
          <View style={styles.mobileLoadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <View style={styles.modalOverlayContainer}>
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
        </View>
      </View>
    );
  }

  const playerClubLogo = getClubLogo(player.club);

  // Mobile Club Card
  const renderMobileClubCard = (club: TransferClub) => {
    const logo = getClubLogo(club.club_name);
    const daysUntil = getDaysUntilReminder(club.created_at, club.reminder_days);
    const isHighlighted = highlightClub && club.club_name === highlightClub;

    return (
      <TouchableOpacity
        key={club.id}
        style={[styles.mobileClubCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, isHighlighted && styles.mobileClubCardHighlighted]}
        onPress={() => openEditModal(club)}
      >
        <View style={styles.mobileClubCardHeader}>
          {logo && <Image source={{ uri: logo }} style={styles.mobileClubLogo} />}
          <View style={styles.mobileClubCardInfo}>
            <Text style={[styles.mobileClubName, { color: colors.text }]}>{club.club_name}</Text>
            {club.advisor_name && (
              <Text style={[styles.mobileClubAdvisor, { color: colors.textSecondary }]}>👤 {club.advisor_name}</Text>
            )}
          </View>
          {daysUntil !== null && (
            <View style={[
              styles.mobileReminderBadge,
              daysUntil < 0 && styles.mobileReminderOverdue,
              daysUntil === 0 && styles.mobileReminderToday,
            ]}>
              <Text style={[
                styles.mobileReminderText,
                daysUntil < 0 && styles.mobileReminderTextOverdue,
                daysUntil === 0 && styles.mobileReminderTextToday,
              ]}>
                {daysUntil < 0 ? `vor ${Math.abs(daysUntil)}d` : daysUntil === 0 ? 'Heute' : `in ${daysUntil}d`}
              </Text>
            </View>
          )}
        </View>
        {club.last_contact && (
          <Text style={[styles.mobileClubContact, { color: colors.textSecondary }]}>🕐 Letzter Kontakt: {formatDate(club.last_contact)}</Text>
        )}
        {club.notes && (
          <Text style={[styles.mobileClubNotes, { color: colors.textSecondary, borderTopColor: colors.border }]} numberOfLines={2}>"{club.notes}"</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Mobile View
  if (isMobile) {
    const mobileClubs = getClubsByStatus(mobileTab);

    return (
      <View style={styles.mobileScreenOverlay}>
        <View style={[styles.mobileScreenContent, { backgroundColor: colors.background }]}>
          {/* Mobile Header */}
          <View style={[styles.mobileScreenHeader, { backgroundColor: colors.surface }]}>
            <Text style={[styles.mobileScreenTitle, { color: colors.text }]}>{player.first_name} {player.last_name}</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[styles.mobileScreenClose, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.mobileScreenSubtitle, { color: colors.textSecondary, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>{calculateAge(player.birth_date)} Jahre • {getFullPosition(player.position)}</Text>

        {/* Tabs */}
        <View style={[styles.mobileTabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {TRANSFER_STATUS.map(status => {
            const count = getClubsByStatus(status.id).length;
            const isActive = mobileTab === status.id;
            return (
              <TouchableOpacity
                key={status.id}
                style={[styles.mobileTab, isActive && [styles.mobileTabActive, { borderBottomColor: colors.primary }]]}
                onPress={() => setMobileTab(status.id as MobileTab)}
              >
                <Text style={[styles.mobileTabText, { color: colors.textSecondary }, isActive && [styles.mobileTabTextActive, { color: colors.text }]]}>
                  {status.id === 'offen' ? 'Offen' : status.label}
                </Text>
                <View style={[styles.mobileTabBadge, { backgroundColor: isActive ? status.color : colors.surfaceSecondary }]}>
                  <Text style={[styles.mobileTabBadgeText, !isActive && { color: colors.textSecondary }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView style={[styles.mobileContent, { backgroundColor: colors.background }]} contentContainerStyle={styles.mobileContentContainer}>
          {mobileClubs.length === 0 ? (
            <View style={styles.mobileEmptyState}>
              <Text style={[styles.mobileEmptyText, { color: colors.textMuted }]}>Keine Vereine in dieser Kategorie</Text>
            </View>
          ) : (
            mobileClubs.map(club => renderMobileClubCard(club))
          )}
        </ScrollView>

        {/* Add Button */}
        <TouchableOpacity
          style={[styles.mobileAddButton, { backgroundColor: colors.primary }]}
          onPress={() => { resetForm(); setFormData({ ...formData, status: mobileTab }); setShowAddModal(true); }}
        >
          <Ionicons name="add" size={24} color={colors.primaryText} />
        </TouchableOpacity>

        {/* Add Modal - same as desktop */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.mobileModalOverlay}>
            <View style={[styles.mobileModalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileModalTitle, { color: colors.text }]}>Neuen Verein anlegen</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobileModalScroll}>
                {renderForm()}
              </ScrollView>
              <View style={[styles.mobileModalButtons, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={[styles.mobileModalCancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowAddModal(false)}>
                  <Text style={[styles.mobileModalCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mobileModalSaveButton, { backgroundColor: colors.primary }]} onPress={addClub}>
                  <Text style={[styles.mobileModalSaveText, { color: colors.primaryText }]}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Modal - same as desktop */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.mobileModalOverlay}>
            <View style={[styles.mobileModalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileModalTitle, { color: colors.text }]}>Verein bearbeiten</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobileModalScroll}>
                {renderForm()}
              </ScrollView>
              <View style={[styles.mobileModalButtons, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.mobileModalDeleteButton} onPress={() => selectedClub && deleteClub(selectedClub.id)}>
                  <Text style={styles.mobileModalDeleteText}>Löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mobileModalCancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowEditModal(false)}>
                  <Text style={[styles.mobileModalCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mobileModalSaveButton, { backgroundColor: colors.primary }]} onPress={updateClub}>
                  <Text style={[styles.mobileModalSaveText, { color: colors.primaryText }]}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </View>
      </View>
    );
  }

  // Desktop View
  return (
    <View style={styles.modalOverlayContainer}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={() => navigation.goBack()} activeOpacity={1} />
      <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Interessenten / Vereine</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          {/* Player Info - ohne Bild, mit Alter und Position */}
          <View style={[styles.topSection, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.topLeft}>
              <Text style={[styles.playerFirstName, { color: colors.textSecondary }]}>{player.first_name}</Text>
              <Text style={[styles.playerLastName, { color: colors.text }]}>{player.last_name}</Text>
              <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>{calculateAge(player.birth_date)} Jahre • {getFullPosition(player.position)}</Text>
            </View>

            <View style={styles.topRight}>
              {playerClubLogo ? (
                <Image source={{ uri: playerClubLogo }} style={styles.clubLogoHeader} />
              ) : (
                <Text style={[styles.clubNameHeader, { color: colors.text }]}>{player.club || '-'}</Text>
              )}
            </View>
          </View>

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <View style={styles.toolbarLeft}>
              <View style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.viewButton, viewMode === 'kanban' && [styles.viewButtonActive, { backgroundColor: colors.surfaceSecondary }]]}
                  onPress={() => setViewMode('kanban')}
                >
                  <Text style={[styles.viewButtonText, { color: colors.textSecondary }]}>▦</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewButton, viewMode === 'liste' && [styles.viewButtonActive, { backgroundColor: colors.surfaceSecondary }]]}
                  onPress={() => setViewMode('liste')}
                >
                  <Text style={[styles.viewButtonText, { color: colors.textSecondary }]}>☰</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => { resetForm(); setShowAddModal(true); }}>
              <Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ Neuen Verein anlegen</Text>
            </TouchableOpacity>
          </View>

          {/* Kanban / List Content */}
          {viewMode === 'kanban' ? (
            <View style={styles.kanbanContainer}>
              {TRANSFER_STATUS.map(status => renderKanbanColumn(status))}
            </View>
          ) : (
            renderListView()
          )}
        </View>

        {/* Add Modal */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <Pressable style={styles.formModalOverlay} onPress={() => setShowAddModal(false)}>
            <Pressable style={[styles.formModalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.formModalTitle, { color: colors.text }]}>Neuen Verein anlegen</Text>
              {renderForm()}
              <View style={styles.formModalButtons}>
                <TouchableOpacity style={[styles.formModalCancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowAddModal(false)}>
                  <Text style={[styles.formModalCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formModalSaveButton, { backgroundColor: colors.surfaceSecondary, borderColor: '#10b981' }]} onPress={addClub}>
                  <Text style={styles.formModalSaveText}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade">
          <Pressable style={styles.formModalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={[styles.formModalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.formModalTitle, { color: colors.text }]}>Verein bearbeiten</Text>
              {renderForm()}
              <View style={styles.formModalButtons}>
                <TouchableOpacity style={styles.formModalDeleteButton} onPress={() => selectedClub && deleteClub(selectedClub.id)}>
                  <Text style={styles.formModalDeleteText}>Löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formModalCancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowEditModal(false)}>
                  <Text style={[styles.formModalCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formModalSaveButton, { backgroundColor: colors.surfaceSecondary, borderColor: '#10b981' }]} onPress={updateClub}>
                  <Text style={styles.formModalSaveText}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal Container - mit sichtbarem Hintergrund
  modalOverlayContainer: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    width: '92%',
    maxWidth: 1100,
    height: '90%',
    maxHeight: 800,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  
  // Header - kompakter
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0', 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  closeButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  closeButtonText: { color: '#64748b', fontSize: 16 },
  
  content: { flex: 1, padding: 12 },
  
  // Top Section - ohne Bild
  topSection: { 
    flexDirection: 'row', 
    backgroundColor: '#f8fafc', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: { flex: 1 },
  playerFirstName: { fontSize: 16, color: '#666' },
  playerLastName: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  playerMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  topRight: { alignItems: 'center', justifyContent: 'center' },
  clubLogoHeader: { width: 45, height: 45, resizeMode: 'contain' },
  clubNameHeader: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', maxWidth: 80 },
  
  // Toolbar - kompakter
  toolbar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 6, padding: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  viewButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  viewButtonActive: { backgroundColor: '#f1f5f9' },
  viewButtonText: { fontSize: 14, color: '#64748b' },
  addButton: { 
    backgroundColor: '#000', 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 6,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  
  // Kanban - kompakter aber höher
  kanbanContainer: { flexDirection: 'row', gap: 12, flex: 1 },
  kanbanColumn: { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
    borderRadius: 10, 
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kanbanColumnDropTarget: { backgroundColor: '#f0f9ff', borderWidth: 2, borderColor: '#3b82f6', borderStyle: 'dashed' },
  kanbanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kanbanTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', flex: 1 },
  countBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  kanbanContent: { flex: 1 },
  emptyColumn: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 16, fontSize: 12 },
  
  // Club Card - kompakter
  clubCard: { 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    padding: 10, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 2, 
    shadowOffset: { width: 0, height: 1 },
    position: 'relative',
  },
  clubCardHighlighted: {
    backgroundColor: '#f1f5f9',
    borderColor: '#94a3b8',
    borderWidth: 2,
  },
  reminderBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fef3c7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    zIndex: 1,
  },
  reminderBadgeText: { fontSize: 10, color: '#b45309', fontWeight: '600' },
  reminderBadgeToday: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fef3c7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    zIndex: 1,
  },
  reminderBadgeTodayText: { fontSize: 10, color: '#b45309', fontWeight: '600' },
  reminderBadgeOverdue: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fecaca',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    zIndex: 1,
  },
  reminderBadgeOverdueText: { fontSize: 10, color: '#dc2626', fontWeight: '600' },
  clubCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingRight: 60 },
  clubLogo: { width: 24, height: 24, borderRadius: 3, marginRight: 8, resizeMode: 'contain' },
  clubLogoPlaceholder: { width: 24, height: 24, borderRadius: 3, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  clubLogoText: { fontSize: 9, fontWeight: '600', color: '#64748b' },
  clubName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  clubCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  clubCardIcon: { marginRight: 4, fontSize: 10 },
  clubCardText: { fontSize: 11, color: '#64748b' },
  clubNotes: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  
  // Table
  tableContainer: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderCell: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableCell: { fontSize: 14, color: '#334155' },
  tableCellText: { fontWeight: '500' },
  tableLogo: { width: 24, height: 24, marginRight: 10, resizeMode: 'contain' },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  // Form Modal
  formModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  formModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 450, overflow: 'visible' },
  formModalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16, textAlign: 'center' },
  formModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16, zIndex: -1 },
  formModalCancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
  formModalCancelText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  formModalSaveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#10b981' },
  formModalSaveText: { color: '#10b981', fontWeight: '600', fontSize: 14 },
  formModalDeleteButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fef2f2', marginRight: 'auto' },
  formModalDeleteText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  
  // Form
  formContainer: { gap: 16 },
  formScrollContainer: { maxHeight: 400 },
  formRow: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, backgroundColor: '#fff' },
  formTextArea: { minHeight: 80, textAlignVertical: 'top' },
  autocompleteContainer: { position: 'relative', zIndex: 300 },
  
  // Club Dropdown
  clubDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff' },
  clubDropdownText: { fontSize: 15, color: '#333', flex: 1 },
  clubDropdownArrow: { fontSize: 12, color: '#64748b', marginLeft: 8 },
  clubSuggestionsList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 20, marginTop: 4 },
  clubSearchInput: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 },
  clubSuggestionsScroll: { maxHeight: 200 },
  clubSuggestionItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  clubSuggestionItemSelected: { backgroundColor: '#f0f9ff' },
  clubSuggestionItemCustom: { backgroundColor: '#f0fdf4', borderBottomColor: '#bbf7d0' },
  clubSuggestionText: { fontSize: 14, color: '#1a1a1a' },
  clubSuggestionTextSelected: { color: '#3b82f6', fontWeight: '600' },
  clubSuggestionTextCustom: { fontSize: 14, color: '#16a34a', fontWeight: '500' },
  
  statusSelector: { flexDirection: 'row', gap: 8 },
  statusOption: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  
  // Date Picker - unterschiedliche Breiten
  datePickerRow: { flexDirection: 'row', gap: 8 },
  datePickerFieldSmall: { position: 'relative', width: 70 },
  datePickerFieldMedium: { position: 'relative', width: 100 },
  dateDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#fff' },
  dateDropdownText: { fontSize: 13, color: '#333' },
  dateDropdownArrow: { fontSize: 10, color: '#64748b' },
  datePickerList: { position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, maxHeight: 180, zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 20, marginTop: 4, minWidth: 70 },
  datePickerScroll: { maxHeight: 180 },
  datePickerItem: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  datePickerItemSelected: { backgroundColor: '#f0f9ff' },
  datePickerItemText: { fontSize: 13, color: '#333' },
  datePickerItemTextSelected: { color: '#3b82f6', fontWeight: '600' },
  
  // Reminder Dropdown
  reminderDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    minWidth: 150,
  },
  reminderDropdownText: { fontSize: 13, color: '#333' },
  reminderDropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#fff',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  reminderDropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  reminderDropdownItemSelected: { backgroundColor: '#1a1a1a' },
  reminderDropdownItemText: { fontSize: 13, color: '#333' },
  reminderDropdownItemTextSelected: { color: '#fff' },

  // ==================== MOBILE STYLES ====================
  mobileScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mobileScreenContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flex: 1,
  },
  mobileScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  mobileScreenTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileScreenClose: {
    fontSize: 20,
    color: '#64748b',
  },
  mobileScreenSubtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mobileLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Mobile Header
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileBackButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileHeaderCenter: {
    flex: 1,
    marginLeft: 12,
  },
  mobileHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileHeaderSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  mobileHeaderLogo: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },

  // Mobile Tabs
  mobileTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  mobileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  mobileTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  mobileTabText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  mobileTabTextActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  mobileTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 18,
    alignItems: 'center',
  },
  mobileTabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },

  // Mobile Content
  mobileContent: {
    flex: 1,
  },
  mobileContentContainer: {
    padding: 12,
    paddingBottom: 80,
  },
  mobileEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  mobileEmptyText: {
    fontSize: 15,
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  // Mobile Club Card
  mobileClubCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileClubCardHighlighted: {
    backgroundColor: '#f1f5f9',
    borderColor: '#94a3b8',
    borderWidth: 2,
  },
  mobileClubCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileClubLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 12,
    resizeMode: 'contain',
  },
  mobileClubCardInfo: {
    flex: 1,
  },
  mobileClubName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileClubAdvisor: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  mobileClubContact: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  mobileClubNotes: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mobileReminderBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mobileReminderOverdue: {
    backgroundColor: '#fecaca',
  },
  mobileReminderToday: {
    backgroundColor: '#fef3c7',
  },
  mobileReminderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#b45309',
  },
  mobileReminderTextOverdue: {
    color: '#dc2626',
  },
  mobileReminderTextToday: {
    color: '#b45309',
  },

  // Mobile Add Button
  mobileAddButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  // Mobile Modal
  mobileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mobileModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  mobileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileModalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 400,
  },
  mobileModalButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mobileModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  mobileModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  mobileModalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  mobileModalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  mobileModalDeleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  mobileModalDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
});
