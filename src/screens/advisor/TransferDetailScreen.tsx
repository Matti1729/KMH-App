import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Platform, Pressable, SafeAreaView, Alert, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTheme } from '../../contexts/ThemeContext';
import { useDialog } from '../../components/DialogProvider';

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

interface OfferDocument {
  name: string;
  url: string;
  path: string;
  uploaded_at: string;
}

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
  offer_documents: OfferDocument[];
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
  nationality?: string;
  transfermarkt_url?: string;
}

const CLUB_UMLAUT_MAP: Array<[RegExp, string]> = [
  [/saarbrucken/gi, 'Saarbrücken'],
  [/munchen/gi, 'München'],
  [/nurnberg/gi, 'Nürnberg'],
  [/dusseldorf/gi, 'Düsseldorf'],
  [/monchengladbach/gi, 'Mönchengladbach'],
  [/furth/gi, 'Fürth'],
  [/koln\b/gi, 'Köln'],
  [/wurzburg/gi, 'Würzburg'],
  [/hombug/gi, 'Homburg'],
  [/osnabruck/gi, 'Osnabrück'],
  [/lubeck/gi, 'Lübeck'],
  [/munster/gi, 'Münster'],
  [/zurich/gi, 'Zürich'],
];

function normalizeGermanClubName(club: string | null | undefined): string {
  if (!club) return '';
  let out = club;
  for (const [regex, replacement] of CLUB_UMLAUT_MAP) out = out.replace(regex, replacement);
  return out;
}

const COUNTRY_TO_ISO: Record<string, string> = {
  'Deutschland': 'DE', 'Österreich': 'AT', 'Schweiz': 'CH', 'Frankreich': 'FR',
  'Italien': 'IT', 'Spanien': 'ES', 'Portugal': 'PT', 'Niederlande': 'NL',
  'Belgien': 'BE', 'England': 'GB', 'Polen': 'PL', 'Kroatien': 'HR',
  'Serbien': 'RS', 'Türkei': 'TR', 'Brasilien': 'BR', 'Argentinien': 'AR',
  'USA': 'US', 'Kanada': 'CA', 'Dänemark': 'DK', 'Schweden': 'SE', 'Norwegen': 'NO',
  'Finnland': 'FI', 'Island': 'IS', 'Irland': 'IE', 'Schottland': 'GB',
  'Wales': 'GB', 'Griechenland': 'GR', 'Tschechien': 'CZ', 'Slowakei': 'SK',
  'Ungarn': 'HU', 'Rumänien': 'RO', 'Bulgarien': 'BG', 'Slowenien': 'SI',
  'Bosnien und Herzegowina': 'BA', 'Bosnien-Herzegowina': 'BA', 'Montenegro': 'ME',
  'Nordmazedonien': 'MK', 'Albanien': 'AL', 'Kosovo': 'XK', 'Ukraine': 'UA',
  'Russland': 'RU', 'Japan': 'JP', 'Südkorea': 'KR', 'China': 'CN',
  'Australien': 'AU', 'Mexiko': 'MX', 'Kolumbien': 'CO', 'Chile': 'CL',
  'Peru': 'PE', 'Uruguay': 'UY', 'Paraguay': 'PY', 'Ecuador': 'EC',
  'Ghana': 'GH', 'Nigeria': 'NG', 'Kamerun': 'CM', 'Senegal': 'SN',
  'Elfenbeinküste': 'CI', 'Marokko': 'MA', 'Tunesien': 'TN', 'Ägypten': 'EG',
  'Südafrika': 'ZA', 'Israel': 'IL', 'Iran': 'IR', 'Irak': 'IQ',
  'Saudi-Arabien': 'SA', 'Vereinigte Arabische Emirate': 'AE', 'Indien': 'IN',
  'Luxemburg': 'LU', 'Litauen': 'LT', 'Lettland': 'LV', 'Estland': 'EE',
  'Georgien': 'GE', 'Armenien': 'AM', 'Aserbaidschan': 'AZ',
  'Syrien': 'SY', 'Libanon': 'LB', 'Jordanien': 'JO', 'Afghanistan': 'AF',
  'Pakistan': 'PK', 'Kongo': 'CD', 'Eritrea': 'ER', 'Somalia': 'SO',
  'Äthiopien': 'ET', 'Guinea': 'GN', 'Mali': 'ML', 'Gambia': 'GM',
  'Sierra Leone': 'SL', 'Togo': 'TG', 'Benin': 'BJ', 'Burkina Faso': 'BF',
};

function countryToFlag(country: string): string {
  const iso = COUNTRY_TO_ISO[country];
  if (iso && iso.length === 2) {
    const cp1 = 0x1F1E6 + iso.charCodeAt(0) - 65;
    const cp2 = 0x1F1E6 + iso.charCodeAt(1) - 65;
    return String.fromCodePoint(cp1, cp2);
  }
  return '🏳️';
}

