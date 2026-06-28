import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Modal, TextInput, Alert, Platform, Linking, Image, useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { AdvisorHeroHeader } from '../../components/AdvisorHeroHeader';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import { ColumnDef } from '../../types/tableColumns';
import { useTableColumns } from '../../hooks/useTableColumns';
import { TableHeader } from '../../components/table/TableHeader';
import { TableRow } from '../../components/table/TableRow';
import { useDialog } from '../../components/DialogProvider';

// --- Types ---

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
  league: string | null;
  provision: string | null;
  provision_documents: any[];
  contract_documents: any[];
  commission_shares: any[];
  contract_end: string | null;
  future_club: string | null;
}

interface Provision {
  id: string;
  player_id: string;
  season: string;
  amount: number;
  status: string;
  due_date: string | null;
}

interface DisplayRow {
  type: 'provision' | 'player_only' | 'no_provision';
  key: string;
  provisionId: string | null;
  player_id: string;
  first_name: string;
  last_name: string;
  club: string;
  league: string | null;
  provisionPercent: string | null;
  amount: number;
  status: string;
  due_date: string | null;
}

interface RateEntry {
  amount: string;
  day: number | null;
  month: number | null;
  year: number | null;
  status: string;
}

type SortField = 'name' | 'club' | 'league' | 'provision' | 'amount' | 'due';
type SortDirection = 'asc' | 'desc';

const FINANZEN_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', defaultFlex: 0.8, minWidth: 80 },
  { key: 'vorname', label: 'Vorname', defaultFlex: 0.8, minWidth: 70 },
  { key: 'club', label: 'Verein', defaultFlex: 0.9, minWidth: 90 },
  { key: 'league', label: 'Liga', defaultFlex: 1.1, minWidth: 100 },
  { key: 'provision', label: 'Provision (%)', defaultFlex: 0.7, minWidth: 70 },
  { key: 'amount', label: 'Summe (€)', defaultFlex: 1, minWidth: 90 },
  { key: 'due', label: 'Fälligkeit', defaultFlex: 0.9, minWidth: 90 },
];

const DOCUMENT_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', defaultFlex: 1, minWidth: 90 },
  { key: 'vorname', label: 'Vorname', defaultFlex: 1, minWidth: 80 },
  { key: 'club', label: 'Verein', defaultFlex: 1.4, minWidth: 130 },
  { key: 'doc_type', label: 'Art', defaultFlex: 1.2, minWidth: 130 },
  { key: 'created', label: 'Datum', defaultFlex: 0.9, minWidth: 100 },
  { key: 'signed', label: 'Signiert', defaultFlex: 0.7, minWidth: 80 },
  { key: 'actions', label: 'Aktionen', defaultFlex: 0.3, minWidth: 60, fixedWidth: 60 },
];

type DocsSortField = 'name' | 'vorname' | 'club' | 'doc_type' | 'created' | 'signed';

type DocType = 'Provisionsvereinbarung' | 'Wegvermittlung';

interface FinanceDocument {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
  uploaded_by: string | null;
  player_id: string | null;
  doc_type: DocType | null;
  signed: boolean;
  signed_path: string | null;
  target_club: string | null;
  uploader_name?: string;
  player_first_name?: string | null;
  player_last_name?: string | null;
  player_club?: string | null;
  player_future_club?: string | null;
}

interface PlayerLite {
  id: string;
  first_name: string;
  last_name: string;
  club: string | null;
  future_club?: string | null;
}

// --- Constants ---

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

// --- Helpers ---

function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 7) return `${year}/${(year + 1).toString().slice(2)}`;
  return `${year - 1}/${year.toString().slice(2)}`;
}

