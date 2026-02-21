import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Modal, TextInput, Alert, Platform, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Sidebar } from '../../components/Sidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';

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
  type: 'provision' | 'player_only';
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
  const { session } = useAuth();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(getCurrentSeason());
  const [players, setPlayers] = useState<Player[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

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
  const [activeDatePicker, setActiveDatePicker] = useState<{ rateIdx: number; part: 'day' | 'month' | 'year' } | null>(null);
  const [detailProvDocs, setDetailProvDocs] = useState<any[]>([]);
  const [detailContractDocs, setDetailContractDocs] = useState<any[]>([]);
  const [detailShares, setDetailShares] = useState<{ name: string; percentage: string; type: string; notes: string }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [detailAnnualSalary, setDetailAnnualSalary] = useState('');
  const [detailProvBasis, setDetailProvBasis] = useState('');
  const [detailProvSalaryMonths, setDetailProvSalaryMonths] = useState<number | null>(null);
  const [detailContractSalaryPeriods, setDetailContractSalaryPeriods] = useState<any[]>([]);
  const [detailMonthlySalary, setDetailMonthlySalary] = useState<number>(0);

  // --- Data Loading ---

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [playersRes, provsRes] = await Promise.all([
      supabase
        .from('player_details')
        .select('id, first_name, last_name, club, league, provision, provision_documents, contract_documents, commission_shares')
        .or('responsibility.ilike.%Matti%,responsibility.ilike.%Langer%')
        .order('last_name'),
      supabase
        .from('player_provisions')
        .select('id, player_id, season, amount, status, due_date')
        .eq('season', season),
    ]);
    if (playersRes.data) setPlayers(playersRes.data);
    if (provsRes.data) setProvisions(provsRes.data);
    setLoading(false);
  }, [season]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Build Display Rows ---

  const displayRows: DisplayRow[] = useMemo(() => {
    const rows: DisplayRow[] = [];
    const playerIdsWithProv = new Set<string>();
    for (const prov of provisions) {
      const player = players.find(p => p.id === prov.player_id);
      if (!player) continue;
      playerIdsWithProv.add(prov.player_id);
      rows.push({
        type: 'provision', key: prov.id, provisionId: prov.id, player_id: prov.player_id,
        first_name: player.first_name, last_name: player.last_name, club: player.club,
        league: player.league, provisionPercent: player.provision, amount: Number(prov.amount) || 0,
        status: prov.status || 'offen', due_date: prov.due_date,
      });
    }
    for (const player of players) {
      if (playerIdsWithProv.has(player.id)) continue;
      rows.push({
        type: 'player_only', key: `p_${player.id}`, provisionId: null, player_id: player.id,
        first_name: player.first_name, last_name: player.last_name, club: player.club,
        league: player.league, provisionPercent: player.provision, amount: 0, status: '', due_date: null,
      });
    }
    return rows;
  }, [players, provisions]);

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
    setActiveDatePicker(null);
    setShowRateDropdown(false);
    setDetailCurrency('EUR');
    setDetailAnnualSalary('');
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
      setDetailTotalAmount(totalAmt.toString().replace('.', ','));
      setDetailRates(existing.map(p => {
        const d = p.due_date ? new Date(p.due_date) : null;
        return {
          amount: (Number(p.amount) || 0).toString().replace('.', ','),
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
    const total = parseFloat(detailTotalAmount.replace(',', '.')) || 0;
    const perRate = count > 0 ? (total / count).toFixed(2).replace('.', ',') : '';
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

  const updateTotalAmount = (val: string) => {
    setDetailTotalAmount(val);
    const total = parseFloat(val.replace(',', '.')) || 0;
    const perRate = detailRateCount && detailRateCount > 0 ? (total / detailRateCount).toFixed(2).replace('.', ',') : '';
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

    // Insert new rates
    const inserts = detailRates.map(r => ({
      player_id: detailPlayerId,
      season,
      amount: parseFloat(r.amount.replace(',', '.')) || 0,
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

    setShowDetail(false);
    fetchData();
  };

  const deleteAllProvisions = () => {
    const existingIds = provisions.filter(p => p.player_id === detailPlayerId).map(p => p.id);
    if (existingIds.length === 0) return;
    const player = players.find(p => p.id === detailPlayerId);
    const name = player ? `${player.last_name}, ${player.first_name}` : '';

    if (Platform.OS === 'web') {
      if (window.confirm(`Alle Provisionen für ${name} löschen?`)) {
        supabase.from('player_provisions').delete().in('id', existingIds).then(() => {
          setShowDetail(false);
          fetchData();
        });
      }
    } else {
      Alert.alert('Löschen', `Alle Provisionen für ${name} löschen?`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => {
          supabase.from('player_provisions').delete().in('id', existingIds).then(() => {
            setShowDetail(false);
            fetchData();
          });
        }},
      ]);
    }
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
        if (Platform.OS === 'web') window.alert('Upload fehlgeschlagen: ' + uploadError.message);
        else Alert.alert('Fehler', uploadError.message);
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
      if (Platform.OS === 'web') window.alert('Dokument konnte nicht hochgeladen werden');
      else Alert.alert('Fehler', 'Dokument konnte nicht hochgeladen werden');
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

    if (Platform.OS === 'web') {
      if (window.confirm('Dokument löschen?')) doDelete();
    } else {
      Alert.alert('Löschen', 'Dokument löschen?', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: doDelete },
      ]);
    }
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
        if (Platform.OS === 'web') window.alert('Provisionsvereinbarung hochgeladen, konnte aber nicht automatisch analysiert werden.');
        else Alert.alert('Hinweis', 'PDF hochgeladen, konnte aber nicht automatisch analysiert werden.');
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

      if (Platform.OS === 'web') window.alert('Provisionsvereinbarung wurde analysiert und die Felder automatisch ausgefüllt.');
      else Alert.alert('Erfolg', 'Provisionsvereinbarung wurde analysiert und die Felder automatisch ausgefüllt.');
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
        if (Platform.OS === 'web') window.alert('Vertrag hochgeladen, konnte aber nicht automatisch analysiert werden.');
        else Alert.alert('Hinweis', 'PDF hochgeladen, konnte aber nicht automatisch analysiert werden.');
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
        <View style={styles.colClub}>
          <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{row.club || '-'}</Text>
        </View>
        <View style={styles.colLeague}>
          <Text style={[styles.tableCell, { color: colors.textMuted, fontSize: 12 }]} numberOfLines={1}>{row.league || '-'}</Text>
        </View>
        <View style={styles.colProvision}>
          <Text style={[styles.tableCell, { color: colors.text }]}>
            {row.provisionPercent ? `${row.provisionPercent}%` : '-'}
          </Text>
        </View>
        <View style={styles.colAmount}>
          <Text style={[styles.tableCell, { color: colors.text, fontWeight: isProv ? '600' : '400' }]}>
            {isProv && row.amount > 0 ? formatCurrency(row.amount) : '-'}
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
            <Text style={[{ color: colors.text, fontSize: 13, flex: 1 }]} numberOfLines={1}>{row.club || '-'}</Text>
            {row.league ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{row.league}</Text> : null}
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{row.provisionPercent ? `${row.provisionPercent}%` : ''}</Text>
          </View>
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
    <View style={[styles.summaryRow, isMobile && { flexDirection: 'column' }]}>
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Offen</Text>
        <Text style={[styles.summaryValue, { color: '#d97706' }]}>{formatCurrency(totals.offen)}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Bezahlt</Text>
        <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{formatCurrency(totals.bezahlt)}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
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
        <View style={{ position: 'relative', flex: 2, zIndex: isActiveMonth ? 102 : 1 }}>
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

  const renderDetailModal = () => (
    <Modal visible={showDetail} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setShowDetail(false)}>
        <Pressable style={[styles.modalContent, { backgroundColor: colors.cardBackground }]} onPress={e => { e.stopPropagation(); setActiveDatePicker(null); setShowRateDropdown(false); }}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {detailPlayer ? `${detailPlayer.last_name}, ${detailPlayer.first_name}` : 'Provision'}
              </Text>
              {detailPlayer?.club && (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{detailPlayer.club}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowDetail(false)}>
              <Text style={{ color: colors.textMuted, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[{ flex: 1 }, (activeDatePicker || showRateDropdown) ? { overflow: 'visible' as any } : {}]}
            scrollEnabled={!activeDatePicker && !showRateDropdown}
            nestedScrollEnabled
          >
            {/* Dokumente */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Dokumente</Text>
              {parsing && <Text style={{ color: '#3b82f6', fontSize: 11 }}>Wird analysiert...</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {/* Provisionsvereinbarung */}
              <View style={[styles.uploadBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📄</Text>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '500', textAlign: 'center', marginBottom: 8 }}>Provisionsvereinbarung</Text>
                <TouchableOpacity
                  style={[styles.uploadPdfBtn, { backgroundColor: colors.border }]}
                  onPress={() => uploadDoc('provision_documents')}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>+ PDF</Text>
                </TouchableOpacity>
                {detailProvDocs.map((doc: any, i: number) => (
                  <View key={i} style={styles.docItem}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(doc.url)}>
                      <Text style={{ color: '#3b82f6', fontSize: 11 }} numberOfLines={1}>📄 {doc.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDoc(doc.path, 'provision_documents')}>
                      <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700', paddingLeft: 6 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {/* Vertrag */}
              <View style={[styles.uploadBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📋</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '500', textAlign: 'center', marginBottom: 8 }}>Vertrag</Text>
                <TouchableOpacity
                  style={[styles.uploadPdfBtn, { backgroundColor: colors.border }]}
                  onPress={() => uploadDoc('contract_documents')}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>+ PDF</Text>
                </TouchableOpacity>
                {detailContractDocs.map((doc: any, i: number) => (
                  <View key={i} style={styles.docItem}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(doc.url)}>
                      <Text style={{ color: '#3b82f6', fontSize: 11 }} numberOfLines={1}>📄 {doc.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDoc(doc.path, 'contract_documents')}>
                      <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700', paddingLeft: 6 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Saisongehalt */}
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Gehalt Saison {season}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TextInput
                  style={[styles.inputCompact, { width: 140, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="z.B. 24.000"
                  placeholderTextColor={colors.textMuted}
                  value={detailAnnualSalary}
                  onChangeText={(val) => {
                    setDetailAnnualSalary(val);
                    const basis = detailProvBasis || (detailProvPercent ? 'prozent_jahresgehalt' : '');
                    if (basis) {
                      computeProvision(val, basis, detailProvPercent, detailProvSalaryMonths, detailTotalAmount, detailRateCount, detailRates, detailMonthlySalary || undefined);
                    }
                  }}
                  keyboardType="numeric"
                />
                <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>{detailCurrency === 'EUR' ? '€' : '$'} / Saison</Text>
              </View>
            </View>

            {/* Provision + Gesamtsumme + Raten in einer Reihe */}
            <View style={{ flexDirection: 'row', gap: 12, zIndex: showRateDropdown ? 200 : 1 }}>
              {/* Provision */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Provision</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.inputCompact, { width: 48, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="10"
                    placeholderTextColor={colors.textMuted}
                    value={detailProvPercent}
                    onChangeText={setDetailProvPercent}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', marginLeft: 4 }}>%</Text>
                </View>
              </View>
              {/* Gesamtsumme */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Gesamtsumme</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TextInput
                    style={[styles.inputCompact, { width: 100, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="1.000,00"
                    placeholderTextColor={colors.textMuted}
                    value={detailTotalAmount}
                    onChangeText={updateTotalAmount}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={[styles.currencyToggle, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => setDetailCurrency(c => c === 'EUR' ? 'USD' : 'EUR')}
                  >
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{detailCurrency === 'EUR' ? '€' : '$'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Anzahl Raten */}
              <View style={{ flex: 1, position: 'relative' }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Raten</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => { setShowRateDropdown(!showRateDropdown); setActiveDatePicker(null); }}
                >
                  <Text style={{ color: detailRateCount ? colors.text : colors.textMuted, fontSize: 13 }}>
                    {detailRateCount ?? '-'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                {showRateDropdown && (
                  <View style={[styles.datePickerList, { backgroundColor: dropdownBg, borderColor: colors.border }]}>
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
              <View key={idx} style={[styles.rateSection, { borderColor: colors.border, zIndex: activeDatePicker?.rateIdx === idx ? 200 : 1 }]}>
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

  // --- Mobile View ---

  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: colors.background }]}>
        <MobileHeader title="Finanzen" onMenuPress={() => setShowMobileSidebar(true)} navigation={navigation} />
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="finanzen" />
        {renderDetailModal()}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
          <View style={styles.seasonRow}>
            <Pressable onPress={() => changeSeason(-1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 18 }}>◀</Text></Pressable>
            <Text style={[styles.seasonText, { color: colors.text }]}>{season}</Text>
            <Pressable onPress={() => changeSeason(1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 18 }}>▶</Text></Pressable>
          </View>
          {renderSummary()}
          <Text style={[styles.rowCount, { color: colors.textMuted }]}>{provisionCount} Provisionen · {playerOnlyCount} ohne Einträge</Text>
          {loading ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>Laden...</Text> : sortedRows.map(renderCard)}
        </ScrollView>
      </View>
    );
  }

  // --- Desktop View ---

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="finanzen" />
      {renderDetailModal()}

      <View style={styles.mainContent}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Finanzen</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.seasonRow}>
            <Pressable onPress={() => changeSeason(-1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 20 }}>◀</Text></Pressable>
            <Text style={[styles.seasonText, { color: colors.text }]}>{season}</Text>
            <Pressable onPress={() => changeSeason(1)} style={styles.seasonArrow}><Text style={{ color: colors.text, fontSize: 20 }}>▶</Text></Pressable>
          </View>

          {renderSummary()}

          <Text style={[styles.rowCount, { color: colors.textMuted }]}>{provisionCount} Provisionen · {playerOnlyCount} Spieler ohne Einträge</Text>

          <View style={[styles.tableWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
              {renderSortableHeader('Name', 'name', styles.colName)}
              {renderSortableHeader('Verein', 'club', styles.colClub)}
              {renderSortableHeader('Liga', 'league', styles.colLeague)}
              {renderSortableHeader('Provision (%)', 'provision', styles.colProvision)}
              {renderSortableHeader('Summe (€)', 'amount', styles.colAmount)}
              {renderSortableHeader('Fälligkeit', 'due', styles.colDue)}
            </View>

            <ScrollView style={styles.tableBody}>
              {loading ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Laden...</Text>
              ) : sortedRows.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Keine Spieler gefunden.</Text>
              ) : (
                sortedRows.map(renderRow)
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  containerMobile: { flex: 1 },
  mainContent: { flex: 1 },
  header: { padding: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '700' },
  content: { flex: 1, padding: 24 },

  seasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 16 },
  seasonArrow: { padding: 8 },
  seasonText: { fontSize: 20, fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700' },

  rowCount: { fontSize: 13, marginBottom: 12 },

  tableWrapper: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  tableHeaderText: { fontWeight: '600', fontSize: 13 },
  tableBody: { maxHeight: 600 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, alignItems: 'center' },
  tableCell: { fontSize: 14 },

  colName: { flex: 0.9, minWidth: 100 },
  nameCell: { fontWeight: '500' },
  colClub: { flex: 0.9, minWidth: 90 },
  colLeague: { flex: 1.1, minWidth: 100 },
  colProvision: { flex: 0.7, minWidth: 70 },
  colAmount: { flex: 1, minWidth: 90 },
  colDue: { flex: 0.9, minWidth: 90 },

  statusBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, padding: 24, width: '90%', maxWidth: 540, maxHeight: '85%', overflow: 'visible' as const },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  modalBtnPrimary: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },

  // Form
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  inputCompact: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  statusPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },

  // Upload
  uploadBtn: { flex: 1, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center' },
  uploadPdfBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, marginBottom: 6 },
  docItem: { flexDirection: 'row', alignItems: 'center', marginTop: 4, width: '100%' },

  // Currency toggle
  currencyToggle: { width: 34, height: 34, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Rate section
  rateSection: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 16 },
  rateSectionTitle: { fontSize: 14, fontWeight: '600' },

  // Shares / Beteiligungen
  shareRow: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  addShareBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8, marginBottom: 8 },

  // Date Picker (matches TasksRemindersScreen)
  datePickerRow: { flexDirection: 'row', gap: 8 },
  dateDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10 },
  dateDropdownText: { fontSize: 13 },
  datePickerList: { position: 'absolute', top: '100%', left: 0, borderWidth: 1, borderRadius: 8, maxHeight: 200, zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 20, marginTop: 4, minWidth: 70 },
  datePickerItem: { padding: 10, borderBottomWidth: 1 },
  datePickerItemSelected: { backgroundColor: '#f0f9ff' },
  datePickerItemText: { fontSize: 13 },
  datePickerItemTextSelected: { color: '#3b82f6', fontWeight: '600' },

  // Mobile Card
  playerCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  playerCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  playerCardName: { fontSize: 15, fontWeight: '600', flex: 1 },
  playerCardBody: {},
  playerCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },

  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

