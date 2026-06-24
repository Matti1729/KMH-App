import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Kandidaten-Shapes (Spiegel der Edge-Function-Antwort).
export interface ImportValue { type: string | null; value: number; unit: string; confidence: 'high' | 'low'; source: string; outOfRange: boolean; warnings: string[]; }
export interface ImportRow { date: string | null; label: string; values: ImportValue[]; }
export interface PreparedInsert { type: string; value: number; measured_at: string; }

const TYPE_LABELS: Record<string, string> = {
  height: 'Größe', weight: 'Gewicht',
  sprint_10m: 'Sprint 10m', sprint_20m: 'Sprint 20m', sprint_30m: 'Sprint 30m', vmax: 'Vmax',
  cmj: 'Countermovement Jump', sj: 'Squat Jump', dj: 'Drop Jump', dj_rsi: 'Drop Jump RSI', ht: 'Hop Test', ht_rsi: 'Hop Test RSI',
};
const TYPE_KEYS = Object.keys(TYPE_LABELS);
const unitFor = (type: string): string => {
  if (type.startsWith('sprint')) return 's';
  if (type === 'vmax') return 'km/h';
  if (type === 'weight') return 'kg';
  if (['cmj', 'sj', 'dj', 'ht', 'height'].includes(type)) return 'cm';
  return '';
};
const parseNum = (v: string) => parseFloat(v.replace(',', '.'));

const DAY_OPTS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const MONTH_OPTS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const YEAR_OPTS = (() => { const cy = new Date().getFullYear(); return Array.from({ length: cy - 2015 + 1 }, (_, i) => String(cy - i)); })();

interface VState { include: boolean; value: string; type: string | null; source: string; outOfRange: boolean; confidence: 'high' | 'low'; warnings: string[]; }
interface SState { date: string; label: string; values: VState[] }

interface Props {
  visible: boolean;
  onClose: () => void;
  rows: ImportRow[];
  unmapped: { header: string; sample: string }[];
  sourceLabel: string; // z.B. Dateiname
  existing: Array<{ type: string; measured_at: string }>;
  importing: boolean;
  onConfirm: (inserts: PreparedInsert[], note: string) => void;
}