function getSeasonOptions(): string[] {
  const seasons: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    seasons.push(`${y}/${(y + 1).toString().slice(2)}`);
  }
  return seasons;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDateDE(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

function buildIsoDate(day: number | null, month: number | null, year: number | null): string | null {
  if (!day || month === null || !year) return null;
  return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function getSeasonDates(season: string): { start: Date; end: Date } {
  const startYear = parseInt(season.split('/')[0]);
  return { start: new Date(startYear, 6, 1), end: new Date(startYear + 1, 5, 30) };
}

function findSalaryForSeason(salaryPeriods: any[], season: string): { monthlySalary: number; monthsInSeason: number } | null {
  if (!salaryPeriods || salaryPeriods.length === 0) return null;
  const { start: seasonStart, end: seasonEnd } = getSeasonDates(season);
  for (const period of salaryPeriods) {
    const from = period.from_date ? new Date(period.from_date) : null;
    const to = period.to_date ? new Date(period.to_date) : null;
    if (from && from <= seasonEnd && (!to || to >= seasonStart)) {
      const amountStr = (period.amount || '').replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.');
      const monthly = parseFloat(amountStr) || 0;
      if (monthly > 0) {
        const effectiveStart = from > seasonStart ? from : seasonStart;
        const effectiveEnd = (to && to < seasonEnd) ? to : seasonEnd;
        const months = Math.max(1, Math.round(
          (effectiveEnd.getTime() - effectiveStart.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
        ));
        return { monthlySalary: monthly, monthsInSeason: Math.min(months, 12) };
      }
    }
  }
  return null;
}

// --- Component ---

export function FinanzenScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, profile: authProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();

  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(getCurrentSeason());
  const [players, setPlayers] = useState<Player[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  // Spieler, die in der gewählten Saison bewusst "keine Provision" haben.
  const [noProvisionIds, setNoProvisionIds] = useState<Set<string>>(new Set());
  // "Externen" Provisions-Spieler anlegen (nicht betreut, aber Provision).
  const [showAddProv, setShowAddProv] = useState(false);
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addClub, setAddClub] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Table columns (drag & drop + resize)
  const [tableWidth, setTableWidth] = useState(0);
  const table = useTableColumns(FINANZEN_COLUMNS, tableWidth, 'finanzen');

  // --- Dokumente-Tab ---
  type FinanzenTab = 'finanzen' | 'dokumente';
  const [activeTab, setActiveTab] = useState<FinanzenTab>('dokumente');
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  // Fenstergröße abzgl. Sidebar (240) + Content-Padding (48) + Wrapper-Padding (32).
  // Wir nutzen das als Fallback falls onLayout des Wrappers beim Tab-Switch nicht
  // zuverlässig feuert — passiert auf manchen RN-Web-Builds, dann zog der
  // Default-Wert von 1000 die Spalten so klein, dass rechts massiv Platz blieb.
  const { width: windowWidth } = useWindowDimensions();
  const estimatedDocsWidth = Math.max(800, windowWidth - (isMobile ? 32 : 320));
  const [docsTableWidth, setDocsTableWidth] = useState(estimatedDocsWidth);
  // Bei jedem Window-Resize die Tabellenbreite anpassen. onLayout würde auf
  // RN-Web nicht zuverlässig auf Resize feuern, deshalb übersteuern wir hier
  // bewusst sofort — onLayout kann danach ggf. mit der präzisen Messung
  // nachjustieren.
  useEffect(() => {
    setDocsTableWidth(estimatedDocsWidth);
  }, [estimatedDocsWidth]);
  // _v4 invalidiert die alten gespeicherten Breiten/Reihenfolgen aus localStorage.
  const docsTable = useTableColumns(DOCUMENT_COLUMNS, docsTableWidth, 'finanzen_dokumente_v4');

  // Upload-Modal (PDF + Spieler-Pick + Art)
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [pendingPickedFile, setPendingPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [docPlayerSearch, setDocPlayerSearch] = useState('');
  const [docSelectedPlayer, setDocSelectedPlayer] = useState<PlayerLite | null>(null);
  const [docSelectedType, setDocSelectedType] = useState<DocType | null>(null);
  // Ziel-Verein: 'current' = aktueller Verein, 'future' = bereits gesetzter future_club,
  // 'new' = Berater hat im Dialog einen neuen Verein eingegeben (wird ins Spielerprofil übernommen)
  const [docTargetClubChoice, setDocTargetClubChoice] = useState<'current' | 'future' | 'new'>('current');
  const [docNewFutureClubInput, setDocNewFutureClubInput] = useState('');
  // Transfermarkt-Club-Suche fürs "Neuer Verein"-Input
  const [docClubSearchResults, setDocClubSearchResults] = useState<Array<{ name: string; logoUrl?: string; liga?: string; country?: string }>>([]);
  const [docClubSearching, setDocClubSearching] = useState(false);
  const [docShowClubDropdown, setDocShowClubDropdown] = useState(false);
  const docClubSearchTimeout = useRef<any>(null);
  const [allPlayersLite, setAllPlayersLite] = useState<PlayerLite[]>([]);

  // Transfermarkt-Suche für Vereine (analog zu TransfersScreen.searchClubsRemote)
  const searchClubsRemote = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setDocClubSearchResults([]); return; }
    setDocClubSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-club', { body: { query } });
      if (error) { setDocClubSearchResults([]); return; }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.results && Array.isArray(parsed.results)) {
        setDocClubSearchResults(parsed.results);
      } else {
        setDocClubSearchResults([]);
      }
    } catch (e) {
      console.error('Club search exception:', e);
      setDocClubSearchResults([]);
    } finally {
      setDocClubSearching(false);
    }
  }, []);

  const handleDocClubSearchChange = (text: string) => {
    setDocNewFutureClubInput(text);
    setDocTargetClubChoice(text.trim() ? 'new' : 'current');
    setDocShowClubDropdown(true);
    if (docClubSearchTimeout.current) clearTimeout(docClubSearchTimeout.current);
    docClubSearchTimeout.current = setTimeout(() => searchClubsRemote(text), 400);
  };

  const selectDocClub = (club: { name: string; logoUrl?: string }) => {
    setDocNewFutureClubInput(club.name);
    setDocTargetClubChoice('new');
    setDocShowClubDropdown(false);
    setDocClubSearchResults([]);
    if (club.name && club.logoUrl) {
      // Logo direkt cachen, damit die Liste das Logo nach dem Upload sofort hat
      setClubLogos(prev => ({ ...prev, [club.name]: club.logoUrl! }));
    }
  };

  // Reset bei Spielerwechsel (input leeren, Default neu setzen).
  useEffect(() => {
    if (!docSelectedPlayer) return;
    if (docSelectedPlayer.future_club && docSelectedType === 'Provisionsvereinbarung') {
      setDocTargetClubChoice('future');
    } else {
      setDocTargetClubChoice('current');
    }
    setDocNewFutureClubInput('');
    setDocClubSearchResults([]);
    setDocShowClubDropdown(false);
  }, [docSelectedPlayer?.id]);

  // Beim Typ-Wechsel nur den Default zwischen current/future anpassen — aber
  // niemals einen vom User bereits eingegebenen "neuen Verein" überschreiben.
  useEffect(() => {
    if (!docSelectedPlayer) return;
    if (docNewFutureClubInput.trim()) return; // User hat manuell was getippt → in Ruhe lassen
    if (docSelectedPlayer.future_club && docSelectedType === 'Provisionsvereinbarung') {
      setDocTargetClubChoice('future');
    } else {
      setDocTargetClubChoice('current');
    }
  }, [docSelectedType]);

  // Vereinslogos für die Verein-Spalte
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (Object.keys(clubLogos).length > 0) return;
    (async () => {
      const { data } = await supabase.from('club_logos').select('club_name, logo_url');
      if (data) {
        const map: Record<string, string> = {};
        for (const c of data as any[]) map[c.club_name] = c.logo_url;
        setClubLogos(map);
      }
    })();
  }, [clubLogos]);

  const getClubLogo = (clubName: string | null | undefined): string | null => {
    if (!clubName) return null;
    // Jugend-/Reserve-Teams nutzen das Vereinswappen; TM-Jugend-Logos sind oft leer
    // → zuerst den Stammverein versuchen (Suffixe U17/II/Jugend etc. entfernen).
    const base = clubName
      .replace(/\s+U[- ]?\d{1,2}\b.*$/i, '')
      .replace(/\s+(?:A|B|C)[- ]?Jugend\b.*$/i, '')
      .replace(/\s+(?:II|III|Jugend|Reserve)\b.*$/i, '')
      .trim();
    if (base && base !== clubName && clubLogos[base]) return clubLogos[base];
    if (clubLogos[clubName]) return clubLogos[clubName];
    for (const [k, v] of Object.entries(clubLogos)) {
      if (base.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(base.toLowerCase())) return v;
    }
    return null;
  };

  // Suche
  const [docSearchText, setDocSearchText] = useState('');

  // Sortierung
  const [docsSortField, setDocsSortField] = useState<DocsSortField>('created');
  const [docsSortDirection, setDocsSortDirection] = useState<SortDirection>('desc');
  const handleDocsSort = (field: DocsSortField) => {
    if (docsSortField === field) {
      setDocsSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setDocsSortField(field);
      setDocsSortDirection('asc');
    }
  };
  const sortedDocuments = useMemo(() => {
    const q = docSearchText.trim().toLowerCase();
    const filtered = q
      ? documents.filter(d => {
          const hay = [d.player_first_name, d.player_last_name, d.target_club || d.player_club, d.doc_type, d.filename]
            .map(s => (s ?? '').toString().toLowerCase())
            .join(' ');
          return hay.includes(q);
        })
      : documents;
    const arr = [...filtered];
    const dir = docsSortDirection === 'asc' ? 1 : -1;
    const cmp = (a: any, b: any): number => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
      return String(a).localeCompare(String(b), 'de') * dir;
    };
    arr.sort((a, b) => {
      switch (docsSortField) {
        case 'name': return cmp(a.player_last_name, b.player_last_name);
        case 'vorname': return cmp(a.player_first_name, b.player_first_name);
        case 'club': return cmp(a.target_club || a.player_club, b.target_club || b.player_club);
        case 'doc_type': return cmp(a.doc_type, b.doc_type);
        case 'created': return cmp(a.created_at, b.created_at);
        case 'signed': return cmp(a.signed ? 1 : 0, b.signed ? 1 : 0);
        default: return 0;
      }
    });
    return arr;
  }, [documents, docsSortField, docsSortDirection, docSearchText]);

  // Lite-Spielerliste einmalig laden (für Autocomplete im Upload-Modal)
  useEffect(() => {
    if (activeTab !== 'dokumente' || allPlayersLite.length > 0) return;
    (async () => {
      const { data } = await supabase
        .from('player_details')
        .select('id, first_name, last_name, club, future_club')
        .order('last_name', { ascending: true });
      setAllPlayersLite((data || []) as any);
    })();
  }, [activeTab, allPlayersLite.length]);

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    const { data, error } = await supabase
      .from('finance_documents')
      .select('id, filename, storage_path, size_bytes, created_at, uploaded_by, player_id, doc_type, signed, signed_path, target_club')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchDocuments error:', error);
      setDocumentsLoading(false);
      return;
    }
    const advisorIds = Array.from(new Set((data || []).map((d: any) => d.uploaded_by).filter(Boolean))) as string[];
    const playerIds = Array.from(new Set((data || []).map((d: any) => d.player_id).filter(Boolean))) as string[];

    let nameMap = new Map<string, string>();
    if (advisorIds.length > 0) {
      const { data: advisors } = await supabase
        .from('advisors')
        .select('id, first_name, last_name')
        .in('id', advisorIds);
      for (const a of advisors || []) {
        nameMap.set(a.id, `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || '—');
      }
    }

    let playerMap = new Map<string, PlayerLite>();
    if (playerIds.length > 0) {
      const { data: players } = await supabase
        .from('player_details')
        .select('id, first_name, last_name, club, future_club')
        .in('id', playerIds);
      for (const p of players || []) playerMap.set(p.id, p as any);
    }

    const enriched: FinanceDocument[] = (data || []).map((d: any) => {
      const player = d.player_id ? playerMap.get(d.player_id) : null;
      return {
        ...d,
        uploader_name: d.uploaded_by ? (nameMap.get(d.uploaded_by) || '—') : '—',
        player_first_name: player?.first_name || null,
        player_last_name: player?.last_name || null,
        player_club: player?.club || null,
        player_future_club: (player as any)?.future_club || null,
      };
    });
    setDocuments(enriched);
    setDocumentsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'dokumente') {
      fetchDocuments();
    }
  }, [activeTab, fetchDocuments]);

  // Schritt 1: File-Picker. Bei Erfolg → Upload-Modal öffnen, in dem
  // Spieler + Art gewählt werden, bevor wir wirklich hochladen.
  const startDocumentUpload = async () => {
    if (uploadingDoc) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      setPendingPickedFile(result.assets[0]);
      setDocPlayerSearch('');
      setDocSelectedPlayer(null);
      setDocSelectedType(null);
      setShowDocUploadModal(true);
    } catch (e: any) {
      alertDialog({ title: 'Fehler', message: e?.message || 'Datei konnte nicht ausgewählt werden.' });
    }
  };

  const confirmDocumentUpload = async () => {
    if (!pendingPickedFile || !docSelectedPlayer || !docSelectedType) {
      alertDialog({ title: 'Eingabe fehlt', message: 'Bitte Spieler und Art auswählen.' });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alertDialog({ title: 'Nicht eingeloggt', message: 'Bitte erneut anmelden.' });
      return;
    }
    setUploadingDoc(true);
    try {
      const asset = pendingPickedFile;
      const ext = (asset.name?.split('.').pop() || 'pdf').toLowerCase();
      const id = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const storagePath = `finance/${id}.${ext}`;

      let fileData: any;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        fileData = await resp.blob();
      } else {
        fileData = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/pdf' };
      }

      const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, fileData, {
        contentType: asset.mimeType || 'application/pdf',
        upsert: false,
      });
      if (upErr) {
        alertDialog({ title: 'Upload fehlgeschlagen', message: upErr.message });
        setUploadingDoc(false);
        return;
      }

      // Ziel-Verein bestimmen: bei 'new' wird der eingegebene Verein zusätzlich
      // im Spielerprofil als future_club gespeichert (gewünschter Sync-Effekt).
      let targetClub: string | null = null;
      if (docTargetClubChoice === 'future') {
        targetClub = docSelectedPlayer.future_club ?? null;
      } else if (docTargetClubChoice === 'new' && docNewFutureClubInput.trim()) {
        const newClub = docNewFutureClubInput.trim();
        targetClub = newClub;
        const { error: updErr } = await supabase
          .from('player_details')
          .update({ future_club: newClub })
          .eq('id', docSelectedPlayer.id);
        if (updErr) {
          console.warn('future_club update fehlgeschlagen:', updErr.message);
        }
      } else {
        targetClub = docSelectedPlayer.club ?? null;
      }

      const { error: insErr } = await supabase.from('finance_documents').insert({
        uploaded_by: user.id,
        player_id: docSelectedPlayer.id,
        doc_type: docSelectedType,
        filename: asset.name || 'Dokument.pdf',
        storage_path: storagePath,
        size_bytes: asset.size || null,
        mime_type: asset.mimeType || 'application/pdf',
        target_club: targetClub,
      });
      if (insErr) {
        await supabase.storage.from('documents').remove([storagePath]);
        alertDialog({ title: 'Fehler beim Speichern', message: insErr.message });
        setUploadingDoc(false);
        return;
      }

      setShowDocUploadModal(false);
      setPendingPickedFile(null);
      setDocSelectedPlayer(null);
      setDocSelectedType(null);
      setDocPlayerSearch('');
      setDocTargetClubChoice('current');
      setDocNewFutureClubInput('');
      setDocClubSearchResults([]);
      setDocShowClubDropdown(false);
      await fetchDocuments();
    } catch (e: any) {
      console.error('uploadDocument error:', e);
      alertDialog({ title: 'Fehler', message: e?.message || 'Unbekannter Fehler beim Upload.' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const toggleDocSigned = async (doc: FinanceDocument) => {
    const next = !doc.signed;
    // Aktives Un-Signieren ist destruktiv (signierte PDF wird gelöscht) — daher
    // Confirm-Dialog. Vom unsigniert → signiert ist kein Dialog nötig, weil das
    // bisher nur den Status-Flag setzt (das eigentliche Signieren läuft über
    // das Drag-and-Drop-Modal).
    if (!next) {
      const ok = await confirmDialog({
        title: 'Signatur entfernen?',
        message: 'Die hinterlegte Signatur wird aus dem Dokument gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
        danger: true,
        confirmLabel: 'Signatur entfernen',
      });
      if (!ok) return;
    }
    // Beim Zurücksetzen auf "unsigniert" auch die alte signierte PDF aufräumen,
    // damit beim erneuten Signieren nichts Altes mehr im Storage hängt.
    const update: any = { signed: next };
    if (!next) update.signed_path = null;
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, signed: next, signed_path: next ? d.signed_path : null } : d));
    const { error } = await supabase.from('finance_documents').update(update).eq('id', doc.id);
    if (error) {
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, signed: !next, signed_path: doc.signed_path } : d));
      alertDialog({ title: 'Fehler', message: error.message });
      return;
    }
    if (!next && doc.signed_path) {
      await supabase.storage.from('documents').remove([doc.signed_path]);
    }
  };

  const [signingDocId, setSigningDocId] = useState<string | null>(null);

  // --- Signier-Modal mit Drag-and-Drop ---
  const SIGN_RENDER_SCALE = 1.5;       // PDF-Punkte → CSS-Pixel
  const SIGN_DEFAULT_WIDTH_PT = 140;   // Standardbreite der Signatur in PDF-Pt
  const [signModalDoc, setSignModalDoc] = useState<FinanceDocument | null>(null);
  const [signLoading, setSignLoading] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signPdfDoc, setSignPdfDoc] = useState<any>(null);
  const [signTotalPages, setSignTotalPages] = useState(0);
  const [signCurrentPage, setSignCurrentPage] = useState(1);
  const [signPageImage, setSignPageImage] = useState<string | null>(null);
  const [signPagePtSize, setSignPagePtSize] = useState<{ w: number; h: number } | null>(null);
  // Pixel-Top-Left der Signatur im aktuellen Page-Canvas
  const [signSigPx, setSignSigPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [signSigSizePx, setSignSigSizePx] = useState<{ w: number; h: number }>({ w: SIGN_DEFAULT_WIDTH_PT * SIGN_RENDER_SCALE, h: 60 });
  const [signaturePngUrl, setSignaturePngUrl] = useState<string | null>(null);
  const [signSubmitting, setSignSubmitting] = useState(false);
  const signDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const signResizeRef = useRef<{ startX: number; startW: number; startH: number; aspect: number } | null>(null);
  const signPageDivRef = useRef<any>(null); // Page-Container, um die tatsächliche Render-Größe abzulesen

  // pdf.js dynamisch laden (Web-only Modal)
  const loadPdfJs = async (): Promise<any> => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise<any>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error('pdfjsLib nicht verfügbar'));
        }
      };
      s.onerror = () => reject(new Error('pdf.js konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
  };

  const renderSignPage = async (pdfDoc: any, pageNum: number, sigAspectRatio = 0.4) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: SIGN_RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    setSignPageImage(dataUrl);
    setSignPagePtSize({ w: viewport.width / SIGN_RENDER_SCALE, h: viewport.height / SIGN_RENDER_SCALE });
    // Signatur initial: unten rechts mit etwas Padding
    const sigWPx = SIGN_DEFAULT_WIDTH_PT * SIGN_RENDER_SCALE;
    const sigHPx = sigWPx * sigAspectRatio;
    setSignSigSizePx({ w: sigWPx, h: sigHPx });
    setSignSigPx({
      x: viewport.width - sigWPx - 50 * SIGN_RENDER_SCALE,
      y: viewport.height - sigHPx - 50 * SIGN_RENDER_SCALE,
    });
  };

  const openSignModal = async (doc: FinanceDocument) => {
    setSignModalDoc(doc);
    setSignLoading(true);
    setSignError(null);
    setSignPageImage(null);
    try {
      // Signatur des Beraters laden (Aspect Ratio für Default-Größe)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSignError('Nicht eingeloggt.');
        return;
      }
      const { data: sig } = await supabase.from('advisor_signatures').select('storage_path').eq('advisor_id', user.id).maybeSingle();
      if (!sig?.storage_path) {
        setSignError('Du musst erst im Profil eine Signatur hochladen.');
        return;
      }
      const { data: sigUrl } = await supabase.storage.from('documents').createSignedUrl(sig.storage_path, 60 * 10);
      setSignaturePngUrl(sigUrl?.signedUrl || null);

      // Aspect Ratio des PNGs für Default-Höhe
      const aspectRatio = await new Promise<number>((resolve) => {
        if (!sigUrl?.signedUrl) { resolve(0.4); return; }
        const img = new (window as any).Image();
        img.onload = () => resolve(img.naturalHeight / img.naturalWidth);
        img.onerror = () => resolve(0.4);
        img.src = sigUrl.signedUrl;
      });

      // PDF laden
      const pdfJs = await loadPdfJs();
      if (!pdfJs) {
        setSignError('PDF-Viewer konnte nicht geladen werden.');
        return;
      }
      const { data: docUrl } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60 * 10);
      if (!docUrl?.signedUrl) {
        setSignError('PDF konnte nicht geladen werden.');
        return;
      }
      const pdfDoc = await pdfJs.getDocument(docUrl.signedUrl).promise;
      setSignPdfDoc(pdfDoc);
      setSignTotalPages(pdfDoc.numPages);
      const lastPage = pdfDoc.numPages;
      setSignCurrentPage(lastPage);
      await renderSignPage(pdfDoc, lastPage, aspectRatio);
    } catch (e: any) {
      setSignError(e?.message || 'Fehler beim Laden des PDFs.');
    } finally {
      setSignLoading(false);
    }
  };

  const goToSignPage = async (pageNum: number) => {
    if (!signPdfDoc || pageNum < 1 || pageNum > signTotalPages) return;
    setSignCurrentPage(pageNum);
    const ratio = signSigSizePx.w > 0 ? signSigSizePx.h / signSigSizePx.w : 0.4;
    await renderSignPage(signPdfDoc, pageNum, ratio);
  };

  const closeSignModal = () => {
    setSignModalDoc(null);
    setSignPdfDoc(null);
    setSignPageImage(null);
    setSignPagePtSize(null);
    setSignError(null);
    setSignaturePngUrl(null);
  };

  const onSignDragStart = (e: any) => {
    e.preventDefault?.();
    const clientX = e.clientX ?? e.nativeEvent?.pageX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.pageY ?? 0;
    signDragRef.current = { startX: clientX, startY: clientY, origX: signSigPx.x, origY: signSigPx.y };
    const onMove = (ev: any) => {
      if (!signDragRef.current || !signPagePtSize) return;
      const dx = ev.clientX - signDragRef.current.startX;
      const dy = ev.clientY - signDragRef.current.startY;
      const pageWidthPx = signPagePtSize.w * SIGN_RENDER_SCALE;
      const pageHeightPx = signPagePtSize.h * SIGN_RENDER_SCALE;
      const newX = Math.max(0, Math.min(pageWidthPx - signSigSizePx.w, signDragRef.current.origX + dx));
      const newY = Math.max(0, Math.min(pageHeightPx - signSigSizePx.h, signDragRef.current.origY + dy));
      setSignSigPx({ x: newX, y: newY });
    };
    const onUp = () => {
      signDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resize via Eck-Handle. Aspect Ratio bleibt erhalten, damit die Signatur
  // sich nicht verzerrt. Begrenzt durch Page-Ränder ab der aktuellen Position.
  const onSignResizeStart = (e: any) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    if (!signPagePtSize) return;
    const clientX = e.clientX ?? 0;
    const startW = signSigSizePx.w;
    const startH = signSigSizePx.h;
    const aspect = startW > 0 ? startH / startW : 0.4;
    signResizeRef.current = { startX: clientX, startW, startH, aspect };
    const onMove = (ev: any) => {
      if (!signResizeRef.current || !signPagePtSize) return;
      const dx = ev.clientX - signResizeRef.current.startX;
      const pageWidthPx = signPagePtSize.w * SIGN_RENDER_SCALE;
      const pageHeightPx = signPagePtSize.h * SIGN_RENDER_SCALE;
      const minW = 40;
      const maxWByX = pageWidthPx - signSigPx.x;
      let newW = Math.max(minW, Math.min(maxWByX, signResizeRef.current.startW + dx));
      let newH = newW * signResizeRef.current.aspect;
      if (signSigPx.y + newH > pageHeightPx) {
        newH = pageHeightPx - signSigPx.y;
        newW = signResizeRef.current.aspect > 0 ? newH / signResizeRef.current.aspect : newW;
      }
      setSignSigSizePx({ w: newW, h: newH });
    };
    const onUp = () => {
      signResizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const submitSignDocument = async () => {
    if (!signModalDoc || !signPagePtSize || signSubmitting) return;
    setSignSubmitting(true);
    try {
      // Effektive Render-Skala aus der tatsächlich gerenderten Container-Breite
      // ableiten — falls der Modal kleiner ist als die natürliche Page und
      // CSS das div geschrumpft hat (sollte mit dem flexShrink-Fix nicht mehr
      // passieren, aber zur Sicherheit messen wir hier real).
      let effectiveScale = SIGN_RENDER_SCALE;
      try {
        const rect = signPageDivRef.current?.getBoundingClientRect?.();
        if (rect && rect.width > 0) {
          effectiveScale = rect.width / signPagePtSize.w;
        }
      } catch {}

      const xPt = signSigPx.x / effectiveScale;
      // pdf.js: top-left origin; pdf-lib: bottom-left origin. Flip Y.
      const sigHPt = signSigSizePx.h / effectiveScale;
      const sigWPt = signSigSizePx.w / effectiveScale;
      const yPt = signPagePtSize.h - (signSigPx.y / effectiveScale) - sigHPt;

      const debugInfo = {
        SIGN_RENDER_SCALE,
        effectiveScale,
        signSigPx,
        signSigSizePx,
        signPagePtSize,
        derived: { xPt, yPt, sigWPt, sigHPt },
        signCurrentPage,
        signTotalPages,
      };
      // eslint-disable-next-line no-console
      console.log('[sign-document client debug]', debugInfo);
      const { data, error } = await supabase.functions.invoke('sign-document', {
        body: {
          document_id: signModalDoc.id,
          page: signCurrentPage,
          x_pt: xPt,
          y_pt: yPt,
          width_pt: sigWPt,
          height_pt: sigHPt,
          // Viewport-Maße vom Client mitschicken, damit die Edge-Function
          // verifizieren kann, ob ihre cropBox/Rotation-Annahmen zur tatsächlich
          // gerenderten Page passen.
          viewport_w_pt: signPagePtSize.w,
          viewport_h_pt: signPagePtSize.h,
        },
      });
      // eslint-disable-next-line no-console
      console.log('[sign-document server response]', data, error);
      if (error || data?.error) {
        alertDialog({ title: 'Fehler beim Signieren', message: error?.message || data?.error || 'Unbekannter Fehler' });
        return;
      }
      closeSignModal();
      await fetchDocuments();
    } catch (e: any) {
      alertDialog({ title: 'Fehler', message: e?.message || String(e) });
    } finally {
      setSignSubmitting(false);
    }
  };

  const signDocument = (doc: FinanceDocument) => {
    if (signingDocId) return;
    openSignModal(doc);
  };

  const openDocument = async (doc: FinanceDocument) => {
    // Falls signiert: signiertes PDF zeigen, sonst Original
    const path = doc.signed && doc.signed_path ? doc.signed_path : doc.storage_path;
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      alertDialog({ title: 'Fehler', message: error?.message || 'Link konnte nicht erzeugt werden.' });
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(data.signedUrl, '_blank');
    } else {
      Linking.openURL(data.signedUrl);
    }
  };

  const downloadDocument = async (doc: FinanceDocument) => {
    const path = doc.signed && doc.signed_path ? doc.signed_path : doc.storage_path;
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(
      path,
      60 * 10,
      { download: doc.filename }
    );
    if (error || !data?.signedUrl) {
      alertDialog({ title: 'Fehler', message: error?.message || 'Link konnte nicht erzeugt werden.' });
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(data.signedUrl, '_blank');
    } else {
      Linking.openURL(data.signedUrl);
    }
  };

  const deleteDocument = async (doc: FinanceDocument) => {
    const ok = await confirmDialog({
      title: 'Dokument löschen',
      message: `"${doc.filename}" wirklich löschen?`,
      danger: true,
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    const prev = documents;
    setDocuments(prev.filter(d => d.id !== doc.id));
    const { error } = await supabase.from('finance_documents').delete().eq('id', doc.id);
    if (error) {
      setDocuments(prev);
      alertDialog({ title: 'Fehler beim Löschen', message: error.message });
      return;
    }
    // Storage-Datei mit weg (best-effort; falls fehlschlägt, ist's nur ein Orphan)
    await supabase.storage.from('documents').remove([doc.storage_path]);
  };

  const formatBytes = (b: number | null): string => {
    if (!b || b <= 0) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Inline status toggle
  const cycleStatus = async (provId: string, currentStatus: string) => {
    const nextMap: Record<string, string> = { 'offen': 'in rechnung gestellt', 'in rechnung gestellt': 'bezahlt', 'bezahlt': 'offen' };
    await supabase.from('player_provisions').update({ status: nextMap[currentStatus] || 'offen' }).eq('id', provId);
    fetchData();
  };

  // --- Detail Modal State ---
  const [showDetail, setShowDetail] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState<string>('');
  const [detailProvPercent, setDetailProvPercent] = useState('');
  const [detailTotalAmount, setDetailTotalAmount] = useState('');
  const [detailRateCount, setDetailRateCount] = useState<number | null>(null);
  const [detailRates, setDetailRates] = useState<RateEntry[]>([]);
  const [detailCurrency, setDetailCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [showRateDropdown, setShowRateDropdown] = useState(false);
  const [showProvisionDropdown, setShowProvisionDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  // "Keine Provision" als Auswahl im Provisions-Dropdown (statt separatem Button).
  const [detailNoProvision, setDetailNoProvision] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<{ rateIdx: number; part: 'day' | 'month' | 'year' } | null>(null);
  const [detailProvDocs, setDetailProvDocs] = useState<any[]>([]);
  const [detailContractDocs, setDetailContractDocs] = useState<any[]>([]);
  const [detailShares, setDetailShares] = useState<{ name: string; percentage: string; type: string; notes: string }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [detailAnnualSalary, setDetailAnnualSalary] = useState('');
  const [detailMonthlySalaryStr, setDetailMonthlySalaryStr] = useState('');
  const [detailProvBasis, setDetailProvBasis] = useState('');
  const [detailProvSalaryMonths, setDetailProvSalaryMonths] = useState<number | null>(null);
  const [detailContractSalaryPeriods, setDetailContractSalaryPeriods] = useState<any[]>([]);
  const [detailMonthlySalary, setDetailMonthlySalary] = useState<number>(0);

  // --- Data Loading ---

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Jeder Berater sieht NUR seine eigenen Provisionen (Zuständigkeit = sein voller Name).
    const fn = (authProfile?.first_name || '').trim();
    const ln = (authProfile?.last_name || '').trim();
    const fullName = `${fn} ${ln}`.trim();
    if (!fullName) { setPlayers([]); setProvisions([]); setNoProvisionIds(new Set()); setLoading(false); return; }
    const [playersRes, provsRes, noProvRes] = await Promise.all([
      supabase
        .from('player_details')
        .select('id, first_name, last_name, club, league, provision, provision_documents, contract_documents, commission_shares, contract_end, future_club')
        .ilike('responsibility', `%${fullName}%`)
        .order('last_name'),
      supabase
        .from('player_provisions')
        .select('id, player_id, season, amount, status, due_date')
        .eq('season', season),
      supabase
        .from('player_no_provision')
        .select('player_id')
        .eq('season', season),
    ]);
    if (playersRes.data) setPlayers(playersRes.data);
    if (provsRes.data) setProvisions(provsRes.data);
    setNoProvisionIds(new Set((noProvRes.data || []).map((r: any) => r.player_id)));
    setLoading(false);
  }, [season, authProfile?.first_name, authProfile?.last_name]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Build Display Rows ---

  const displayRows: DisplayRow[] = useMemo(() => {
    const rows: DisplayRow[] = [];
    const playerIdsWithProv = new Set<string>();
    // In zukünftigen Saisons den neuen Verein (future_club) anzeigen — ab der ersten
    // Saison NACH der aktuellen. Unabhängig vom aktuellen Vertragsende, da ein Wechsel
    // auch mitten im laufenden Vertrag passieren kann (z.B. Slamar: Vertrag bis 2028,
    // wechselt aber zur Saison 26/27).
    const seasonStartYear = parseInt(String(season).split('/')[0], 10);
    const currentSeasonStartYear = parseInt(getCurrentSeason().split('/')[0], 10);
    const usesFuture = (pl: Player) => !!(pl.future_club && !isNaN(seasonStartYear) && !isNaN(currentSeasonStartYear) && seasonStartYear > currentSeasonStartYear);
    const effClub = (pl: Player) => usesFuture(pl) ? (pl.future_club as string) : pl.club;
    const effLeague = (pl: Player) => usesFuture(pl) ? '' : pl.league;
    for (const prov of provisions) {
      const player = players.find(p => p.id === prov.player_id);
      if (!player) continue;
      playerIdsWithProv.add(prov.player_id);
      rows.push({
        type: 'provision', key: prov.id, provisionId: prov.id, player_id: prov.player_id,
        first_name: player.first_name, last_name: player.last_name, club: effClub(player),
        league: effLeague(player), provisionPercent: player.provision, amount: Number(prov.amount) || 0,
        status: prov.status || 'offen', due_date: prov.due_date,
      });
    }
    for (const player of players) {
      if (playerIdsWithProv.has(player.id)) continue;
      const isNoProv = noProvisionIds.has(player.id);
      rows.push({
        type: isNoProv ? 'no_provision' : 'player_only', key: `p_${player.id}`, provisionId: null, player_id: player.id,
        first_name: player.first_name, last_name: player.last_name, club: effClub(player),
        league: effLeague(player), provisionPercent: player.provision, amount: 0, status: '', due_date: null,
      });
    }
    return rows;
  }, [players, provisions, season, noProvisionIds]);

  // --- Sort ---

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const sortedRows = useMemo(() => {
    const sorted = [...displayRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name); break;
        case 'club': cmp = (a.club || '').localeCompare(b.club || ''); break;
        case 'league': cmp = (a.league || '').localeCompare(b.league || ''); break;
        case 'provision': cmp = (parseFloat(a.provisionPercent || '0') || 0) - (parseFloat(b.provisionPercent || '0') || 0); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'due': cmp = (a.due_date || '9999').localeCompare(b.due_date || '9999'); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [displayRows, sortField, sortDirection]);

  // --- Totals ---

  const totals = useMemo(() => {
    let offen = 0, bezahlt = 0;
    for (const prov of provisions) {
      const player = players.find(p => p.id === prov.player_id);
      if (!player) continue;
      const amt = Number(prov.amount) || 0;
      if (prov.status === 'bezahlt') bezahlt += amt; else offen += amt;
    }
    return { offen, bezahlt, gesamt: offen + bezahlt };
  }, [provisions, players]);

  // --- Season ---

  const seasonOptions = getSeasonOptions();
  const changeSeason = (dir: number) => {
    const idx = seasonOptions.indexOf(season);
    const n = idx - dir;
    if (n >= 0 && n < seasonOptions.length) setSeason(seasonOptions[n]);
  };

  // --- Detail Modal Logic ---

  const openDetail = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Load existing provisions for this player + season
    const existing = provisions.filter(p => p.player_id === playerId);

    setDetailPlayerId(playerId);
    setDetailProvPercent(player.provision || '');
    setDetailNoProvision(noProvisionIds.has(playerId));
    setActiveDatePicker(null);
    setShowRateDropdown(false);
    setShowProvisionDropdown(false);
    setShowCurrencyDropdown(false);
    setDetailCurrency('EUR');
    setDetailAnnualSalary('');
    setDetailMonthlySalaryStr('');
    setDetailProvBasis('');
    setDetailProvSalaryMonths(null);
    setDetailContractSalaryPeriods([]);
    setDetailMonthlySalary(0);
    setDetailProvDocs(player.provision_documents || []);
    setDetailContractDocs(player.contract_documents || []);
    setDetailShares((player.commission_shares || []).map((s: any) => ({
      name: s.name || '', percentage: (s.percentage || '').toString(), type: s.type || 'abgabe', notes: s.notes || '',
    })));

    if (existing.length > 0) {
      setDetailRateCount(existing.length);
      const totalAmt = existing.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      setDetailTotalAmount(formatNumberInput(totalAmt.toString().replace('.', ',')));
      setDetailRates(existing.map(p => {
        const d = p.due_date ? new Date(p.due_date) : null;
        return {
          amount: formatNumberInput((Number(p.amount) || 0).toString().replace('.', ',')),
          day: d ? d.getDate() : null,
          month: d ? d.getMonth() : null,
          year: d ? d.getFullYear() : null,
          status: p.status || 'offen',
        };
      }));
    } else {
      setDetailRateCount(null);
      setDetailTotalAmount('');
      setDetailRates([]);
    }

    setShowDetail(true);
  };

  const updateRateCount = (count: number | null) => {
    setDetailRateCount(count);
    setShowRateDropdown(false);
    if (!count || count <= 0) {
      setDetailRates([]);
      return;
    }
    const total = parseFloat(detailTotalAmount.replace(/\./g, '').replace(',', '.')) || 0;
    const perRate = count > 0 ? formatNumberInput((total / count).toFixed(2).replace('.', ',')) : '';
    const newRates: RateEntry[] = [];
    for (let i = 0; i < count; i++) {
      if (i < detailRates.length) {
        newRates.push({ ...detailRates[i], amount: perRate });
      } else {
        newRates.push({ amount: perRate, day: null, month: null, year: null, status: 'offen' });
      }
    }
    setDetailRates(newRates);
  };

  // Tausenderpunkte (deutsch), ohne Nachkommastellen.
  const formatThousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Live-Formatierung beim Tippen: Tausenderpunkte für den Ganzzahl-Teil, Komma als
  // Dezimaltrenner ("1000000" → "1.000.000", "1234,5" → "1.234,5").
  const formatNumberInput = (raw: string): string => {
    let s = String(raw ?? '').replace(/[^\d,]/g, '');
    const firstComma = s.indexOf(',');
    if (firstComma !== -1) {
      s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '');
    }
    const [intPart, decPart] = s.split(',');
    const intFmt = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart !== undefined ? `${intFmt},${decPart}` : intFmt;
  };

  const updateTotalAmount = (val: string) => {
    const fmt = formatNumberInput(val);
    setDetailTotalAmount(fmt);
    const total = parseFloat(fmt.replace(/\./g, '').replace(',', '.')) || 0;
    const perRate = detailRateCount && detailRateCount > 0 ? formatNumberInput((total / detailRateCount).toFixed(2).replace('.', ',')) : '';
    setDetailRates(prev => prev.map(r => ({ ...r, amount: perRate })));
  };

  // Monatsgehalt eingeben → Jahresgehalt (× 12) automatisch; Gesamtsumme aktualisieren.
  const updateMonthlySalary = (val: string) => {
    const fmt = formatNumberInput(val);
    setDetailMonthlySalaryStr(fmt);
    const monthly = parseFloat(fmt.replace(/\./g, '').replace(',', '.')) || 0;
    const annualStr = monthly > 0 ? formatThousands(monthly * 12) : '';
    setDetailAnnualSalary(annualStr);
    setDetailMonthlySalary(monthly);
    recomputeTotal(annualStr, detailProvPercent);
  };

  // Jahresgehalt eingeben → Monatsgehalt (÷ 12) automatisch; Gesamtsumme aktualisieren.
  const updateAnnualSalary = (val: string) => {
    const fmt = formatNumberInput(val);
    setDetailAnnualSalary(fmt);
    const annual = parseFloat(fmt.replace(/\./g, '').replace(',', '.')) || 0;
    const monthlyStr = annual > 0 ? formatThousands(annual / 12) : '';
    setDetailMonthlySalaryStr(monthlyStr);
    setDetailMonthlySalary(annual > 0 ? annual / 12 : 0);
    recomputeTotal(fmt, detailProvPercent);
  };

  // Gesamtsumme = Jahresgehalt × Provision% — wird automatisch berechnet, SOBALD ein
  // Gehalt eingetragen ist. Ohne Gehalt bleibt die Gesamtsumme manuell eingebbar
  // (recomputeTotal lässt sie dann unangetastet).
  const recomputeTotal = (salaryStr: string, percentStr: string) => {
    const salary = parseFloat(salaryStr.replace(/\./g, '').replace(',', '.')) || 0;
    const pct = parseFloat(percentStr.replace(',', '.')) || 0;
    if (salary <= 0 || pct <= 0) return; // kein Gehalt → manuelle Gesamtsumme nicht überschreiben
    const total = salary * pct / 100;
    const totalStr = formatNumberInput(total.toFixed(2).replace('.', ','));
    setDetailTotalAmount(totalStr);
    const perRate = detailRateCount && detailRateCount > 0 ? formatNumberInput((total / detailRateCount).toFixed(2).replace('.', ',')) : '';
    setDetailRates(prev => prev.map(r => ({ ...r, amount: perRate })));
  };

  const updateRateDate = (idx: number, part: 'day' | 'month' | 'year', value: number) => {
    setDetailRates(prev => prev.map((r, i) => i === idx ? { ...r, [part]: value } : r));
    setActiveDatePicker(null);
  };

  // Compute provision from salary + provision terms
  const computeProvision = (
    seasonSalaryStr: string,
    provBasis: string,
    provPercent: string,
    provSalaryMonths: number | null,
    currentTotalAmount: string,
    rateCount: number | null,
    currentRates: RateEntry[],
    actualMonthlySalary?: number,
  ) => {
    const seasonSalary = parseFloat(seasonSalaryStr.replace(/\./g, '').replace(',', '.')) || 0;
    let total = 0;

    if (provBasis === 'prozent_jahresgehalt' && provPercent && seasonSalary > 0) {
      const pct = parseFloat(provPercent) || 0;
      if (pct > 0) total = seasonSalary * pct / 100;
    } else if (provBasis === 'bruttomonatsgehalt' && provSalaryMonths) {
      const monthly = actualMonthlySalary || (seasonSalary / 12);
      if (monthly > 0) total = monthly * provSalaryMonths;
    } else if (provBasis === 'festbetrag') {
      total = parseFloat(currentTotalAmount.replace(/\./g, '').replace(',', '.')) || 0;
    }

    if (total > 0 && provBasis !== 'festbetrag') {
      const totalStr = total.toFixed(2).replace('.', ',');
      setDetailTotalAmount(totalStr);
      if (rateCount && rateCount > 0) {
        const perRate = (total / rateCount).toFixed(2).replace('.', ',');
        setDetailRates(currentRates.map(r => ({ ...r, amount: perRate })));
      }
    }
  };

  const saveDetail = async () => {
    if (!detailPlayerId) return;

    // Delete existing provisions for this player + season
    const existingIds = provisions.filter(p => p.player_id === detailPlayerId).map(p => p.id);
    if (existingIds.length > 0) {
      await supabase.from('player_provisions').delete().in('id', existingIds);
    }

    // "Keine Provision" gewählt → Markierung setzen und fertig (keine Raten/Provision).
    if (detailNoProvision) {
      await supabase.from('player_no_provision').upsert(
        { player_id: detailPlayerId, season, created_by: session?.user?.id },
        { onConflict: 'player_id,season' }
      );
      setShowDetail(false);
      fetchData();
      return;
    }

    // Insert new rates
    const inserts = detailRates.map(r => ({
      player_id: detailPlayerId,
      season,
      amount: parseFloat(r.amount.replace(/\./g, '').replace(',', '.')) || 0,
      status: r.status,
      due_date: buildIsoDate(r.day, r.month, r.year),
      type: 'beraterprovision',
      frequency: !detailRateCount ? 'einmalig' : detailRateCount === 1 ? 'einmalig' : `${detailRateCount} Raten`,
      created_by: session?.user?.id,
    }));

    if (inserts.some(i => i.amount > 0)) {
      await supabase.from('player_provisions').insert(inserts.filter(i => i.amount > 0));
    }

    // Update provision %, docs, shares on player_details
    await supabase.from('player_details').update({
      provision: detailProvPercent || null,
      provision_documents: detailProvDocs,
      contract_documents: detailContractDocs,
      commission_shares: detailShares.filter(s => s.name.trim()).map(s => ({
        name: s.name, percentage: parseFloat(s.percentage) || 0, type: s.type, notes: s.notes,
      })),
    }).eq('id', detailPlayerId);

    // Wenn der Spieler in dieser Saison als "keine Provision" markiert war, Markierung
    // entfernen — es wurde ja jetzt eine Provision erfasst.
    await supabase.from('player_no_provision').delete().eq('player_id', detailPlayerId).eq('season', season);

    setShowDetail(false);
    fetchData();
  };

  // Externen Provisions-Spieler anlegen (nur Finanzen, nicht in der Spielerübersicht).
  const addProvisionPlayer = async () => {
    if (!addLastName.trim()) { alertDialog({ title: 'Eingabe fehlt', message: 'Bitte Nachname eingeben.' }); return; }
    const fn = (authProfile?.first_name || '').trim();
    const ln = (authProfile?.last_name || '').trim();
    const fullName = `${fn} ${ln}`.trim();
    setAddSaving(true);
    const { error } = await supabase.from('player_details').insert({
      first_name: addFirstName.trim(),
      last_name: addLastName.trim(),
      club: addClub.trim() || null,
      responsibility: fullName,
      provision_only: true,
      category: 'Fußball',
    });
    setAddSaving(false);
    if (error) { alertDialog({ title: 'Fehler', message: error.message }); return; }
    setShowAddProv(false);
    setAddFirstName(''); setAddLastName(''); setAddClub('');
    fetchData();
  };

  // Provisions-Dropdown wählen: "Keine Provision" oder 1–30 %.
  const selectProvisionOption = (val: 'none' | number) => {
    setShowProvisionDropdown(false);
    if (val === 'none') {
      setDetailNoProvision(true);
      setDetailProvPercent('');
      return;
    }
    setDetailNoProvision(false);
    setDetailProvPercent(String(val));
    recomputeTotal(detailAnnualSalary, String(val));
  };

  const deleteAllProvisions = async () => {
    const existingIds = provisions.filter(p => p.player_id === detailPlayerId).map(p => p.id);
    if (existingIds.length === 0) return;
    const player = players.find(p => p.id === detailPlayerId);
    const name = player ? `${player.last_name}, ${player.first_name}` : '';
    const ok = await confirmDialog({
      title: 'Alle Provisionen löschen',
      message: `Alle Provisionen für ${name} löschen?`,
      danger: true,
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    await supabase.from('player_provisions').delete().in('id', existingIds);
    setShowDetail(false);
    fetchData();
  };

  // --- Document Upload/Delete ---

  const uploadDoc = async (docType: 'provision_documents' | 'contract_documents') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled) return;

      const file = result.assets[0];
      const sanitizedName = file.name
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
        .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${detailPlayerId}/${docType}/${Date.now()}_${sanitizedName}`;

      let fileData: Blob | ArrayBuffer;
      if (file.file) {
        fileData = file.file;
      } else {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(fileName, fileData, { contentType: 'application/pdf', upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alertDialog({ title: 'Upload fehlgeschlagen', message: uploadError.message });
        return;
      }

      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fileName);
      const newDoc = { name: file.name, url: urlData.publicUrl, path: fileName };

      if (docType === 'provision_documents') {
        const updated = [...detailProvDocs, newDoc];
        setDetailProvDocs(updated);
        await supabase.from('player_details').update({ provision_documents: updated }).eq('id', detailPlayerId);
        fetchData();
        // Auto-parse provision document
        parseProvisionDoc(urlData.publicUrl);
      } else {
        const updated = [...detailContractDocs, newDoc];
        setDetailContractDocs(updated);
        await supabase.from('player_details').update({ contract_documents: updated }).eq('id', detailPlayerId);
        fetchData();
        // Auto-parse contract document
        parseContractDoc(urlData.publicUrl);
      }
    } catch (error) {
      console.error('Upload catch error:', error);
      alertDialog({ title: 'Upload-Fehler', message: 'Dokument konnte nicht hochgeladen werden.' });
    }
  };

  const deleteDoc = async (path: string, docType: 'provision_documents' | 'contract_documents') => {
    const doDelete = async () => {
      await supabase.storage.from('contracts').remove([path]);
      if (docType === 'provision_documents') {
        const updated = detailProvDocs.filter(d => d.path !== path);
        setDetailProvDocs(updated);
        await supabase.from('player_details').update({ provision_documents: updated }).eq('id', detailPlayerId);
      } else {
        const updated = detailContractDocs.filter(d => d.path !== path);
        setDetailContractDocs(updated);
        await supabase.from('player_details').update({ contract_documents: updated }).eq('id', detailPlayerId);
      }
      fetchData();
    };

    const ok = await confirmDialog({ title: 'Dokument löschen?', danger: true, confirmLabel: 'Löschen' });
    if (ok) doDelete();
  };

  // --- Auto-Parse Documents ---

  const parseProvisionDoc = async (docUrl: string) => {
    setParsing(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const authSession = (await supabase.auth.getSession()).data.session;
      const authToken = authSession?.access_token || supabaseAnonKey;
      const player = players.find(p => p.id === detailPlayerId);

      const response = await fetch(`${supabaseUrl}/functions/v1/parse-provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey || '',
        },
        body: JSON.stringify({
          pdf_url: docUrl,
          player_name: player ? `${player.first_name} ${player.last_name}` : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.error || !data?.parsed) {
        console.error('Parse provision error:', data?.error);
        alertDialog({ title: 'Hinweis', message: 'Provisionsvereinbarung hochgeladen, konnte aber nicht automatisch analysiert werden.' });
        return;
      }

      const parsed = data.parsed;
      console.log('Provision parsed:', JSON.stringify(parsed, null, 2));

      // Store provision basis info
      const basis = parsed.provision_basis || (parsed.provision_percent ? 'prozent_jahresgehalt' : 'festbetrag');
      setDetailProvBasis(basis);
      setDetailProvSalaryMonths(parsed.provision_salary_months || null);

      // Auto-fill fields
      if (parsed.provision_percent) {
        setDetailProvPercent(parsed.provision_percent.toString());
      }
      if (parsed.currency) {
        setDetailCurrency(parsed.currency === 'USD' ? 'USD' : 'EUR');
      }
      if (parsed.total_amount) {
        const totalStr = parsed.total_amount.toString().replace('.', ',');
        setDetailTotalAmount(totalStr);
      }

      // Map rates with due dates
      let newRates: RateEntry[] = [];
      if (parsed.rates && parsed.rates.length > 0) {
        setDetailRateCount(parsed.rates.length);
        newRates = parsed.rates.map((r: any) => {
          const d = r.due_date ? new Date(r.due_date) : null;
          return {
            amount: (r.amount || 0).toString().replace('.', ','),
            day: d && !isNaN(d.getTime()) ? d.getDate() : null,
            month: d && !isNaN(d.getTime()) ? d.getMonth() : null,
            year: d && !isNaN(d.getTime()) ? d.getFullYear() : null,
            status: 'offen',
          };
        });
        setDetailRates(newRates);
      } else if (parsed.rate_count) {
        const count = parsed.rate_count;
        setDetailRateCount(count);
        const perRate = parsed.total_amount ? (parsed.total_amount / count).toFixed(2).replace('.', ',') : '0';
        newRates = Array.from({ length: count }, () => ({
          amount: perRate, day: null, month: null, year: null, status: 'offen',
        }));
        setDetailRates(newRates);
      }

      // Try to compute provision from salary if contract data is available
      if (detailAnnualSalary && (basis === 'prozent_jahresgehalt' || basis === 'bruttomonatsgehalt')) {
        computeProvision(
          detailAnnualSalary,
          basis,
          parsed.provision_percent?.toString() || detailProvPercent,
          parsed.provision_salary_months || null,
          parsed.total_amount?.toString() || detailTotalAmount,
          parsed.rates?.length || parsed.rate_count || detailRateCount,
          newRates.length > 0 ? newRates : detailRates,
          detailMonthlySalary || undefined,
        );
      }

      alertDialog({ title: 'Analyse abgeschlossen', message: 'Provisionsvereinbarung wurde analysiert und die Felder automatisch ausgefüllt.' });
    } catch (err) {
      console.error('Parse provision catch:', err);
    } finally {
      setParsing(false);
    }
  };

  const parseContractDoc = async (docUrl: string) => {
    setParsing(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const authSession = (await supabase.auth.getSession()).data.session;
      const authToken = authSession?.access_token || supabaseAnonKey;
      const player = players.find(p => p.id === detailPlayerId);

      const response = await fetch(`${supabaseUrl}/functions/v1/parse-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey || '',
        },
        body: JSON.stringify({
          pdf_url: docUrl,
          player_name: player ? `${player.first_name} ${player.last_name}` : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.error || !data?.parsed) {
        console.error('Parse contract error:', data?.error);
        alertDialog({ title: 'Hinweis', message: 'Vertrag hochgeladen, konnte aber nicht automatisch analysiert werden.' });
        return;
      }

      const parsed = data.parsed;
      console.log('Contract parsed:', JSON.stringify(parsed, null, 2));

      // Store salary periods for later use
      if (parsed.salary_periods) {
        setDetailContractSalaryPeriods(parsed.salary_periods);
      }

      // Find salary for current season and auto-fill Saisongehalt
      if (parsed.salary_periods && parsed.salary_periods.length > 0) {
        const salaryInfo = findSalaryForSeason(parsed.salary_periods, season);
        if (salaryInfo) {
          const { monthlySalary, monthsInSeason } = salaryInfo;
          setDetailMonthlySalary(monthlySalary);
          const seasonSalary = monthlySalary * monthsInSeason;
          const seasonStr = seasonSalary.toFixed(2).replace('.', ',');
          setDetailAnnualSalary(seasonStr);

          // Auto-compute provision if provision data is available
          const basis = detailProvBasis || (detailProvPercent ? 'prozent_jahresgehalt' : '');
          if (basis) {
            computeProvision(
              seasonStr, basis, detailProvPercent, detailProvSalaryMonths,
              detailTotalAmount, detailRateCount, detailRates,
              monthlySalary,
            );
          }
        }
      }
    } catch (err) {
      console.error('Parse contract catch:', err);
    } finally {
      setParsing(false);
    }
  };

  const detailPlayer = players.find(p => p.id === detailPlayerId);

  // --- Render Helpers ---

  const renderSortableHeader = (label: string, field: SortField, style: any) => (
    <TouchableOpacity style={style} onPress={() => handleSort(field)}>
      <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>
        {label} {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
      </Text>
    </TouchableOpacity>
  );

  const getRowBg = (row: DisplayRow): string | undefined => {
    if (row.type !== 'provision') return undefined;
    if (row.status === 'bezahlt') return isDark ? '#052e16' : '#f0fdf4';
    if (row.status === 'in rechnung gestellt') return isDark ? '#172554' : '#eff6ff';
    if (row.due_date && row.status !== 'bezahlt') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(row.due_date) <= today) return isDark ? '#450a0a' : '#fef2f2';
    }
    return undefined;
  };

  const renderStatusBadge = (status: string, provId?: string | null) => {
    if (!status) return <Text style={{ color: colors.textMuted, fontSize: 12 }}>-</Text>;
    let bgColor: string, textColor: string, label: string;
    switch (status) {
      case 'bezahlt': bgColor = '#f0fdf4'; textColor = '#16a34a'; label = 'Bezahlt'; break;
      case 'in rechnung gestellt': bgColor = '#eff6ff'; textColor = '#2563eb'; label = 'In Rechnung'; break;
      default: bgColor = '#fffbeb'; textColor = '#d97706'; label = 'Offen';
    }
    const badge = (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
    if (provId) {
      return <TouchableOpacity onPress={(e) => { e.stopPropagation(); cycleStatus(provId, status); }}>{badge}</TouchableOpacity>;
    }
    return badge;
  };

  // --- Desktop Row ---

  const renderRow = (row: DisplayRow) => {
    const isProv = row.type === 'provision';
    const rowBg = getRowBg(row);

    return (
      <TouchableOpacity
        key={row.key}
        style={[
          styles.tableRow, { borderBottomColor: colors.border },
          !isProv && { opacity: 0.5 },
          rowBg ? { backgroundColor: rowBg } : undefined,
        ]}
        onPress={() => openDetail(row.player_id)}
        activeOpacity={0.7}
      >
        <View style={styles.colName}>
          <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
            {row.last_name}, {row.first_name}
          </Text>
        </View>
        <View style={[styles.colClub, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          {getClubLogo(row.club) ? <Image source={{ uri: getClubLogo(row.club)! }} style={{ width: 16, height: 16 }} resizeMode="contain" /> : null}
          <Text style={[styles.tableCell, { color: colors.text, flex: 1 }]} numberOfLines={1}>{row.club || '-'}</Text>
        </View>
        <View style={styles.colLeague}>
          <Text style={[styles.tableCell, { color: colors.textMuted, fontSize: 12 }]} numberOfLines={1}>{row.league || '-'}</Text>
        </View>
        <View style={styles.colProvision}>
          <Text style={[styles.tableCell, { color: colors.text }]}>
            {row.type === 'no_provision' ? '–' : (row.provisionPercent ? `${row.provisionPercent}%` : '-')}
          </Text>
        </View>
        <View style={styles.colAmount}>
          <Text style={[styles.tableCell, { color: row.type === 'no_provision' ? colors.textMuted : colors.text, fontWeight: isProv ? '600' : '400', fontStyle: row.type === 'no_provision' ? 'italic' : 'normal' }]} numberOfLines={1}>
            {row.type === 'no_provision' ? 'Keine Provision' : (isProv && row.amount > 0 ? formatCurrency(row.amount) : '-')}
          </Text>
        </View>
        <View style={styles.colDue}>
          <Text style={[styles.tableCell, { color: colors.text }]}>
            {isProv ? formatDateDE(row.due_date) : '-'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // --- Mobile Card ---

  const renderCard = (row: DisplayRow) => {
    const isProv = row.type === 'provision';
    const rowBg = getRowBg(row);
    return (
      <TouchableOpacity
        key={row.key}
        style={[
          styles.playerCard,
          { backgroundColor: rowBg || colors.cardBackground, borderColor: rowBg ? (row.status === 'bezahlt' ? '#bbf7d0' : row.status === 'in rechnung gestellt' ? '#bfdbfe' : '#fecaca') : colors.cardBorder },
          !isProv && { opacity: 0.5 },
        ]}
        onPress={() => openDetail(row.player_id)}
        activeOpacity={0.7}
      >
        <View style={styles.playerCardHeader}>
          <Text style={[styles.playerCardName, { color: colors.text }]} numberOfLines={1}>
            {row.last_name}, {row.first_name}
          </Text>
          {!isProv && (
            <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: '700' }}>+</Text>
          )}
        </View>
        <View style={styles.playerCardBody}>
          <View style={styles.playerCardRow}>
            {getClubLogo(row.club) ? <Image source={{ uri: getClubLogo(row.club)! }} style={{ width: 16, height: 16, marginRight: 6 }} resizeMode="contain" /> : null}
            <Text style={[{ color: colors.text, fontSize: 13, flex: 1 }]} numberOfLines={1}>{row.club || '-'}</Text>
            {row.league ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{row.league}</Text> : null}
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{row.provisionPercent ? `${row.provisionPercent}%` : ''}</Text>
          </View>
          {row.type === 'no_provision' && (
            <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>Keine Provision</Text>
          )}
          {isProv && (
            <View style={styles.playerCardRow}>
              <Text style={[{ color: colors.text, fontSize: 14, fontWeight: '600' }]}>{row.amount > 0 ? formatCurrency(row.amount) : '-'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateDE(row.due_date)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // --- Summary ---

  const renderSummary = () => (
    <View style={[styles.summaryRow, { marginBottom: 0 }, isMobile && { flexDirection: 'column' }]}>
      <View style={[styles.summaryCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Offen</Text>
        <Text style={[styles.summaryValue, { color: '#d97706' }]}>{formatCurrency(totals.offen)}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Bezahlt</Text>
        <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{formatCurrency(totals.bezahlt)}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Gesamt</Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(totals.gesamt)}</Text>
      </View>
    </View>
  );

  // --- Date Picker Component ---

  // Dropdown background style - must be opaque for web overlay
  const dropdownBg = isDark ? '#1e1e1e' : '#ffffff';

  const renderDatePicker = (rateIdx: number, rate: RateEntry) => {
    const isActiveDay = activeDatePicker?.rateIdx === rateIdx && activeDatePicker?.part === 'day';
    const isActiveMonth = activeDatePicker?.rateIdx === rateIdx && activeDatePicker?.part === 'month';
    const isActiveYear = activeDatePicker?.rateIdx === rateIdx && activeDatePicker?.part === 'year';

    return (
      <View style={styles.datePickerRow}>
        {/* Tag */}
        <View style={{ position: 'relative', flex: 1, zIndex: isActiveDay ? 103 : 1 }}>
          <TouchableOpacity
            style={[styles.dateDropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setActiveDatePicker(isActiveDay ? null : { rateIdx, part: 'day' })}
          >
            <Text style={[styles.dateDropdownText, { color: rate.day ? colors.text : colors.textMuted }]}>{rate.day || 'Tag'}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
          </TouchableOpacity>
          {isActiveDay && (
            <View style={[styles.datePickerList, { backgroundColor: dropdownBg, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {DAYS.map(d => (
                  <TouchableOpacity key={d} style={[styles.datePickerItem, { borderBottomColor: colors.border }, rate.day === d && styles.datePickerItemSelected]}
                    onPress={() => updateRateDate(rateIdx, 'day', d)}>
                    <Text style={[styles.datePickerItemText, { color: colors.text }, rate.day === d && styles.datePickerItemTextSelected]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        {/* Monat */}
        <View style={{ position: 'relative', flex: 1, zIndex: isActiveMonth ? 102 : 1 }}>
          <TouchableOpacity
            style={[styles.dateDropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setActiveDatePicker(isActiveMonth ? null : { rateIdx, part: 'month' })}
          >
            <Text style={[styles.dateDropdownText, { color: rate.month !== null ? colors.text : colors.textMuted }]}>
              {rate.month !== null ? MONTHS[rate.month] : 'Monat'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
          </TouchableOpacity>
          {isActiveMonth && (
            <View style={[styles.datePickerList, { backgroundColor: dropdownBg, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {MONTHS.map((m, idx) => (
                  <TouchableOpacity key={m} style={[styles.datePickerItem, { borderBottomColor: colors.border }, rate.month === idx && styles.datePickerItemSelected]}
                    onPress={() => updateRateDate(rateIdx, 'month', idx)}>
                    <Text style={[styles.datePickerItemText, { color: colors.text }, rate.month === idx && styles.datePickerItemTextSelected]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        {/* Jahr */}
        <View style={{ position: 'relative', flex: 1, zIndex: isActiveYear ? 101 : 1 }}>
          <TouchableOpacity
            style={[styles.dateDropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setActiveDatePicker(isActiveYear ? null : { rateIdx, part: 'year' })}
          >
            <Text style={[styles.dateDropdownText, { color: rate.year ? colors.text : colors.textMuted }]}>{rate.year || 'Jahr'}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
          </TouchableOpacity>
          {isActiveYear && (
            <View style={[styles.datePickerList, { backgroundColor: dropdownBg, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {YEARS.map(y => (
                  <TouchableOpacity key={y} style={[styles.datePickerItem, { borderBottomColor: colors.border }, rate.year === y && styles.datePickerItemSelected]}
                    onPress={() => updateRateDate(rateIdx, 'year', y)}>
                    <Text style={[styles.datePickerItemText, { color: colors.text }, rate.year === y && styles.datePickerItemTextSelected]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  };

  // --- Detail Modal ---

  const existingProvCount = provisions.filter(p => p.player_id === detailPlayerId).length;

  // Welcher Bereich hat gerade ein offenes Dropdown? Alle anderen werden abgedunkelt,
  // damit ein schmales, überlappendes Dropdown nicht wie mehrere offene aussieht.
  const dropdownOpenKey: string | null =
    (showProvisionDropdown || showCurrencyDropdown) ? 'r1'
    : showRateDropdown ? 'r3'
    : activeDatePicker ? `rate${activeDatePicker.rateIdx}`
    : null;
  const dimIfNot = (key: string): number => (dropdownOpenKey && dropdownOpenKey !== key ? 0.18 : 1);
  // Abgedunkelte Bereiche dürfen keine Klicks abbekommen — sonst löst ein Klick im
  // Hintergrund (z.B. "Bezahlt") aus. Klicks fallen dann auf den Modal-Hintergrund
  // durch und schließen das offene Dropdown.
  const blockIfNot = (key: string): 'none' | 'auto' => (dropdownOpenKey && dropdownOpenKey !== key ? 'none' : 'auto');

  // Modal: externen Provisions-Spieler anlegen.
  const renderAddProvModal = () => (
    <Modal visible={showAddProv} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setShowAddProv(false)}>
        <Pressable style={[styles.modalContent, { maxWidth: 440 }]} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Spieler anlegen</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Provision ohne Betreuung</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nachname</Text>
              <TextInput
                style={[styles.inputCompact, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="z.B. Mustermann" placeholderTextColor={colors.textMuted}
                value={addLastName} onChangeText={setAddLastName} autoFocus
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Vorname</Text>
              <TextInput
                style={[styles.inputCompact, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="z.B. Max" placeholderTextColor={colors.textMuted}
                value={addFirstName} onChangeText={setAddFirstName}
              />
            </View>
          </View>
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Verein</Text>
            <TextInput
              style={[styles.inputCompact, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="z.B. FC Beispiel" placeholderTextColor={colors.textMuted}
              value={addClub} onChangeText={setAddClub}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <TouchableOpacity onPress={() => setShowAddProv(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted }}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addProvisionPlayer} disabled={addSaving} style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: addSaving ? 0.6 : 1 }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{addSaving ? 'Speichern…' : 'Anlegen'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderDetailModal = () => (
    <Modal visible={showDetail} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setShowDetail(false)}>
        <Pressable style={styles.modalContent} onPress={e => { e.stopPropagation(); setActiveDatePicker(null); setShowRateDropdown(false); setShowProvisionDropdown(false); setShowCurrencyDropdown(false); }}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {detailPlayer ? `${detailPlayer.last_name}, ${detailPlayer.first_name}` : 'Provision'}
              </Text>
              {detailPlayer?.club && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {getClubLogo(detailPlayer.club) ? (
                    <Image source={{ uri: getClubLogo(detailPlayer.club)! }} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  ) : null}
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{detailPlayer.club}</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 18, fontWeight: '700' }}>
              Saison {String(season).slice(2)}
            </Text>
          </View>

          <ScrollView
            style={[{ flex: 1 }, (activeDatePicker || showRateDropdown || showProvisionDropdown || showCurrencyDropdown) ? { overflow: 'visible' as any } : {}]}
            scrollEnabled={!activeDatePicker && !showRateDropdown && !showProvisionDropdown && !showCurrencyDropdown}
            nestedScrollEnabled
          >
            {/* Trennstrich unter Name + Verein */}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />

            {/* Reihe 1: Provision (links) + Währung (rechts, über dem Jahresgehalt-Feld) */}
            <View pointerEvents={blockIfNot('r1')} style={{ flexDirection: 'row', marginBottom: 16, position: 'relative', opacity: dimIfNot('r1'), zIndex: (showProvisionDropdown || showCurrencyDropdown) ? 1000 : 1 }}>
              {/* Provision (Dropdown: Keine Provision / 1–30 %) */}
              <View style={{ width: 200, position: 'relative', zIndex: showProvisionDropdown ? 320 : 2 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Provision</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { width: 110, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => { setShowProvisionDropdown(v => !v); setShowCurrencyDropdown(false); setShowRateDropdown(false); setActiveDatePicker(null); }}
                >
                  <Text style={{ color: (detailNoProvision || detailProvPercent) ? colors.text : colors.textMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                    {detailNoProvision ? 'Keine Prov.' : (detailProvPercent ? `${detailProvPercent}%` : '–')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                {showProvisionDropdown && (
                  <View style={[styles.datePickerList, { width: 150, backgroundColor: dropdownBg, borderColor: colors.border }]}>
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                      <TouchableOpacity
                        style={[styles.datePickerItem, { borderBottomColor: colors.border }, detailNoProvision && styles.datePickerItemSelected]}
                        onPress={() => selectProvisionOption('none')}
                      >
                        <Text style={[styles.datePickerItemText, { color: colors.text }, detailNoProvision && styles.datePickerItemTextSelected]}>Keine Provision</Text>
                      </TouchableOpacity>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(n => {
                        const sel = !detailNoProvision && detailProvPercent === String(n);
                        return (
                          <TouchableOpacity
                            key={n}
                            style={[styles.datePickerItem, { borderBottomColor: colors.border }, sel && styles.datePickerItemSelected]}
                            onPress={() => selectProvisionOption(n)}
                          >
                            <Text style={[styles.datePickerItemText, { color: colors.text }, sel && styles.datePickerItemTextSelected]}>{n}%</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
              {/* Währung (Dropdown) */}
              <View style={{ position: 'relative', zIndex: showCurrencyDropdown ? 320 : 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Währung</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { width: 110, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => { setShowCurrencyDropdown(v => !v); setShowProvisionDropdown(false); setShowRateDropdown(false); setActiveDatePicker(null); }}
                >
                  <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>{detailCurrency === 'EUR' ? '€ Euro' : '$ Dollar'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                {showCurrencyDropdown && (
                  <View style={[styles.datePickerList, { width: 110, backgroundColor: dropdownBg, borderColor: colors.border }]}>
                    {([['EUR', '€ Euro'], ['USD', '$ Dollar']] as const).map(([val, label]) => {
                      const sel = detailCurrency === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[styles.datePickerItem, { borderBottomColor: colors.border }, sel && styles.datePickerItemSelected]}
                          onPress={() => { setDetailCurrency(val); setShowCurrencyDropdown(false); }}
                        >
                          <Text style={[styles.datePickerItemText, { color: colors.text }, sel && styles.datePickerItemTextSelected]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {!detailNoProvision && (
            <>
            {/* Reihe 2: Gehalt Saison — Monatsgehalt (links), Jahresgehalt (rechts).
                Beide eingebbar (× / ÷ 12). */}
            <View pointerEvents={blockIfNot('r2')} style={{ marginBottom: 16, position: 'relative', opacity: dimIfNot('r2'), zIndex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Spielergehalt</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* linke Spalte (200): Monatsgehalt + "=" */}
                <View style={{ width: 200, flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.inputCompact, { width: 110, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="z.B. 2.000"
                    placeholderTextColor={colors.textMuted}
                    value={detailMonthlySalaryStr}
                    onChangeText={updateMonthlySalary}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', marginLeft: 4 }}>{detailCurrency === 'EUR' ? '€' : '$'} / Monat</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700', marginLeft: 'auto', marginRight: 10 }}>=</Text>
                </View>
                {/* rechte Spalte: Jahresgehalt (€ / Saison) */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.inputCompact, { width: 110, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="z.B. 24.000"
                    placeholderTextColor={colors.textMuted}
                    value={detailAnnualSalary}
                    onChangeText={updateAnnualSalary}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', marginLeft: 4 }}>{detailCurrency === 'EUR' ? '€' : '$'} / Saison</Text>
                </View>
              </View>
            </View>

            {/* Reihe 3: Provision-Summe (links) + Raten (rechts, exakt unter dem Jahresgehalt) */}
            <View pointerEvents={blockIfNot('r3')} style={{ flexDirection: 'row', alignItems: 'flex-start', position: 'relative', opacity: dimIfNot('r3'), zIndex: showRateDropdown ? 1000 : 1 }}>
              {/* linke Spalte (200): Provision-Summe */}
              <View style={{ width: 200 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Gesamtprovision</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.inputCompact, { width: 110, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="1.000,00"
                    placeholderTextColor={colors.textMuted}
                    value={detailTotalAmount}
                    onChangeText={updateTotalAmount}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', marginLeft: 6 }}>{detailCurrency === 'EUR' ? '€' : '$'}</Text>
                </View>
              </View>
              {/* rechte Spalte: Raten */}
              <View style={{ position: 'relative', zIndex: showRateDropdown ? 200 : 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Raten</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { width: 110, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => { setShowRateDropdown(!showRateDropdown); setShowProvisionDropdown(false); setShowCurrencyDropdown(false); setActiveDatePicker(null); }}
                >
                  <Text style={{ color: detailRateCount ? colors.text : colors.textMuted, fontSize: 13 }}>
                    {detailRateCount ?? '-'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                {showRateDropdown && (
                  <View style={[styles.datePickerList, { width: 110, backgroundColor: dropdownBg, borderColor: colors.border }]}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      <TouchableOpacity
                        style={[styles.datePickerItem, { borderBottomColor: colors.border }, detailRateCount === null && styles.datePickerItemSelected]}
                        onPress={() => updateRateCount(null)}
                      >
                        <Text style={[styles.datePickerItemText, { color: colors.text }, detailRateCount === null && styles.datePickerItemTextSelected]}>-</Text>
                      </TouchableOpacity>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.datePickerItem, { borderBottomColor: colors.border }, detailRateCount === n && styles.datePickerItemSelected]}
                          onPress={() => updateRateCount(n)}
                        >
                          <Text style={[styles.datePickerItemText, { color: colors.text }, detailRateCount === n && styles.datePickerItemTextSelected]}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
            </>
            )}
            {/* Netto-Info */}
            {detailShares.length > 0 && detailProvPercent ? (() => {
              const totalSharePct = detailShares.reduce((s, sh) => s + (parseFloat(sh.percentage) || 0), 0);
              const nettoFactor = (100 - totalSharePct) / 100;
              const nettoProv = ((parseFloat(detailProvPercent) || 0) * nettoFactor).toFixed(1).replace('.', ',');
              return (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  Abgaben: {totalSharePct}% → Netto-Provision: {nettoProv}%
                </Text>
              );
            })() : null}

            {/* Raten Details */}
            {detailRates.map((rate, idx) => (
              <View key={idx} pointerEvents={blockIfNot(`rate${idx}`)} style={[styles.rateSection, { borderColor: colors.border, position: 'relative', opacity: dimIfNot(`rate${idx}`), zIndex: activeDatePicker?.rateIdx === idx ? 500 : 1 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[styles.rateSectionTitle, { color: colors.text }]}>
                    Rate {idx + 1}{detailRateCount > 1 ? ` von ${detailRateCount}` : ''}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    {rate.amount ? `${rate.amount} €` : '-'}
                  </Text>
                </View>

                {/* Status */}
                <View style={[styles.statusPicker, { marginBottom: 10 }]}>
                  {['offen', 'in rechnung gestellt', 'bezahlt'].map(s => {
                    const isActive = rate.status === s;
                    const labels: Record<string, string> = { 'offen': 'Offen', 'in rechnung gestellt': 'In Rechnung', 'bezahlt': 'Bezahlt' };
                    const ac: Record<string, string> = { 'offen': '#d97706', 'in rechnung gestellt': '#2563eb', 'bezahlt': '#16a34a' };
                    return (
                      <TouchableOpacity key={s} style={[styles.statusOption, { borderColor: isActive ? ac[s] : colors.border }, isActive && { backgroundColor: ac[s] + '15' }]}
                        onPress={() => setDetailRates(prev => prev.map((r, i) => i === idx ? { ...r, status: s } : r))}>
                        <Text style={{ color: isActive ? ac[s] : colors.textMuted, fontSize: 12, fontWeight: isActive ? '600' : '400' }}>{labels[s]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Fälligkeit */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 6 }]}>Fälligkeit</Text>
                {renderDatePicker(idx, rate)}
              </View>
            ))}

            {/* Beteiligungen / Abgaben */}
            <View pointerEvents={blockIfNot('beteiligungen')} style={{ opacity: dimIfNot('beteiligungen') }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 20 }]}>Beteiligungen / Abgaben</Text>
            {detailShares.map((share, idx) => (
              <View key={idx} style={[styles.shareRow, { borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="Name (z.B. Agentur XY)"
                    placeholderTextColor={colors.textMuted}
                    value={share.name}
                    onChangeText={v => setDetailShares(prev => prev.map((s, i) => i === idx ? { ...s, name: v } : s))}
                  />
                  <TextInput
                    style={[styles.input, { width: 70, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, textAlign: 'center' }]}
                    placeholder="%"
                    placeholderTextColor={colors.textMuted}
                    value={share.percentage}
                    onChangeText={v => setDetailShares(prev => prev.map((s, i) => i === idx ? { ...s, percentage: v } : s))}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={() => setDetailShares(prev => prev.filter((_, i) => i !== idx))}
                    style={{ justifyContent: 'center', paddingHorizontal: 4 }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['abgabe', 'beteiligung'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.statusOption, {
                        borderColor: share.type === t ? '#3b82f6' : colors.border,
                        backgroundColor: share.type === t ? '#3b82f615' : 'transparent',
                      }]}
                      onPress={() => setDetailShares(prev => prev.map((s, i) => i === idx ? { ...s, type: t } : s))}
                    >
                      <Text style={{ color: share.type === t ? '#3b82f6' : colors.textMuted, fontSize: 11, fontWeight: share.type === t ? '600' : '400' }}>
                        {t === 'abgabe' ? 'Abgabe' : 'Beteiligung'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, fontSize: 12, paddingVertical: 6 }]}
                    placeholder="Notiz (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={share.notes}
                    onChangeText={v => setDetailShares(prev => prev.map((s, i) => i === idx ? { ...s, notes: v } : s))}
                  />
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.addShareBtn, { borderColor: colors.border }]}
              onPress={() => setDetailShares(prev => [...prev, { name: '', percentage: '', type: 'abgabe', notes: '' }])}
            >
              <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600' }}>+ Beteiligung hinzufügen</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { zIndex: -1 }]}>
            {existingProvCount > 0 && (
              <TouchableOpacity style={[styles.modalBtn, { borderColor: '#ef4444', marginRight: 'auto' }]} onPress={deleteAllProvisions}>
                <Text style={{ color: '#ef4444', fontWeight: '500' }}>Löschen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setShowDetail(false)}>
              <Text style={{ color: colors.textMuted }}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={saveDetail}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // --- Counts ---

  const provisionCount = displayRows.filter(r => r.type === 'provision').length;
  const playerOnlyCount = displayRows.filter(r => r.type === 'player_only').length;
  const noProvisionCount = displayRows.filter(r => r.type === 'no_provision').length;

  // --- Mobile View ---

  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="finanzen" />
        {renderDetailModal()}
        {renderAddProvModal()}

        <MobileHeader
          title="Finanzen"
          subtitle={
            activeTab === 'dokumente'
              ? `${sortedDocuments.length} ${sortedDocuments.length === 1 ? 'Dokument' : 'Dokumente'}`
              : 'Provisionen · Abrechnungen · Dokumente'
          }
          backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
          onMenuPress={() => setShowMobileSidebar(true)}
        >
          {activeTab === 'dokumente' ? (
            <View style={styles.docsHeroSearchRow}>
              <Text style={styles.docsHeroSearchIcon}>🔍</Text>
              <TextInput
                style={styles.docsHeroSearchInput}
                value={docSearchText}
                onChangeText={setDocSearchText}
                placeholder="Spieler, Verein, Art…"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
              {docSearchText ? (
                <TouchableOpacity onPress={() => setDocSearchText('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {activeTab === 'dokumente' ? (
            <TouchableOpacity
              style={[styles.heroUploadIconBtn, uploadingDoc && { opacity: 0.5 }]}
              onPress={startDocumentUpload}
              disabled={uploadingDoc}
              accessibilityLabel="PDF hochladen"
            >
              <MaterialCommunityIcons name="file-upload-outline" size={16} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.segmentedWrap}>
            {(['dokumente', 'finanzen'] as const).map((tab, idx) => {
              const isActive = activeTab === tab;
              const iconName = tab === 'dokumente' ? 'file-document-outline' : 'cash-multiple';
              const count = tab === 'dokumente' ? documents.length : null;
              return (
                <React.Fragment key={tab}>
                  {idx > 0 ? <View style={styles.segmentedDivider} /> : null}
                  <TouchableOpacity
                    onPress={() => setActiveTab(tab)}
                    style={[styles.segmentedBtn, isActive && styles.segmentedBtnActive, { paddingHorizontal: 10 }]}
                    accessibilityLabel={tab === 'dokumente' ? 'Dokumente' : 'Provisionen'}
                  >
                    <MaterialCommunityIcons
                      name={iconName as any}
                      size={14}
                      color={isActive ? '#fff' : 'rgba(255,255,255,0.6)'}
                    />
                    {count !== null && count > 0 ? (
                      <View style={[styles.segmentedCountPill, isActive && styles.segmentedCountPillActive]}>
                        <Text style={[styles.segmentedCountText, isActive && styles.segmentedCountTextActive]}>{count}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </MobileHeader>

        {activeTab === 'finanzen' ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
            <View style={styles.financeHero}>
              <View style={StyleSheet.absoluteFill as any} pointerEvents="none">
                <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ width: '100%', height: '100%', opacity: 0.5 }} resizeMode="cover" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={() => changeSeason(-1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 18 }}>◀</Text></Pressable>
                  <Text style={[styles.seasonText, { color: colors.text }]}>{season}</Text>
                  <Pressable onPress={() => changeSeason(1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 18 }}>▶</Text></Pressable>
                </View>
                <TouchableOpacity onPress={() => setShowAddProv(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <Ionicons name="add" size={13} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>Spieler</Text>
                </TouchableOpacity>
              </View>
              {renderSummary()}
            </View>
            <Text style={[styles.rowCount, { color: colors.textMuted }]}>{provisionCount} Provisionen · {playerOnlyCount} ohne Einträge{noProvisionCount > 0 ? ` · ${noProvisionCount} keine Provision` : ''}</Text>
            {loading ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>Laden...</Text> : sortedRows.map(renderCard)}
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 10 }}>
            {documentsLoading ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Laden...</Text>
            ) : sortedDocuments.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', paddingTop: 24 }]}>Noch keine Dokumente. Lade oben rechts dein erstes PDF hoch.</Text>
            ) : (
              sortedDocuments.map((doc) => {
                const isMine = !!doc.uploaded_by && doc.uploaded_by === authProfile?.id;
                const displayClub = doc.target_club || doc.player_club;
                const isDifferent = !!doc.target_club && doc.target_club !== doc.player_club;
                const logo = getClubLogo(displayClub);
                return (
                  <View key={doc.id} style={styles.mobileDocCard}>
                    <Text style={styles.mobileDocName} numberOfLines={1}>
                      {(doc.player_last_name || '—')}{doc.player_first_name ? `, ${doc.player_first_name}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {logo ? <Image source={{ uri: logo }} style={{ width: 16, height: 16 }} resizeMode="contain" /> : null}
                      <Text style={styles.mobileDocClub} numberOfLines={1}>{displayClub || '—'}</Text>
                      {isDifferent ? (
                        <Ionicons name="arrow-forward" size={11} color="#22c55e" />
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 14 }}>
                      <Text style={[styles.mobileDocMeta, { flex: 1 }]} numberOfLines={1}>
                        {doc.doc_type || '—'} · {new Date(doc.created_at).toLocaleDateString('de-DE')}
                      </Text>
                      <TouchableOpacity onPress={() => toggleDocSigned(doc)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        {doc.signed ? (
                          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                        ) : (
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => signDocument(doc)} disabled={signingDocId === doc.id} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <MaterialCommunityIcons name="file-document-edit-outline" size={18} color={signingDocId === doc.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => downloadDocument(doc)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="download-outline" size={18} color="rgba(255,255,255,0.85)" />
                      </TouchableOpacity>
                      {isMine ? (
                        <TouchableOpacity onPress={() => deleteDocument(doc)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // --- Desktop View ---

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="finanzen" profile={authProfile} />
      {renderDetailModal()}
      {renderAddProvModal()}

      <View style={styles.mainContent}>
        <AdvisorHeroHeader
          title="FINANZEN"
          subtitle={
            activeTab === 'dokumente'
              ? `${sortedDocuments.length} ${sortedDocuments.length === 1 ? 'DOKUMENT' : 'DOKUMENTE'}${docSearchText ? ' (GEFILTERT)' : ''}`
              : 'PROVISIONEN · ABRECHNUNGEN · DOKUMENTE'
          }
          backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
          backgroundImageOpacity={0.45}
        >
          {activeTab === 'dokumente' ? (
            <View style={styles.docsHeroSearchRow}>
              <Text style={styles.docsHeroSearchIcon}>🔍</Text>
              <TextInput
                style={styles.docsHeroSearchInput}
                value={docSearchText}
                onChangeText={setDocSearchText}
                placeholder="Spieler, Verein, Art suchen..."
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
              {docSearchText ? (
                <TouchableOpacity onPress={() => setDocSearchText('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {activeTab === 'dokumente' ? (
            <TouchableOpacity
              style={[styles.heroUploadIconBtn, uploadingDoc && { opacity: 0.5 }]}
              onPress={startDocumentUpload}
              disabled={uploadingDoc}
              accessibilityLabel="PDF hochladen"
            >
              <MaterialCommunityIcons name="file-upload-outline" size={16} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.segmentedWrap}>
            {(['dokumente', 'finanzen'] as const).map((tab, idx) => {
              const isActive = activeTab === tab;
              const label = tab === 'finanzen' ? 'Provisionen' : 'Dokumente';
              const count = tab === 'dokumente' ? documents.length : null;
              return (
                <React.Fragment key={tab}>
                  {idx > 0 ? <View style={styles.segmentedDivider} /> : null}
                  <TouchableOpacity
                    onPress={() => setActiveTab(tab)}
                    style={[styles.segmentedBtn, isActive && styles.segmentedBtnActive]}
                  >
                    <Text style={[styles.segmentedLabel, isActive && styles.segmentedLabelActive]}>{label}</Text>
                    {count !== null && count > 0 ? (
                      <View style={[styles.segmentedCountPill, isActive && styles.segmentedCountPillActive]}>
                        <Text style={[styles.segmentedCountText, isActive && styles.segmentedCountTextActive]}>{count}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </AdvisorHeroHeader>

        {activeTab === 'finanzen' ? (
        <View style={styles.content}>
          {/* Gemeinsamer Rahmen mit Skyline-Hintergrund: Saison-Zeile + Summen */}
          <View style={styles.financeHero}>
            <View style={StyleSheet.absoluteFill as any} pointerEvents="none">
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ width: '100%', height: '100%', opacity: 0.5 }} resizeMode="cover" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ width: 96 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Pressable onPress={() => changeSeason(-1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 20 }}>◀</Text></Pressable>
                <Text style={[styles.seasonText, { color: colors.text }]}>{season}</Text>
                <Pressable onPress={() => changeSeason(1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 20 }}>▶</Text></Pressable>
              </View>
              <TouchableOpacity onPress={() => setShowAddProv(true)} style={{ width: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <Ionicons name="add" size={14} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Spieler</Text>
              </TouchableOpacity>
            </View>
            {renderSummary()}
          </View>

          <Text style={[styles.rowCount, { color: colors.textMuted }]}>{provisionCount} Provisionen · {playerOnlyCount} Spieler ohne Einträge{noProvisionCount > 0 ? ` · ${noProvisionCount} keine Provision` : ''}</Text>

          <View style={[styles.tableWrapper, { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' }]} onLayout={(e) => setTableWidth(e.nativeEvent.layout.width - 32)}>
            {tableWidth > 0 && (
              <TableHeader
                columnDefs={FINANZEN_COLUMNS}
                backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
                columnOrder={table.columnOrder}
                getColumnWidth={table.getColumnWidth}
                onResizeStart={table.onResizeStart}
                onDragStart={table.onDragStart}
                resizingKey={table.resizingKey}
                draggingKey={table.draggingKey}
                dragOverKey={table.dragOverKey}
                onSort={(key) => handleSort(key as SortField)}
                sortKey={sortField}
                sortAsc={sortDirection === 'asc'}
                colors={colors}
                setHeaderRef={table.setHeaderRef}
                style={{ paddingHorizontal: 16 }}
              />
            )}

            <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
              {loading ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Laden...</Text>
              ) : sortedRows.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Keine Spieler gefunden.</Text>
              ) : (
                sortedRows.map((row) => {
                  const isProv = row.type === 'provision';
                  const isNo = row.type === 'no_provision';
                  const rowBg = getRowBg(row);

                  return (
                    <TableRow
                      key={row.key}
                      columnOrder={table.columnOrder}
                      getColumnWidth={table.getColumnWidth}
                      onPress={() => openDetail(row.player_id)}
                      style={[
                        styles.tableRow, { borderBottomColor: colors.border },
                        rowBg ? { backgroundColor: rowBg } : undefined,
                      ]}
                      renderCell={(key) => {
                        switch (key) {
                          case 'name':
                            return (
                              <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
                                {row.last_name}
                              </Text>
                            );
                          case 'vorname':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{row.first_name || '-'}</Text>;
                          case 'club': {
                            const logo = getClubLogo(row.club);
                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {logo ? <Image source={{ uri: logo }} style={{ width: 18, height: 18 }} resizeMode="contain" /> : null}
                                <Text style={[styles.tableCell, { color: colors.text, flex: 1 }]} numberOfLines={1}>{row.club || '-'}</Text>
                              </View>
                            );
                          }
                          case 'league':
                            return <Text style={[styles.tableCell, { color: colors.text, fontSize: 12 }]} numberOfLines={1}>{row.league || '-'}</Text>;
                          case 'provision':
                            return <Text style={[styles.tableCell, { color: colors.text }]}>{isNo ? '–' : (row.provisionPercent ? `${row.provisionPercent}%` : '-')}</Text>;
                          case 'amount':
                            return (
                              <Text style={[styles.tableCell, { color: isNo ? colors.textMuted : colors.text, fontWeight: isProv ? '600' : '400', fontStyle: isNo ? 'italic' : 'normal' }]} numberOfLines={1}>
                                {isNo ? 'Keine Provision' : (isProv && row.amount > 0 ? formatCurrency(row.amount) : '-')}
                              </Text>
                            );
                          case 'due':
                            return <Text style={[styles.tableCell, { color: colors.text }]}>{isProv ? formatDateDE(row.due_date) : '-'}</Text>;
                          default:
                            return null;
                        }
                      }}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
        ) : (
        <View style={styles.content}>
          <View
            style={[styles.tableWrapper, { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' }]}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width - 32;
              if (w > 0) setDocsTableWidth(w);
            }}
          >
            <TableHeader
              columnDefs={DOCUMENT_COLUMNS}
              backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
              columnOrder={docsTable.columnOrder}
              getColumnWidth={docsTable.getColumnWidth}
              onResizeStart={docsTable.onResizeStart}
              onDragStart={docsTable.onDragStart}
              resizingKey={docsTable.resizingKey}
              draggingKey={docsTable.draggingKey}
              dragOverKey={docsTable.dragOverKey}
              onSort={(key) => { if (key !== 'actions') handleDocsSort(key as DocsSortField); }}
              sortKey={docsSortField}
              sortAsc={docsSortDirection === 'asc'}
              colors={colors}
              setHeaderRef={docsTable.setHeaderRef}
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16 }}
            />


            <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
              {documentsLoading ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Laden…</Text>
              ) : sortedDocuments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Noch keine Dokumente. Lade oben rechts dein erstes PDF hoch.</Text>
              ) : (
                sortedDocuments.map((doc) => {
                  const myId = session?.user?.id;
                  const isMine = !!myId && doc.uploaded_by === myId;
                  return (
                    <TableRow
                      key={doc.id}
                      columnOrder={docsTable.columnOrder}
                      getColumnWidth={docsTable.getColumnWidth}
                      onPress={() => openDocument(doc)}
                      style={[styles.tableRow, { borderBottomColor: colors.border }]}
                      renderCell={(key) => {
                        switch (key) {
                          case 'name':
                            return (
                              <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
                                {doc.player_last_name || '—'}
                              </Text>
                            );
                          case 'vorname':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{doc.player_first_name || '—'}</Text>;
                          case 'club': {
                            // target_club > player.club: bei Transfer-Vereinbarungen weicht der
                            // Bezug vom aktuellen Verein ab. Kleines Hint-Icon zeigt, dass es
                            // sich um einen anderen Verein als den aktuellen handelt.
                            const displayClub = doc.target_club || doc.player_club;
                            const isDifferent = !!doc.target_club && doc.target_club !== doc.player_club;
                            const logo = getClubLogo(displayClub);
                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                {logo ? <Image source={{ uri: logo }} style={{ width: 18, height: 18 }} resizeMode="contain" /> : null}
                                <Text style={[styles.tableCell, { color: colors.text, flex: 1 }]} numberOfLines={1}>{displayClub || '—'}</Text>
                                {isDifferent ? (
                                  <Ionicons name="arrow-forward" size={11} color="#22c55e" />
                                ) : null}
                              </View>
                            );
                          }
                          case 'doc_type':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{doc.doc_type || '—'}</Text>;
                          case 'created':
                            return <Text style={[styles.tableCell, { color: colors.text }]}>{new Date(doc.created_at).toLocaleDateString('de-DE')}</Text>;
                          case 'signed':
                            return (
                              <TouchableOpacity
                                onPress={(e: any) => { e?.stopPropagation?.(); toggleDocSigned(doc); }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                {doc.signed ? (
                                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                                ) : (
                                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                                )}
                              </TouchableOpacity>
                            );
                          case 'actions':
                            return (
                              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                {!doc.signed ? (
                                  <TouchableOpacity
                                    onPress={(e: any) => { e?.stopPropagation?.(); signDocument(doc); }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    disabled={signingDocId === doc.id}
                                  >
                                    <MaterialCommunityIcons name="file-document-edit-outline" size={14} color={signingDocId === doc.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'} />
                                  </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity onPress={(e: any) => { e?.stopPropagation?.(); downloadDocument(doc); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                  <Ionicons name="download-outline" size={13} color="rgba(255,255,255,0.85)" />
                                </TouchableOpacity>
                                {isMine ? (
                                  <TouchableOpacity onPress={(e: any) => { e?.stopPropagation?.(); deleteDocument(doc); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                    <Ionicons name="trash-outline" size={13} color="#ef4444" />
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            );
                          default:
                            return null;
                        }
                      }}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
        )}
      </View>

      {/* Upload-Modal: Spieler + Art wählen */}
      {/* Signier-Modal mit Drag-and-Drop der Signatur auf das PDF */}
      {signModalDoc ? (
        <View style={styles.docModalOverlay} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { if (!signSubmitting) closeSignModal(); }} />
          <View style={[styles.docModalBox, { maxWidth: 900, width: '95%', maxHeight: '92%', padding: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docModalTitle}>Signieren</Text>
                <Text style={styles.docModalSubtitle} numberOfLines={1}>{signModalDoc.filename}</Text>
              </View>
              <TouchableOpacity onPress={() => { if (!signSubmitting) closeSignModal(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, paddingHorizontal: 8 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Page-Navigation */}
            {signTotalPages > 1 && signPageImage ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => goToSignPage(signCurrentPage - 1)}
                  disabled={signCurrentPage <= 1}
                  style={{ paddingVertical: 4, paddingHorizontal: 10, opacity: signCurrentPage <= 1 ? 0.3 : 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16 }}>‹</Text>
                </TouchableOpacity>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Seite {signCurrentPage} / {signTotalPages}</Text>
                <TouchableOpacity
                  onPress={() => goToSignPage(signCurrentPage + 1)}
                  disabled={signCurrentPage >= signTotalPages}
                  style={{ paddingVertical: 4, paddingHorizontal: 10, opacity: signCurrentPage >= signTotalPages ? 0.3 : 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16 }}>›</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* PDF-Vorschau + Signatur-Overlay */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', overflow: 'auto' as any }}>
              {signLoading ? (
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: 24 }}>PDF wird geladen…</Text>
              ) : signError ? (
                <Text style={{ color: '#ef4444', fontSize: 13, padding: 24 }}>{signError}</Text>
              ) : signPageImage && signaturePngUrl && signPagePtSize ? (
                Platform.OS === 'web' ? (
                  <div
                    ref={signPageDivRef}
                    style={{
                      position: 'relative',
                      width: signPagePtSize.w * SIGN_RENDER_SCALE,
                      height: signPagePtSize.h * SIGN_RENDER_SCALE,
                      backgroundColor: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={signPageImage}
                      alt="PDF Seite"
                      style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
                      draggable={false}
                    />
                    <div
                      onMouseDown={onSignDragStart}
                      style={{
                        position: 'absolute',
                        left: signSigPx.x,
                        top: signSigPx.y,
                        width: signSigSizePx.w,
                        height: signSigSizePx.h,
                        cursor: 'move',
                        border: '1px dashed rgba(34, 197, 94, 0.7)',
                        backgroundImage: `url(${signaturePngUrl})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        userSelect: 'none',
                      }}
                      title="Signatur verschieben"
                    >
                      {/* Resize-Griff in der unteren rechten Ecke */}
                      <div
                        onMouseDown={onSignResizeStart}
                        style={{
                          position: 'absolute',
                          right: -7,
                          bottom: -7,
                          width: 14,
                          height: 14,
                          backgroundColor: '#22c55e',
                          border: '2px solid #fff',
                          borderRadius: '50%',
                          cursor: 'nwse-resize',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }}
                        title="Größe ändern"
                      />
                    </div>
                  </div>
                ) : (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: 24 }}>Signieren ist aktuell nur auf Web verfügbar.</Text>
                )
              ) : null}
            </View>

            {/* Footer */}
            <View style={styles.docModalFooter}>
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 11, alignSelf: 'center' }} numberOfLines={1}>
                Tipp: Signatur ziehen zum Verschieben · grüner Punkt = Größe ändern.
              </Text>
              <TouchableOpacity
                style={styles.docModalCancel}
                onPress={() => { if (!signSubmitting) closeSignModal(); }}
                disabled={signSubmitting}
              >
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docModalConfirm, (signSubmitting || !signPageImage || !signaturePngUrl) && { opacity: 0.5 }]}
                onPress={submitSignDocument}
                disabled={signSubmitting || !signPageImage || !signaturePngUrl}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{signSubmitting ? 'Signiere…' : 'Hier signieren'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showDocUploadModal ? (
        <View style={styles.docModalOverlay} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { if (!uploadingDoc) setShowDocUploadModal(false); }} />
          <View style={styles.docModalBox}>
            <Text style={styles.docModalTitle}>Dokument zuordnen</Text>
            <Text style={styles.docModalSubtitle} numberOfLines={1}>{pendingPickedFile?.name || ''}</Text>

            {/* Spieler-Auswahl mit Autocomplete */}
            <Text style={styles.docModalLabel}>Spieler</Text>
            {docSelectedPlayer ? (
              <View style={styles.docSelectedPlayerRow}>
                <Text style={styles.docSelectedPlayerText}>
                  {docSelectedPlayer.last_name}, {docSelectedPlayer.first_name}
                  {docSelectedPlayer.club ? `  ·  ${docSelectedPlayer.club}` : ''}
                </Text>
                <TouchableOpacity onPress={() => { setDocSelectedPlayer(null); setDocPlayerSearch(''); }}>
                  <Text style={{ color: '#ef4444', fontSize: 18, paddingHorizontal: 8 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.docPillInput}
                  value={docPlayerSearch}
                  onChangeText={setDocPlayerSearch}
                  placeholder="Spieler suchen (Name oder Verein)…"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
                {docPlayerSearch.trim().length > 0 ? (
                  <View style={styles.docSuggestList}>
                    {allPlayersLite
                      .filter(p => {
                        const q = docPlayerSearch.trim().toLowerCase();
                        return `${p.first_name ?? ''} ${p.last_name ?? ''} ${p.club ?? ''}`.toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map(p => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.docSuggestItem}
                          onPress={() => { setDocSelectedPlayer(p); setDocPlayerSearch(''); }}
                        >
                          <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
                            {p.last_name}, {p.first_name}
                            {p.club ? <Text style={{ color: 'rgba(255,255,255,0.5)' }}>  ·  {p.club}</Text> : null}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                ) : null}
              </>
            )}

            {/* Art-Auswahl */}
            <Text style={[styles.docModalLabel, { marginTop: 16 }]}>Art</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Provisionsvereinbarung', 'Wegvermittlung'] as const).map(t => {
                const isActive = docSelectedType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.docTypePill, isActive && styles.docTypePillActive]}
                    onPress={() => setDocSelectedType(t)}
                  >
                    <Text style={[styles.docTypePillText, isActive && styles.docTypePillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Ziel-Verein: zeigt sich erst, wenn Spieler gewählt ist. */}
            {docSelectedPlayer ? (
              docSelectedPlayer.future_club ? (
                <>
                  <Text style={[styles.docModalLabel, { marginTop: 16 }]}>Vereinbarung bezieht sich auf</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={[styles.docTypePill, docTargetClubChoice === 'current' && styles.docTypePillActive]}
                      onPress={() => setDocTargetClubChoice('current')}
                    >
                      <Text style={[styles.docTypePillText, docTargetClubChoice === 'current' && styles.docTypePillTextActive]}>
                        Aktueller Verein · {docSelectedPlayer.club || '—'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.docTypePill, docTargetClubChoice === 'future' && styles.docTypePillActive]}
                      onPress={() => setDocTargetClubChoice('future')}
                    >
                      <Text style={[styles.docTypePillText, docTargetClubChoice === 'future' && styles.docTypePillTextActive]}>
                        Neuer Verein · {docSelectedPlayer.future_club}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.docModalLabel, { marginTop: 16 }]}>
                    Falls die Vereinbarung sich auf einen neuen Verein bezieht (wird auch ins Spielerprofil eingetragen)
                  </Text>
                  <TextInput
                    style={styles.docPillInput}
                    value={docNewFutureClubInput}
                    onChangeText={handleDocClubSearchChange}
                    onFocus={() => setDocShowClubDropdown(true)}
                    placeholder={`Optional — sonst: ${docSelectedPlayer.club || 'aktueller Verein'}`}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                  />
                  {docShowClubDropdown && docNewFutureClubInput.trim().length > 0 ? (
                    <View style={styles.docSuggestList}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {docClubSearching ? (
                          <View style={styles.docSuggestItem}>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Suche auf Transfermarkt…</Text>
                          </View>
                        ) : null}
                        {docClubSearchResults.length > 0 ? (
                          <>
                            <View style={[styles.docSuggestItem, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Transfermarkt-Ergebnisse</Text>
                            </View>
                            {docClubSearchResults.map((club) => (
                              <TouchableOpacity
                                key={club.name}
                                style={styles.docSuggestItem}
                                onPress={() => selectDocClub(club)}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  {club.logoUrl ? (
                                    <Image source={{ uri: club.logoUrl }} style={{ width: 18, height: 18 }} resizeMode="contain" />
                                  ) : null}
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 13 }}>{club.name}</Text>
                                    {club.liga ? (
                                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{club.liga}{club.country ? ` · ${club.country}` : ''}</Text>
                                    ) : null}
                                  </View>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </>
                        ) : null}
                        {/* Freitext-Option, falls TM keinen passenden Treffer hat */}
                        {!docClubSearching && docNewFutureClubInput.trim() &&
                          !docClubSearchResults.some(c => c.name.toLowerCase() === docNewFutureClubInput.trim().toLowerCase()) ? (
                          <TouchableOpacity
                            style={[styles.docSuggestItem, { backgroundColor: 'rgba(34,197,94,0.12)' }]}
                            onPress={() => { setDocShowClubDropdown(false); }}
                          >
                            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>
                              + "{docNewFutureClubInput.trim()}" als Freitext übernehmen
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </>
              )
            ) : null}

            {/* Footer */}
            <View style={styles.docModalFooter}>
              <TouchableOpacity
                style={styles.docModalCancel}
                onPress={() => { if (!uploadingDoc) setShowDocUploadModal(false); }}
                disabled={uploadingDoc}
              >
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docModalConfirm, (uploadingDoc || !docSelectedPlayer || !docSelectedType) && { opacity: 0.5 }]}
                onPress={confirmDocumentUpload}
                disabled={uploadingDoc || !docSelectedPlayer || !docSelectedType}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{uploadingDoc ? 'Lade hoch…' : 'Hochladen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  containerMobile: { flex: 1 },
  mainContent: { flex: 1 },

  // Hero-Search-Input für die Dokumente-Suche
  docsHeroSearchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  docsHeroSearchIcon: { fontSize: 12, marginRight: 6, color: 'rgba(255,255,255,0.5)' },
  docsHeroSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  // Upload-Icon-Button im Header — exakt 28 px hoch wie Tabs + Suche.
  // overflow:hidden + box-sizing border-box damit der 1px-Border nicht draufaddiert.
  heroUploadIconBtn: {
    width: 32,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxSizing: 'border-box' } as any) : {}),
  },

  // Segmented Pill (Tabs im AdvisorHeroHeader, rechtsbündig — wie AufgabenScreen)
  segmentedAlignRight: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  segmentedWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    overflow: 'hidden',
    marginLeft: 'auto',
  },
  segmentedDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  segmentedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, justifyContent: 'center' },
  segmentedBtnActive: { backgroundColor: 'rgba(34,197,94,0.15)' },
  segmentedLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
  segmentedLabelActive: { color: '#fff' },
  segmentedCountPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 5, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  segmentedCountPillActive: { backgroundColor: '#22c55e' },
  segmentedCountText: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700' },
  segmentedCountTextActive: { color: '#fff' },

  // Dokumente-Tab
  docsToolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  docUploadBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docUploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  docActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionBtnDanger: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' },
  docActionText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  signedPill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  signedPillText: { fontSize: 11, fontWeight: '600' },

  // Upload-Modal (Spieler + Art)
  docModalOverlay: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
  },
  docModalBox: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 480,
  },
  docModalTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  docModalSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 },
  docModalLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  docPillInput: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  docSuggestList: {
    marginTop: 6,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    maxHeight: 220,
  },
  docSuggestItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  docSelectedPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  docSelectedPlayerText: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 },
  docTypePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  docTypePillActive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' },
  docTypePillText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  docTypePillTextActive: { color: '#fff' },
  docModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  docModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'transparent',
  },
  docModalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  header: { padding: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 24 },

  seasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 16 },
  financeHero: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16, marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  seasonArrow: { padding: 8 },
  seasonText: { fontSize: 18, fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700' },

  rowCount: { fontSize: 11, marginBottom: 12 },

  tableWrapper: { flex: 1, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  tableHeaderText: { fontWeight: '600', fontSize: 11 },
  tableBody: { flex: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, alignItems: 'center' },
  tableCell: { fontSize: 11 },

  colName: { flex: 0.9, minWidth: 100 },
  nameCell: { fontWeight: '500' },
  colClub: { flex: 0.9, minWidth: 90 },
  colLeague: { flex: 1.1, minWidth: 100 },
  colProvision: { flex: 0.7, minWidth: 70 },
  colAmount: { flex: 1, minWidth: 90 },
  colDue: { flex: 0.9, minWidth: 90 },

  statusBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 540, maxHeight: '85%', overflow: 'visible' as const },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  modalBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  modalBtnPrimary: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },

  // Form
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 11 },
  inputCompact: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 0, height: 30, fontSize: 11 },
  statusPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },

  // Upload
  uploadBtn: { flex: 1, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center' },
  uploadPdfBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, marginBottom: 6 },
  docItem: { flexDirection: 'row', alignItems: 'center', marginTop: 4, width: '100%' },

  // Currency toggle
  currencyToggle: { paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Rate section
  rateSection: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 16 },
  rateSectionTitle: { fontSize: 11, fontWeight: '600' },

  // Shares / Beteiligungen
  shareRow: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  addShareBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8, marginBottom: 8 },

  // Date Picker (matches TasksRemindersScreen)
  datePickerRow: { flexDirection: 'row', gap: 8 },
  dateDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 0, height: 30 },
  dateDropdownText: { fontSize: 11 },
  datePickerList: { position: 'absolute', top: '100%', left: 0, borderWidth: 1, borderRadius: 8, maxHeight: 200, zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 20, marginTop: 4, minWidth: 70 },
  datePickerItem: { padding: 10, borderBottomWidth: 1 },
  datePickerItemSelected: { backgroundColor: '#f0f9ff' },
  datePickerItemText: { fontSize: 11 },
  datePickerItemTextSelected: { color: '#3b82f6', fontWeight: '600' },

  // Mobile Card
  playerCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  playerCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  playerCardName: { fontSize: 11, fontWeight: '600', flex: 1 },
  playerCardBody: {},
  playerCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },

  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 11 },

  // Dokumente Mobile Cards
  mobileDocCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mobileDocName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  mobileDocClub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flexShrink: 1 },
  mobileDocMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },
});