const COUNTRY_FLAGS: Record<string, string> = {};
for (const [name] of Object.entries(COUNTRY_TO_ISO)) {
  COUNTRY_FLAGS[name] = countryToFlag(name);
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
  const { alert: alertDialog } = useDialog();
  const [player, setPlayer] = useState<Player | null>(null);
  const [clubs, setClubs] = useState<TransferClub[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [allClubNames, setAllClubNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [mobileTab, setMobileTab] = useState<MobileTab>('ideen');
  const [mobileModalVisible, setMobileModalVisible] = useState(false);

  // Modal beim Mounten zeigen → triggert Slide-Up-Animation
  useEffect(() => {
    setMobileModalVisible(true);
  }, []);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState<TransferClub | null>(null);
  
  // Form states
  const [clubSearch, setClubSearch] = useState('');
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [tmClubResults, setTmClubResults] = useState<Array<{ name: string; logoUrl: string; liga?: string; country?: string }>>([]);
  const [tmClubSearching, setTmClubSearching] = useState(false);
  const tmClubSearchTimeout = useRef<any>(null);
  const [clubContacts, setClubContacts] = useState<Array<{ id: string; vorname: string; nachname: string; position: string; bereich: string; mannschaft: string }>>([]);
  const [showAdvisorSuggestions, setShowAdvisorSuggestions] = useState(false);
  const [formData, setFormData] = useState<{
    club_name: string;
    status: string;
    advisor_name: string;
    last_contact: string;
    notes: string;
    reminder_days: number | null;
  }>({
    club_name: '',
    status: '',
    advisor_name: '',
    last_contact: '',
    notes: '',
    reminder_days: null,
  });
  
  // Offer documents state
  const [clubOfferDocuments, setClubOfferDocuments] = useState<OfferDocument[]>([]);
  const [uploadingOffer, setUploadingOffer] = useState(false);

  // Date picker states
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  
  // Reminder options
  const REMINDER_OPTIONS = [
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

  // Football-Network-Kontakte des aktuell ausgewählten Vereins laden,
  // damit sie als Ansprechpartner-Vorschläge angezeigt werden.
  useEffect(() => {
    const club = formData.club_name?.trim();
    if (!club) {
      setClubContacts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('football_network_contacts')
        .select('id, vorname, nachname, position, bereich, mannschaft')
        .eq('verein', club)
        .order('nachname', { ascending: true });
      if (!cancelled) setClubContacts(data || []);
    })();
    return () => { cancelled = true; };
  }, [formData.club_name]);

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
      .select('id, first_name, last_name, position, birth_date, club, contract_end, photo_url, responsibility, nationality, transfermarkt_url')
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

  const searchTmClubs = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setTmClubResults([]);
      setTmClubSearching(false);
      return;
    }
    setTmClubSearching(true);
    try {
      const { data } = await supabase.functions.invoke('search-club', { body: { query: query.trim() } });
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setTmClubResults(parsed?.results && Array.isArray(parsed.results) ? parsed.results : []);
    } catch (e) {
      console.error('TM club search error:', e);
      setTmClubResults([]);
    } finally {
      setTmClubSearching(false);
    }
  };

  const handleClubSearchChange = (text: string) => {
    setClubSearch(text);
    if (tmClubSearchTimeout.current) clearTimeout(tmClubSearchTimeout.current);
    if (text.trim().length < 2) {
      setTmClubResults([]);
      setTmClubSearching(false);
      return;
    }
    tmClubSearchTimeout.current = setTimeout(() => searchTmClubs(text), 400);
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
    setShowAdvisorSuggestions(false);
  };

  const uploadOfferDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled) return;
      setUploadingOffer(true);

      const file = result.assets[0];
      const sanitizedName = file.name
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
        .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const fileName = `${playerId}/${Date.now()}_${sanitizedName}`;

      let fileData: Blob | ArrayBuffer;
      if (file.file) {
        fileData = file.file;
      } else {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('offers')
        .upload(fileName, fileData, { contentType: 'application/pdf', upsert: false });

      if (uploadError) {
        Alert.alert('Fehler', uploadError.message);
        setUploadingOffer(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('offers').getPublicUrl(fileName);
      setClubOfferDocuments(prev => [...prev, {
        name: file.name,
        url: urlData.publicUrl,
        path: fileName,
        uploaded_at: new Date().toISOString(),
      }]);
      setUploadingOffer(false);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Fehler', 'Dokument konnte nicht hochgeladen werden');
      setUploadingOffer(false);
    }
  };

  const deleteOfferDocument = async (path: string) => {
    await supabase.storage.from('offers').remove([path]);
    setClubOfferDocuments(prev => prev.filter(doc => doc.path !== path));
  };

  const openOfferDocument = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const addClub = async () => {
    if (!formData.club_name.trim()) {
      alertDialog({ title: 'Eingabe fehlt', message: 'Bitte einen Verein auswählen.' });
      else Alert.alert('Hinweis', 'Bitte einen Verein auswählen.');
      return;
    }
    if (!formData.status) {
      alertDialog({ title: 'Eingabe fehlt', message: 'Bitte einen Status auswählen (Ideen / Offen / Absage).' });
      else Alert.alert('Hinweis', 'Bitte einen Status auswählen.');
      return;
    }

    const payload: any = {
      player_id: playerId,
      club_name: formData.club_name.trim(),
      status: formData.status,
      advisor_name: formData.advisor_name?.trim() || null,
      last_contact: formData.last_contact || null,
      notes: formData.notes?.trim() || null,
      reminder_days: formData.reminder_days,
      offer_documents: clubOfferDocuments,
    };

    const { data, error } = await supabase.from('transfer_clubs').insert(payload).select();
    console.log('[transfer_clubs] INSERT — rows:', data?.length || 0, 'error:', error, 'payload:', payload);

    if (error) {
      const msg = error.message || error.code || 'Unbekannter Fehler';
      alertDialog({ title: 'Fehler', message: 'Verein konnte nicht angelegt werden: ' + msg });
      else Alert.alert('Fehler', msg);
      return;
    }

    setShowAddModal(false);
    resetForm();
    fetchClubs();
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
        reminder_days: formData.reminder_days,
        offer_documents: clubOfferDocuments,
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
      status: '',
      advisor_name: '',
      last_contact: '',
      notes: '',
      reminder_days: null,
    });
    setClubSearch('');
    setClubOfferDocuments([]);
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
      reminder_days: club.reminder_days === null || club.reminder_days === undefined ? null : club.reminder_days,
    });
    setClubSearch(club.club_name);
    setClubOfferDocuments(club.offer_documents || []);
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
          <TouchableOpacity style={[styles.clubCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }, isHighlighted && styles.clubCardHighlighted]} onPress={() => openEditModal(club)}>
            {renderReminderBadge()}
            <View style={styles.clubCardHeader}>
              {logo && (
                <Image source={{ uri: logo }} style={styles.clubLogo} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.clubName, { color: colors.text }]}>{club.club_name}</Text>
                {club.advisor_name && (
                  <Text style={[styles.clubCardText, { color: colors.textSecondary, marginTop: 2 }]}>👤 {club.advisor_name}</Text>
                )}
              </View>
            </View>
            {club.last_contact && (
              <View style={styles.clubCardRow}>
                <Text style={[styles.clubCardText, { color: colors.textSecondary }]}>🕐 Letzter Kontakt: {formatDate(club.last_contact)}</Text>
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
      <TouchableOpacity key={club.id} style={[styles.clubCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }, isHighlighted && styles.clubCardHighlighted]} onPress={() => openEditModal(club)}>
        {renderReminderBadge()}
        <View style={styles.clubCardHeader}>
          {logo && (
            <Image source={{ uri: logo }} style={styles.clubLogo} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.clubName, { color: colors.text }]}>{club.club_name}</Text>
            {club.advisor_name && (
              <Text style={[styles.clubCardText, { color: colors.textSecondary, marginTop: 2 }]}>👤 {club.advisor_name}</Text>
            )}
          </View>
        </View>
        {club.last_contact && (
          <View style={styles.clubCardRow}>
            <Text style={[styles.clubCardText, { color: colors.textSecondary }]}>🕐 Letzter Kontakt: {formatDate(club.last_contact)}</Text>
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
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 12,
            padding: 16,
            border: isDropTarget ? '2px dashed #22c55e' : '1px solid rgba(255,255,255,0.15)',
            transition: 'background-color 0.2s',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <View style={styles.kanbanHeader}>
            <Text style={styles.kanbanTitle}>{status.label}</Text>
            <View style={[styles.countBadge, { backgroundColor: status.color }]}>
              <Text style={styles.countText}>{columnClubs.length}</Text>
            </View>
          </View>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {columnClubs.length === 0 ? (
              <Text style={styles.emptyColumn}>Leer</Text>
            ) : (
              columnClubs.map(club => renderClubCard(club))
            )}
          </div>
        </div>
      );
    }

    return (
      <View key={status.id} style={[styles.kanbanColumn, isDropTarget && styles.kanbanColumnDropTarget]}>
        <View style={styles.kanbanHeader}>
          <Text style={styles.kanbanTitle}>{status.label}</Text>
          <View style={[styles.countBadge, { backgroundColor: status.color }]}>
            <Text style={styles.countText}>{columnClubs.length}</Text>
          </View>
        </View>
        <ScrollView style={styles.kanbanContent} showsVerticalScrollIndicator={false}>
          {columnClubs.length === 0 ? (
            <Text style={styles.emptyColumn}>Leer</Text>
          ) : (
            columnClubs.map(club => renderClubCard(club))
          )}
        </ScrollView>
      </View>
    );
  };

  const renderListView = () => (
    <View style={[styles.tableContainer, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}>
      <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border, overflow: 'hidden' }]}>
        <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 }} resizeMode="cover" />
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
          <Text style={styles.formLabel}>Verein *</Text>
          <View style={styles.autocompleteContainer}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[styles.clubDropdownButton, { flex: 1 }]}
                onPress={() => { closeAllDropdowns(); setShowClubSuggestions(!showClubSuggestions); }}
              >
                <Text style={[styles.clubDropdownText, !formData.club_name && { color: 'rgba(255,255,255,0.3)' }]}>
                  {formData.club_name || 'Verein auswählen...'}
                </Text>
                <Text style={styles.clubDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {formData.club_name ? <TouchableOpacity style={[styles.clubDropdownButton, { width: 30, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }]} onPress={() => setFormData({...formData, club_name: ''})}><Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>✕</Text></TouchableOpacity> : null}
            </View>
            {showClubSuggestions && (
              <Pressable style={styles.clubSuggestionsList} onPress={(e) => e.stopPropagation()}>
                <TextInput
                  style={styles.clubSearchInput}
                  value={clubSearch}
                  onChangeText={handleClubSearchChange}
                  placeholder="Suchen oder eigenen Namen eingeben..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                />
                <ScrollView style={styles.clubSuggestionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {formData.club_name ? <TouchableOpacity style={styles.clubSuggestionItem} onPress={() => { setFormData({...formData, club_name: ''}); setClubSearch(''); setShowClubSuggestions(false); setTmClubResults([]); }}><Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' }}>Leeren</Text></TouchableOpacity> : null}
                  {/* Option für eigenen Namen wenn Text eingegeben */}
                  {clubSearch.length >= 2 && !allClubNames.some(n => n.toLowerCase() === clubSearch.toLowerCase()) && !tmClubResults.some(r => r.name.toLowerCase() === clubSearch.toLowerCase()) && (
                    <TouchableOpacity
                      style={[styles.clubSuggestionItem, styles.clubSuggestionItemCustom]}
                      onPress={() => {
                        setFormData({ ...formData, club_name: clubSearch });
                        setClubSearch('');
                        setShowClubSuggestions(false);
                        setTmClubResults([]);
                      }}
                    >
                      <Text style={styles.clubSuggestionTextCustom}>"{clubSearch}" verwenden</Text>
                    </TouchableOpacity>
                  )}
                  {(clubSearch.length >= 2 ? filteredClubs : allClubNames.slice(0, 15)).map(name => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.clubSuggestionItem, formData.club_name === name && styles.clubSuggestionItemSelected]}
                      onPress={() => {
                        setFormData({ ...formData, club_name: name });
                        setClubSearch('');
                        setShowClubSuggestions(false);
                        setTmClubResults([]);
                      }}
                    >
                      <Text style={[styles.clubSuggestionText, formData.club_name === name && styles.clubSuggestionTextSelected]}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                  {/* Transfermarkt-Ergebnisse */}
                  {clubSearch.trim().length >= 2 && (tmClubSearching || tmClubResults.length > 0) ? (
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>TRANSFERMARKT-ERGEBNISSE</Text>
                      {tmClubSearching && tmClubResults.length === 0 ? (
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, paddingHorizontal: 12, paddingVertical: 6 }}>Suche…</Text>
                      ) : null}
                      {tmClubResults.map((club, idx) => (
                        <TouchableOpacity
                          key={`tm-${club.name}-${idx}`}
                          style={[styles.clubSuggestionItem, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                          onPress={() => {
                            setFormData({ ...formData, club_name: club.name });
                            setClubSearch('');
                            setShowClubSuggestions(false);
                            setTmClubResults([]);
                          }}
                        >
                          {club.logoUrl ? (
                            <Image source={{ uri: club.logoUrl }} style={{ width: 18, height: 18 }} resizeMode="contain" />
                          ) : (
                            <View style={{ width: 18, height: 18 }} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.clubSuggestionText} numberOfLines={1}>{club.name}</Text>
                            {club.liga ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} numberOfLines={1}>{club.liga}{club.country ? ` · ${club.country}` : ''}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.statusSelector}>
            {TRANSFER_STATUS.map(status => (
              <TouchableOpacity
                key={status.id}
                style={[styles.statusOption, formData.status === status.id && { backgroundColor: status.color, borderColor: status.color }]}
                onPress={() => { setFormData({ ...formData, status: status.id }); closeAllDropdowns(); }}
              >
                <Text style={[styles.statusOptionText, formData.status === status.id && { color: '#fff' }]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.formRow, { zIndex: 250 }]}>
          <Text style={styles.formLabel}>Ansprechpartner</Text>
          <Pressable style={styles.autocompleteContainer} onPress={(e) => e.stopPropagation()}>
            <TextInput
              style={styles.formInput}
              value={formData.advisor_name}
              onChangeText={(text) => { setFormData({ ...formData, advisor_name: text }); setShowAdvisorSuggestions(true); }}
              onFocus={() => {
                setShowDayPicker(false);
                setShowMonthPicker(false);
                setShowYearPicker(false);
                setShowClubSuggestions(false);
                setShowReminderPicker(false);
                if (clubContacts.length > 0) setShowAdvisorSuggestions(true);
              }}
              placeholder="z.B. Max Müller · Sportdirektor"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            {showAdvisorSuggestions && clubContacts.length > 0 ? (() => {
              const q = (formData.advisor_name || '').toLowerCase().trim();
              const matches = q
                ? clubContacts.filter(c =>
                    `${c.vorname} ${c.nachname}`.toLowerCase().includes(q) ||
                    (c.position || '').toLowerCase().includes(q) ||
                    (c.mannschaft || '').toLowerCase().includes(q)
                  )
                : clubContacts;
              if (matches.length === 0) return null;
              return (
                <Pressable style={styles.clubSuggestionsList} onPress={(e) => e.stopPropagation()}>
                  <ScrollView style={styles.clubSuggestionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {matches.map(c => {
                      const fullName = [c.vorname, c.nachname].filter(Boolean).join(' ').trim();
                      const display = c.position ? `${fullName} · ${c.position}` : fullName;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.clubSuggestionItem}
                          onPress={() => { setFormData(prev => ({ ...prev, advisor_name: display })); setShowAdvisorSuggestions(false); }}
                        >
                          <Text style={styles.clubSuggestionText} numberOfLines={1}>{display}</Text>
                          {c.mannschaft || c.bereich ? (
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} numberOfLines={1}>{[c.mannschaft, c.bereich].filter(Boolean).join(' · ')}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </Pressable>
              );
            })() : null}
          </Pressable>
        </View>

        <View style={[styles.formRow, { zIndex: 200 }]}>
          <Text style={styles.formLabel}>Letzter Kontakt</Text>
          <View style={styles.datePickerRow}>
            {/* Day Picker */}
            <View style={[styles.datePickerFieldSmall, { zIndex: showDayPicker ? 210 : 1 }]}>
              <TouchableOpacity
                style={styles.dateDropdownButton}
                onPress={() => { closeAllDropdowns(); setShowDayPicker(!showDayPicker); }}
              >
                <Text style={[styles.dateDropdownText, !displayDay && { color: 'rgba(255,255,255,0.3)' }]}>{displayDay || 'Tag'}</Text>
                <Text style={styles.dateDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showDayPicker && (
                <View style={styles.datePickerList}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {DAYS.map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.datePickerItem, displayDay === d && styles.datePickerItemSelected]}
                        onPress={() => {
                          updateDatePart('day', d);
                          setShowDayPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, displayDay === d && styles.datePickerItemTextSelected]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Month Picker */}
            <View style={[styles.datePickerFieldMedium, { zIndex: showMonthPicker ? 210 : 1 }]}>
              <TouchableOpacity
                style={styles.dateDropdownButton}
                onPress={() => { closeAllDropdowns(); setShowMonthPicker(!showMonthPicker); }}
              >
                <Text style={[styles.dateDropdownText, displayMonth === null && { color: 'rgba(255,255,255,0.3)' }]}>{displayMonth !== null ? MONTHS[displayMonth] : 'Monat'}</Text>
                <Text style={styles.dateDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showMonthPicker && (
                <View style={[styles.datePickerList, { minWidth: 120 }]}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {MONTHS.map((m, idx) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.datePickerItem, displayMonth === idx && styles.datePickerItemSelected]}
                        onPress={() => {
                          updateDatePart('month', idx);
                          setShowMonthPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, displayMonth === idx && styles.datePickerItemTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Year Picker */}
            <View style={[styles.datePickerFieldSmall, { zIndex: showYearPicker ? 210 : 1 }]}>
              <TouchableOpacity
                style={styles.dateDropdownButton}
                onPress={() => { closeAllDropdowns(); setShowYearPicker(!showYearPicker); }}
              >
                <Text style={[styles.dateDropdownText, !displayYear && { color: 'rgba(255,255,255,0.3)' }]}>{displayYear || 'Jahr'}</Text>
                <Text style={styles.dateDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showYearPicker && (
                <View style={styles.datePickerList}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {YEARS.map((y) => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.datePickerItem, displayYear === y && styles.datePickerItemSelected]}
                        onPress={() => {
                          updateDatePart('year', y);
                          setShowYearPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, displayYear === y && styles.datePickerItemTextSelected]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.formRow, { zIndex: 50 }]}>
          <Text style={styles.formLabel}>Erinnerung in</Text>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={styles.reminderDropdownButton}
              onPress={() => {
                setShowReminderPicker(!showReminderPicker);
                setShowDayPicker(false);
                setShowMonthPicker(false);
                setShowYearPicker(false);
                setShowClubSuggestions(false);
              }}
            >
              <Text style={[styles.reminderDropdownText, formData.reminder_days === null && { color: 'rgba(255,255,255,0.3)' }]}>
                {formData.reminder_days === null
                  ? 'Auswählen'
                  : formData.reminder_days === 0
                    ? 'Heute'
                    : `${formData.reminder_days} Tage`
                }
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)' }}>▼</Text>
            </TouchableOpacity>
            {showReminderPicker && (
              <View style={styles.reminderDropdownList}>
                <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                  <TouchableOpacity style={styles.reminderDropdownItem} onPress={() => { setFormData({...formData, reminder_days: null}); setShowReminderPicker(false); }}><Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' }}>Leeren</Text></TouchableOpacity>
                  {REMINDER_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.reminderDropdownItem,
                        formData.reminder_days === option.value && styles.reminderDropdownItemSelected
                      ]}
                      onPress={() => {
                        setFormData({ ...formData, reminder_days: option.value });
                        setShowReminderPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.reminderDropdownItemText,
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
          <Text style={styles.formLabel}>Notizen</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            onFocus={() => closeAllDropdowns()}
            placeholder="z.B. Interesse hinterlegt beim Sportdirektor"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Angebote / Dokumente</Text>
          <TouchableOpacity
            style={[styles.uploadOfferButton, uploadingOffer && { opacity: 0.5 }]}
            onPress={uploadOfferDocument}
            disabled={uploadingOffer}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#000" />
            <Text style={styles.uploadOfferButtonText}>{uploadingOffer ? 'Lädt hoch...' : 'PDF hochladen'}</Text>
          </TouchableOpacity>
          {clubOfferDocuments.map((doc, index) => (
            <View key={index} style={styles.offerDocItem}>
              <TouchableOpacity onPress={() => openOfferDocument(doc.url)} style={styles.offerDocLink}>
                <Text style={styles.offerDocIcon}>📄</Text>
                <Text style={[styles.offerDocName, { color: '#fff' }]} numberOfLines={1}>{doc.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteOfferDocument(doc.path)} style={styles.offerDocDelete}>
                <Text style={styles.offerDocDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
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
        style={[styles.mobileClubCard, { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: 'rgba(255,255,255,0.15)' }, isHighlighted && styles.mobileClubCardHighlighted]}
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
          <Text style={[styles.mobileClubNotes, { color: colors.textSecondary, borderTopColor: colors.border }]} numberOfLines={1}>💬 "{club.notes}"</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Mobile View
  if (isMobile) {
    const mobileClubs = getClubsByStatus(mobileTab);
    const handleClose = () => {
      setMobileModalVisible(false);
      setTimeout(() => navigation.goBack(), 250);
    };

    return (
      <Modal visible={mobileModalVisible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.mobileScreenOverlay}>
        <View style={[styles.mobileScreenContent, { backgroundColor: '#000', overflow: 'hidden' }]}>
          <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }]} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

          {/* Mobile Header — skill-konform, Layout wie Desktop "Interessenten" */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', zIndex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              {playerClubLogo ? <Image source={{ uri: playerClubLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" /> : null}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', flex: 1, lineHeight: 18 }} numberOfLines={1}>{player.first_name} {player.last_name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', lineHeight: 18 }}>Interessenten</Text>
                  <Text onPress={handleClose} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 18 }}>✕</Text>
                </View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }} numberOfLines={1}>{normalizeGermanClubName(player.club) || 'Vereinslos'}</Text>
              </View>
            </View>
          </View>

        {/* Tabs — skill-konform: transparent mit Active-Underline + Count-Pill */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', zIndex: 1 }}>
          {TRANSFER_STATUS.map(status => {
            const count = getClubsByStatus(status.id).length;
            const isActive = mobileTab === status.id;
            return (
              <TouchableOpacity
                key={status.id}
                style={{ flex: 1, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: isActive ? status.color : 'transparent' }}
                onPress={() => setMobileTab(status.id as MobileTab)}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: isActive ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {status.id === 'offen' ? 'Offen' : status.label}
                </Text>
                <View style={{ minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: isActive ? status.color : 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView style={{ flex: 1, zIndex: 1 }} contentContainerStyle={styles.mobileContentContainer}>
          {mobileClubs.length === 0 ? (
            <View style={styles.mobileEmptyState}>
              <Text style={{ fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>Keine Vereine in dieser Kategorie</Text>
            </View>
          ) : (
            mobileClubs.map(club => renderMobileClubCard(club))
          )}
        </ScrollView>

        {/* FAB — Skill-Pattern: 32×32, klein */}
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, zIndex: 10 }}
          onPress={() => { resetForm(); setFormData({ ...formData, status: mobileTab }); setShowAddModal(true); }}
        >
          <Ionicons name="add" size={18} color={colors.primaryText} />
        </TouchableOpacity>

        {/* Add Modal - same as desktop */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.mobileModalOverlay}>
            <View style={[styles.mobileModalContent, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }]}>
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center' } as any) }]} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', position: 'relative', zIndex: 1 }}>
                <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Neuen Verein anlegen</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ position: 'absolute', right: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={[styles.mobileModalScroll, { zIndex: 1 }]}>
                {renderForm()}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', zIndex: 1 }}>
                <TouchableOpacity style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#22c55e', backgroundColor: '#22c55e' }} onPress={addClub}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Modal - same as desktop */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.mobileModalOverlay}>
            <View style={[styles.mobileModalContent, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }]}>
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center' } as any) }]} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', position: 'relative', zIndex: 1 }}>
                <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Verein bearbeiten</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ position: 'absolute', right: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={[styles.mobileModalScroll, { zIndex: 1 }]}>
                {renderForm()}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', zIndex: 1 }}>
                <TouchableOpacity style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)' }} onPress={() => selectedClub && deleteClub(selectedClub.id)}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#ef4444' }}>Löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#22c55e', backgroundColor: '#22c55e' }} onPress={updateClub}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </View>
      </View>
      </Modal>
    );
  }

  // Desktop View
  return (
    <View style={styles.modalOverlayContainer}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={() => navigation.goBack()} activeOpacity={1} />
      <View style={styles.modalContainer}>
        <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[styles.bgImage, { objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any]} resizeMode="cover" />
        <View style={styles.bgOverlay} />

        {/* Top-Toolbar mit Trenn-Linie unten — identisch zum Spielerprofil-Modal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)', zIndex: 2, gap: 8 }}>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'kanban' && styles.viewButtonActive]}
              onPress={() => setViewMode('kanban')}
            >
              <Ionicons name="grid-outline" size={14} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'liste' && styles.viewButtonActive]}
              onPress={() => setViewMode('liste')}
            >
              <Ionicons name="list-outline" size={16} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setShowAddModal(true); }} accessibilityLabel="Neuen Verein anlegen">
            <Ionicons name="add" size={16} color="rgba(255,255,255,0.85)" />
            <Ionicons name="shield-outline" size={14} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
            <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Player Header — kompaktere Variante */}
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderTop}>
              {/* Foto (kleiner) */}
              {player.photo_url ? (
                <Image source={{ uri: player.photo_url }} style={[styles.detailPhoto, { width: 90, height: 122 }]} />
              ) : (
                <View style={[styles.detailPhoto, styles.detailPhotoPlaceholder, { width: 90, height: 122 }]}>
                  <Text style={[styles.detailPhotoInitial, { fontSize: 28 }]}>
                    {(player.first_name?.[0] || '') + (player.last_name?.[0] || '')}
                  </Text>
                </View>
              )}

              {/* Name + Club */}
              <View style={styles.detailHeaderCenter}>
                {player.first_name ? (
                  <Text style={[styles.detailHeaderName, { fontSize: 40, lineHeight: 44 }]}>{player.first_name}</Text>
                ) : null}
                {player.last_name ? (
                  <Text style={[styles.detailHeaderName, { fontSize: 40, lineHeight: 44 }]}>{player.last_name}</Text>
                ) : null}
                <View style={[styles.detailHeaderClubRow, { marginTop: 6 }]}>
                  {playerClubLogo ? (
                    <Image source={{ uri: playerClubLogo }} style={[styles.detailHeaderClubLogo, { width: 28, height: 28 }]} />
                  ) : null}
                  <Text style={[styles.detailHeaderClubText, { fontSize: 24, lineHeight: 32 }]} numberOfLines={1}>
                    {normalizeGermanClubName(player.club) || 'VEREINSLOS'}
                  </Text>
                </View>
              </View>

              {/* Top right: nur Section-Label */}
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.detailHeaderTitle, { fontSize: 20 }]}>INTERESSENTEN</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            {/* Stats Row — 5 Spalten wie im Spielerprofil */}
            <View style={styles.detailStatsRow}>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>NATIONALITÄT</Text>
                <Text style={[styles.detailStatValue, { fontSize: 18, lineHeight: 20 }]}>
                  {player.nationality ? player.nationality.split(/[,\/]+/).map((n: string) => n.trim()).filter(Boolean).map((n: string) => COUNTRY_FLAGS[n] || '🏳️').join(' ') : '-'}
                </Text>
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>GEBURTSDATUM</Text>
                <Text style={styles.detailStatValue}>
                  {formatDate(player.birth_date)}{(() => {
                    const a = calculateAge(player.birth_date);
                    return a ? `  (${a})` : '';
                  })()}
                </Text>
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>POSITION</Text>
                <Text style={styles.detailStatValue}>{getFullPosition(player.position) || '-'}</Text>
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>VERTRAGSENDE</Text>
                <Text style={styles.detailStatValue}>{formatDate(player.contract_end)}</Text>
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>TRANSFERMARKT-PROFIL</Text>
                {player.transfermarkt_url ? (
                  <TouchableOpacity onPress={() => Linking.openURL(player.transfermarkt_url!)}>
                    <Ionicons name="link-outline" size={18} color="rgba(255,255,255,0.85)" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailStatValue}>-</Text>
                )}
              </View>
            </View>
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
            <Pressable style={styles.formModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.formModalBgWrapper} pointerEvents="none">
                <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[styles.formModalBgImage, { objectFit: 'cover', objectPosition: 'left center', backgroundSize: 'cover', backgroundPosition: 'left center' } as any]} resizeMode="cover" />
                <View style={styles.formModalBgOverlay} />
              </View>
              <View style={styles.formModalInner}>
                <Text style={styles.formModalTitle}>Neuen Verein anlegen</Text>
                {renderForm()}
                <View style={styles.formModalButtons}>
                  <TouchableOpacity style={styles.formModalCancelButton} onPress={() => setShowAddModal(false)}>
                    <Text style={styles.formModalCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formModalSaveButton} onPress={addClub}>
                    <Text style={styles.formModalSaveText}>Hinzufügen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade">
          <Pressable style={styles.formModalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={styles.formModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.formModalBgWrapper} pointerEvents="none">
                <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[styles.formModalBgImage, { objectFit: 'cover', objectPosition: 'left center', backgroundSize: 'cover', backgroundPosition: 'left center' } as any]} resizeMode="cover" />
                <View style={styles.formModalBgOverlay} />
              </View>
              <View style={styles.formModalInner}>
                <Text style={styles.formModalTitle}>Verein bearbeiten</Text>
                {renderForm()}
                <View style={styles.formModalButtons}>
                  <TouchableOpacity style={styles.formModalDeleteButton} onPress={() => selectedClub && deleteClub(selectedClub.id)}>
                    <Text style={styles.formModalDeleteText}>Löschen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formModalCancelButton} onPress={() => setShowEditModal(false)}>
                    <Text style={styles.formModalCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formModalSaveButton} onPress={updateClub}>
                    <Text style={styles.formModalSaveText}>Speichern</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 32,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#000',
    borderRadius: 16,
    width: '92%',
    maxWidth: 1100,
    flex: 1,
    maxHeight: 800,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 20,
  },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.85 },
  bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  loadingText: { padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    zIndex: 2,
  },
  headerTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  closeButtonText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },

  content: { flex: 1, padding: 16, zIndex: 2 },

  // Player Info — Header-Card im Spielerprofil-Stil
  detailHeader: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 0,
    marginBottom: 16,
    flexDirection: 'column',
  },
  detailHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  detailPhoto: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  detailPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  detailPhotoInitial: { fontSize: 42, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  detailHeaderCenter: { flex: 1, justifyContent: 'center' },
  detailHeaderName: {
    fontFamily: 'Josefin Sans',
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#fff',
  },
  detailHeaderClubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  detailHeaderClubLogo: { width: 44, height: 44, resizeMode: 'contain' },
  detailHeaderClubText: {
    fontFamily: 'Josefin Sans',
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  detailHeaderTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'right',
  },
  detailDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 16 },
  detailStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 16, paddingHorizontal: 40 },
  detailStatCol: { minWidth: 110, gap: 4, flex: 1, alignItems: 'center' },
  detailStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  detailStatValue: { fontSize: 13, fontWeight: '500', color: '#fff', textAlign: 'center' },
  playerHeaderLeft: { flex: 1 },
  playerHeaderRight: { alignItems: 'center', justifyContent: 'center' },
  playerFirstName: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  playerLastName: {
    fontFamily: 'Josefin Sans',
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#fff',
    lineHeight: 34,
  },
  playerMeta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  clubLogoHeader: { width: 44, height: 44, resizeMode: 'contain' },
  clubNameHeader: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 120,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  viewButton: {
    height: 26,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  viewButtonText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  addButton: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addButtonText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  // Kanban — detailCard-Stil
  kanbanContainer: { flexDirection: 'row', gap: 16, flex: 1 },
  kanbanColumn: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  kanbanColumnDropTarget: { borderWidth: 2, borderColor: '#22c55e', borderStyle: 'dashed' },
  kanbanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  kanbanTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  countBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  countText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  kanbanContent: { flex: 1 },
  emptyColumn: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 8, fontSize: 12 },
  
  // Club Card - mobile-konsistent (logo 36×36, padding 14, radius 12)
  clubCard: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    position: 'relative',
  },
  clubCardHighlighted: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderColor: '#94a3b8',
    borderWidth: 2,
  },
  reminderBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(234,179,8,0.2)',
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
    backgroundColor: 'rgba(234,179,8,0.2)',
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
  clubCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingRight: 60 },
  clubLogo: { width: 36, height: 36, borderRadius: 6, marginRight: 12, resizeMode: 'contain' },
  clubLogoPlaceholder: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  clubLogoText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  clubName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  clubCardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  clubCardIcon: { marginRight: 6, fontSize: 11 },
  clubCardText: { fontSize: 12, color: '#64748b' },
  clubNotes: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  
  // Table
  tableContainer: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 6, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
  tableHeaderCell: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableCell: { fontSize: 14, color: '#334155' },
  tableCellText: { fontWeight: '500' },
  tableLogo: { width: 24, height: 24, marginRight: 10, resizeMode: 'contain' },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  // Form Modal
  formModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  formModalContent: {
    backgroundColor: '#0a0f1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    width: '90%',
    maxWidth: 480,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 24,
  },
  formModalBgWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' },
  formModalBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.9 },
  formModalBgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  formModalInner: { padding: 24, zIndex: 1 },
  formModalTitle: { fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 18, textAlign: 'center' },
  formModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18, zIndex: -1 },
  formModalCancelButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
  formModalCancelText: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 11 },
  formModalSaveButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 1, borderColor: '#22c55e' },
  formModalSaveText: { color: '#fff', fontWeight: '600', fontSize: 11 },
  formModalDeleteButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', marginRight: 'auto' },
  formModalDeleteText: { color: '#ef4444', fontWeight: '600', fontSize: 11 },

  // Form
  formContainer: { gap: 10 },
  formScrollContainer: { maxHeight: 400 },
  formRow: { marginBottom: 14 },
  formLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  formInput: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingVertical: 4, paddingHorizontal: 16, fontSize: 13, color: '#fff' },
  formTextArea: { minHeight: 60, textAlignVertical: 'top', paddingVertical: 8, borderRadius: 12 },
  autocompleteContainer: { position: 'relative', zIndex: 300 },
  
  // Club Dropdown
  clubDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingVertical: 4, paddingHorizontal: 16, backgroundColor: '#000', minHeight: 30 },
  clubDropdownText: { fontSize: 13, color: '#fff', flex: 1, fontWeight: '500' },
  clubDropdownArrow: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 8 },
  clubSuggestionsList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, marginTop: 4 },
  clubSearchInput: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, color: '#fff' },
  clubSuggestionsScroll: { maxHeight: 240 },
  clubSuggestionItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  clubSuggestionItemSelected: { backgroundColor: 'rgba(255,255,255,0.08)' },
  clubSuggestionItemCustom: { backgroundColor: 'rgba(34,197,94,0.15)' },
  clubSuggestionText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  clubSuggestionTextSelected: { color: '#22c55e', fontWeight: '600' },
  clubSuggestionTextCustom: { fontSize: 13, color: '#22c55e', fontWeight: '600' },

  statusSelector: { flexDirection: 'row', gap: 6 },
  statusOption: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  statusOptionText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 },
  
  // Date Picker - unterschiedliche Breiten
  datePickerRow: { flexDirection: 'row', gap: 8 },
  datePickerFieldSmall: { position: 'relative', width: 80 },
  datePickerFieldMedium: { position: 'relative', width: 100 },
  dateDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#000', minHeight: 30 },
  dateDropdownText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  dateDropdownArrow: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  datePickerList: { position: 'absolute', top: '100%', left: 0, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6, maxHeight: 260, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, marginTop: 2, minWidth: 100 },
  datePickerScroll: { maxHeight: 180 },
  datePickerItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  datePickerItemSelected: { backgroundColor: 'rgba(255,255,255,0.08)' },
  datePickerItemText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  datePickerItemTextSelected: { color: '#22c55e', fontWeight: '600' },
  
  // Reminder Dropdown
  reminderDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: '#000',
    minHeight: 30,
  },
  reminderDropdownText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  reminderDropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    marginTop: 2,
    backgroundColor: '#000',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
  },
  reminderDropdownItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  reminderDropdownItemSelected: { backgroundColor: 'rgba(255,255,255,0.08)' },
  reminderDropdownItemText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  reminderDropdownItemTextSelected: { color: '#22c55e' },

  // ==================== MOBILE STYLES ====================
  mobileScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mobileScreenContent: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    maxHeight: '80%',
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
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  mobileBackButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mobileClubCardHighlighted: {
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  mobileClubAdvisor: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  mobileClubContact: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
  },
  mobileClubNotes: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mobileReminderBadge: {
    backgroundColor: 'rgba(234,179,8,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mobileReminderOverdue: {
    backgroundColor: '#fecaca',
  },
  mobileReminderToday: {
    backgroundColor: 'rgba(234,179,8,0.2)',
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
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    borderBottomColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
  },
  mobileModalDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },

  // Offer Document Styles
  uploadOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  uploadOfferButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  },
  offerDocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 6,
  },
  offerDocLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offerDocIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  offerDocName: {
    fontSize: 13,
    flex: 1,
  },
  offerDocDelete: {
    padding: 4,
    marginLeft: 8,
  },
  offerDocDeleteText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