export function PerformanceImportModal({ visible, onClose, rows, unmapped, sourceLabel, existing, importing, onConfirm }: Props) {
  const [sections, setSections] = useState<SState[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null); // "<si>:<part>" für Dropdowns

  useEffect(() => {
    if (!visible) return;
    setSections(rows.map(r => ({
      date: r.date || '',
      label: r.label || '',
      values: r.values.map(v => ({
        include: !v.outOfRange && !!v.type, // Ausreißer / nicht-zugeordnete nicht vorausgewählt
        value: String(v.value).replace('.', ','),
        type: v.type,
        source: v.source,
        outOfRange: v.outOfRange,
        confidence: v.confidence,
        warnings: v.warnings || [],
      })),
    })));
    setOpenKey(null);
  }, [visible, rows]);

  const existsFor = (type: string, date: string) => existing.some(e => e.type === type && e.measured_at === date);

  const setDatePart = (si: number, part: 'day' | 'month' | 'year', val: string) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const [y = '', m = '', d = ''] = (s.date || '').split('-');
      const cy = String(new Date().getFullYear());
      const ny = part === 'year' ? val : (y || cy);
      const nm = (part === 'month' ? val : (m ? String(parseInt(m, 10)) : '')).padStart(2, '0');
      const nd = (part === 'day' ? val : (d ? String(parseInt(d, 10)) : '')).padStart(2, '0');
      if (!ny || nm === '00' || nd === '00') return { ...s, date: '' };
      return { ...s, date: `${ny}-${nm}-${nd}` };
    }));
  };
  const updateValue = (si: number, vi: number, patch: Partial<VState>) =>
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, values: s.values.map((v, j) => j !== vi ? v : { ...v, ...patch }) }));

  // Übernehmbare Inserts zählen.
  const inserts: PreparedInsert[] = [];
  for (const s of sections) {
    if (!s.date) continue;
    for (const v of s.values) {
      if (!v.include || !v.type) continue;
      const num = parseNum(v.value);
      if (isNaN(num)) continue;
      inserts.push({ type: v.type, value: num, measured_at: s.date });
    }
  }
  const blockedNoDate = sections.some(s => !s.date && s.values.some(v => v.include && v.type));

  const fmtDate = (iso: string) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };

  const renderDateDropdowns = (si: number, s: SState) => {
    const [y = '', m = '', d = ''] = (s.date || '').split('-');
    const dVal = d ? String(parseInt(d, 10)) : '';
    const mVal = m ? String(parseInt(m, 10)) : '';
    const fields = [
      { part: 'day' as const, label: 'TAG', value: dVal, opts: DAY_OPTS, w: 64 },
      { part: 'month' as const, label: 'MONAT', value: mVal, opts: MONTH_OPTS, w: 72 },
      { part: 'year' as const, label: 'JAHR', value: y, opts: YEAR_OPTS, w: 80 },
    ];
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {fields.map(f => {
          const k = `${si}:${f.part}`;
          return (
            <View key={f.part} style={{ zIndex: openKey === k ? 50 : 1 }} {...({ dataSet: { kmhdropdown: 'true' } } as any)}>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{f.label}</Text>
              <Pressable onPress={() => setOpenKey(o => o === k ? null : k)} style={{ width: f.w, height: 34, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: f.value ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13 }}>{f.value || '–'}</Text>
                <Ionicons name={openKey === k ? 'chevron-up' : 'chevron-down'} size={11} color="rgba(255,255,255,0.5)" />
              </Pressable>
              {openKey === k && (
                <View style={{ position: 'absolute', top: 50, left: 0, width: Math.max(f.w, 70), maxHeight: 168, backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', zIndex: 60 }}>
                  <ScrollView nestedScrollEnabled>
                    {f.opts.map(opt => (
                      <TouchableOpacity key={opt} onPress={() => { setDatePart(si, f.part, opt); setOpenKey(null); }} style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: f.value === opt ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                        <Text style={{ color: '#fff', fontSize: 13 }}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderTypePicker = (si: number, vi: number, v: VState) => {
    const k = `${si}:t${vi}`;
    return (
      <View style={{ zIndex: openKey === k ? 50 : 1, minWidth: 150 }} {...({ dataSet: { kmhdropdown: 'true' } } as any)}>
        <Pressable onPress={() => setOpenKey(o => o === k ? null : k)} style={{ height: 34, borderRadius: 6, borderWidth: 1, borderColor: v.type ? 'rgba(255,255,255,0.2)' : '#f59e0b', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: v.type ? '#fff' : '#f59e0b', fontSize: 12 }}>{v.type ? TYPE_LABELS[v.type] : 'Feld wählen …'}</Text>
          <Ionicons name={openKey === k ? 'chevron-up' : 'chevron-down'} size={11} color="rgba(255,255,255,0.5)" />
        </Pressable>
        {openKey === k && (
          <View style={{ position: 'absolute', top: 38, left: 0, width: 200, maxHeight: 220, backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', zIndex: 60 }}>
            <ScrollView nestedScrollEnabled>
              <TouchableOpacity onPress={() => { updateValue(si, vi, { type: null, include: false }); setOpenKey(null); }} style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontStyle: 'italic' }}>ignorieren</Text>
              </TouchableOpacity>
              {TYPE_KEYS.map(tk => (
                <TouchableOpacity key={tk} onPress={() => { updateValue(si, vi, { type: tk, include: true }); setOpenKey(null); }} style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: v.type === tk ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>{TYPE_LABELS[tk]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => (openKey ? setOpenKey(null) : onClose())} />
        <View style={{ width: '100%', maxWidth: 760, maxHeight: '88%', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Werte prüfen & übernehmen</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }} numberOfLines={1}>{sourceLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16 }}>
            {sections.length === 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>Keine auslesbaren Werte gefunden.</Text>
            )}
            {sections.map((s, si) => (
              <View key={si} style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, zIndex: 5 }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>Testdatum{s.label ? ` · ${s.label}` : ''}</Text>
                    {renderDateDropdowns(si, s)}
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 18 }}>{fmtDate(s.date)}</Text>
                </View>

                {s.values.map((v, vi) => {
                  const dup = !!v.type && !!s.date && existsFor(v.type, s.date);
                  const warn = v.outOfRange || v.confidence === 'low' || v.warnings.length > 0;
                  return (
                    <View key={vi} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: vi === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.05)', zIndex: 100 - vi }}>
                      <TouchableOpacity onPress={() => updateValue(si, vi, { include: !v.include })} disabled={!v.type} style={{ opacity: v.type ? 1 : 0.4 }}>
                        <Ionicons name={v.include && v.type ? 'checkbox' : 'square-outline'} size={20} color={v.include && v.type ? '#22c55e' : 'rgba(255,255,255,0.4)'} />
                      </TouchableOpacity>

                      {v.type ? (
                        <Text style={{ color: '#fff', fontSize: 13, width: 160 }} numberOfLines={1}>{TYPE_LABELS[v.type]}</Text>
                      ) : (
                        renderTypePicker(si, vi, v)
                      )}

                      <TextInput
                        value={v.value}
                        onChangeText={t => updateValue(si, vi, { value: t })}
                        keyboardType="numeric"
                        style={{ width: 80, height: 34, borderRadius: 6, borderWidth: 1, borderColor: v.outOfRange ? '#ef4444' : 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, paddingHorizontal: 8, textAlign: 'right' }}
                      />
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, width: 36 }}>{v.type ? unitFor(v.type) : ''}</Text>

                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                        {v.outOfRange && <Badge color="#ef4444" text="unplausibel" />}
                        {v.confidence === 'low' && <Badge color="#f59e0b" text="unsicher" />}
                        {v.warnings.map((w, wi) => <Badge key={wi} color="#3b82f6" text={w} />)}
                        {dup && <Badge color="#a855f7" text="ersetzt vorhandenen" />}
                        {!warn && !dup && v.type ? <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }} numberOfLines={1}>{v.source}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {unmapped.length > 0 && (
              <View style={{ marginTop: 4, padding: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' }}>
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Nicht automatisch zugeordnete Spalten</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  {unmapped.map(u => `${u.header} (z.B. ${u.sample})`).join(', ')}. Diese erscheinen oben pro Zeile mit „Feld wählen …" und können manuell zugeordnet werden.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
              {inserts.length} Wert{inserts.length === 1 ? '' : 'e'} ausgewählt{blockedNoDate ? ' · Datum fehlt' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onConfirm(inserts, sourceLabel)}
                disabled={importing || inserts.length === 0 || blockedNoDate}
                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: (inserts.length === 0 || blockedNoDate) ? 'rgba(34,197,94,0.3)' : '#22c55e', flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                {importing && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Übernehmen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}55` }}>
      <Text style={{ color, fontSize: 9, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}
