import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Pressable, Modal, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { AdvisorHeroHeader } from '../../components/AdvisorHeroHeader';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { PrototypePoster } from '../../components/PrototypePoster';
import {
  Prototype,
  POSITION_SHORTS,
  protoPositions,
  positionFullLabel,
  displayPrototypeName,
  getPrototypeImageUrl,
  PROTOTYPE_BUCKET,
} from '../../utils/prototypes';

async function uploadRoleModelImage(prototypeId: string, index: number): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const ext = (asset.name || 'jpg').split('.').pop() || 'jpg';
    const fileName = `${prototypeId || 'new'}/rolemodel_${index}_${Date.now()}.${ext}`;
    let fileData: any;
    if (Platform.OS === 'web') {
      const resp = await fetch(asset.uri);
      fileData = await resp.blob();
    } else {
      fileData = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'image/jpeg' };
    }
    const { error } = await supabase.storage.from(PROTOTYPE_BUCKET).upload(fileName, fileData, { contentType: asset.mimeType || 'image/jpeg', upsert: false });
    if (error) { if (typeof window !== 'undefined') window.alert('Upload-Fehler: ' + error.message); return null; }
    return fileName;
  } catch (e: any) {
    console.error('RoleModel upload error:', e);
    return null;
  }
}

export function PlayerPrototypesScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; photo_url?: string; role?: string } | null>(null);
  const [editing, setEditing] = useState<Prototype | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadProfile();
    loadPrototypes();
  }, [session]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('advisors').select('first_name, last_name, photo_url, role').eq('id', user.id).single();
      if (data) { setProfile(data); setIsAdmin(data.role === 'admin'); }
    }
  };

  const loadPrototypes = async () => {
    setLoading(true);
    const { data } = await supabase.from('player_prototypes').select('*').order('position_code').order('name');
    const list = (data as Prototype[]) || [];
    setPrototypes(list);
    setSelectedId(null);
    setLoading(false);
  };

  const openNew = () => {
    setEditing({
      id: '',
      name: '',
      position_code: 'DM',
      position_codes: ['DM'],
      description: '',
      requirements: [''],
      attributes: {},
      image_path: null,
      role_models: [''],
      role_model_images: [''],
    });
  };

  const startEdit = (p: Prototype) => {
    const rmNames = p.role_models && p.role_models.length > 0 ? [...p.role_models] : [];
    const rmImages = p.role_model_images && p.role_model_images.length > 0 ? [...p.role_model_images] : [];
    // Pad images zu gleicher Länge wie Namen
    while (rmImages.length < rmNames.length) rmImages.push('');
    rmNames.push(''); // leere Zeile für Zusatz
    rmImages.push('');
    setEditing({
      ...p,
      position_codes: protoPositions(p),
      requirements: p.requirements.length > 0 ? [...p.requirements, ''] : [''],
      role_models: rmNames,
      role_model_images: rmImages,
    });
  };

  const cancelEdit = () => setEditing(null);

  const uploadImage = async (prototypeId: string): Promise<string | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      setUploading(true);
      const fileName = `${prototypeId}/image_${Date.now()}.${(asset.name || 'jpg').split('.').pop()}`;
      let fileData: any;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        fileData = await resp.blob();
      } else {
        fileData = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'image/jpeg' };
      }
      const { error } = await supabase.storage.from(PROTOTYPE_BUCKET).upload(fileName, fileData, { contentType: asset.mimeType || 'image/jpeg', upsert: false });
      setUploading(false);
      if (error) { if (typeof window !== 'undefined') window.alert('Upload-Fehler: ' + error.message); return null; }
      return fileName;
    } catch (e: any) {
      setUploading(false);
      console.error('Upload error:', e);
      return null;
    }
  };

  const savePrototype = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { if (typeof window !== 'undefined') window.alert('Name erforderlich'); return; }
    setSaving(true);
    const cleanReqs = editing.requirements.map(r => r.trim()).filter(Boolean);
    // Role-Models + Images synchron filtern (Index-sync)
    const rmPairs = (editing.role_models || []).map((name, i) => ({
      name: (name || '').trim(),
      image: (editing.role_model_images && editing.role_model_images[i]) || '',
    })).filter(p => p.name || p.image);
    const cleanRoles = rmPairs.map(p => p.name);
    const cleanRoleImages = rmPairs.map(p => p.image);
    const codes = (editing.position_codes && editing.position_codes.length > 0) ? editing.position_codes : (editing.position_code ? [editing.position_code] : []);
    const payload = {
      name: editing.name.trim(),
      position_code: codes[0] || '',
      position_codes: codes,
      description: editing.description,
      requirements: cleanReqs,
      attributes: editing.attributes,
      image_path: editing.image_path,
      role_models: cleanRoles,
      role_model_images: cleanRoleImages,
    };
    if (editing.id) {
      const { error } = await supabase.from('player_prototypes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { if (typeof window !== 'undefined') window.alert('Fehler: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('player_prototypes').insert(payload);
      if (error) { if (typeof window !== 'undefined') window.alert('Fehler: ' + error.message); setSaving(false); return; }
    }
    setSaving(false);
    setEditing(null);
    loadPrototypes();
  };

  const deletePrototype = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Prototyp wirklich löschen?')) return;
    await supabase.from('player_prototypes').delete().eq('id', id);
    if (selectedId === id) setSelectedId(null);
    loadPrototypes();
  };

  const pickAndUpload = async () => {
    if (!editing) return;
    const id = editing.id || crypto.randomUUID?.() || `tmp-${Date.now()}`;
    const path = await uploadImage(id);
    if (path) setEditing({ ...editing, image_path: path });
  };

  const selectedPrototype = prototypes.find(p => p.id === selectedId) || null;

  const mainContent = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 16 : 32, paddingBottom: 80 }}>
      <View style={{ marginHorizontal: -32, marginTop: -32, marginBottom: 16 }}>
        <AdvisorHeroHeader title="SPIELER-PROTOTYPEN" subtitle="POSITIONS-PROFILE & ANFORDERUNGEN" backgroundImage={require('../../../assets/scouting-header-bg.jpg')} backgroundImageOpacity={0.45}>
          {prototypes.length > 0 && (
            <PrototypeSelectorDropdown
              prototypes={prototypes}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          <View style={{ flex: 1 }} />
          {isAdmin && (
            <TouchableOpacity style={{ height: 28, paddingVertical: 0, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={openNew}>
              <Ionicons name="add" size={13} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Neuer Prototyp</Text>
            </TouchableOpacity>
          )}
        </AdvisorHeroHeader>
      </View>

      {loading ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 24 }}>Lade…</Text>
      ) : prototypes.length === 0 ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 24 }}>
          {isAdmin ? 'Noch keine Prototypen — lege einen neuen an.' : 'Keine Prototypen vorhanden.'}
        </Text>
      ) : selectedPrototype ? (
        <View style={{ marginTop: 40, position: 'relative' }}>
          <PrototypePoster
            prototype={selectedPrototype}
            isAdmin={isAdmin}
            onEdit={() => startEdit(selectedPrototype)}
            onDelete={() => deletePrototype(selectedPrototype.id)}
          />
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, flexDirection: isMobile ? 'column' : 'row', backgroundColor: 'transparent' }}>
      <AdvisorBackground />
      {isMobile ? (
        <>
          <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="prototypes" profile={profile} />
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <MobileHeader title="Spieler-Prototypen" backgroundImage={require('../../../assets/scouting-header-bg.jpg')} onMenuPress={() => setShowMobileSidebar(true)} />
            {mainContent}
          </View>
        </>
      ) : (
        <>
          <Sidebar navigation={navigation} activeScreen="prototypes" profile={profile} />
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            {mainContent}
          </View>
        </>
      )}

      {/* Edit/Create */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={cancelEdit}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={cancelEdit} />
          <View style={styles.modalBox}>
            {editing && (
              <PrototypeEditView
                prototype={editing}
                onChange={(p) => setEditing(p)}
                onClose={cancelEdit}
                onSave={savePrototype}
                onUpload={pickAndUpload}
                uploading={uploading}
                saving={saving}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------- Sub-Components ----------

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Benutzerdefinierte Reihenfolge: IV, AV (LV+RV), DM, ZM, OM, AB (LA+RA), ST, TW
// Der Sort-Key ist die Position des ersten "relevanten" Codes
function sortKey(p: Prototype): number {
  const codes = protoPositions(p);
  const has = (c: string) => codes.includes(c);
  if (has('IV')) return 10;
  if (has('LV') || has('RV')) return 20; // Außenverteidiger
  if (has('DM') && !has('ZM')) return 30; // DM Spielmacher
  if (has('ZM')) return 40; // ZM / B2B
  if (has('OM')) return 50;
  if (has('LA') || has('RA')) return 60; // Außenbahn
  if (has('ST')) return 70;
  if (has('TW')) return 80;
  return 99;
}

function sortPrototypes(list: Prototype[]): Prototype[] {
  return [...list].sort((a, b) => {
    const sa = sortKey(a);
    const sb = sortKey(b);
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name, 'de');
  });
}

function PrototypeSelectorDropdown({ prototypes, selectedId, onSelect }: {
  prototypes: Prototype[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const sorted = sortPrototypes(prototypes);
  const current = prototypes.find(p => p.id === selectedId) || null;
  return (
    <View style={{ position: 'relative', zIndex: open ? 1000 : 1, width: 280 }}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{ height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 0 }}
      >
        <Text numberOfLines={1} style={{ fontSize: 11, color: current ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '500', flex: 1 }}>
          {current ? current.name : 'Prototyp auswählen…'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
      {open && (
        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12 }}>
          <ScrollView style={{ maxHeight: 380 }} nestedScrollEnabled>
            <TouchableOpacity
              style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}
              onPress={() => { onSelect(null); setOpen(false); }}
            >
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Leeren</Text>
            </TouchableOpacity>
            {sorted.map(p => {
              const isActive = p.id === selectedId;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'transparent' }}
                  onPress={() => { onSelect(p.id); setOpen(false); }}
                >
                  <Text style={{ fontSize: 13, color: isActive ? '#22c55e' : '#fff', fontWeight: isActive ? '600' : '500' }}>{displayPrototypeName(p.name)}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 0.5 }}>{positionFullLabel(protoPositions(p))}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function PrototypeCard({ prototype, onPress }: { prototype: Prototype; onPress: () => void }) {
  const imgUrl = getPrototypeImageUrl(prototype.image_path);
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardImageWrap}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 48, fontFamily: 'Josefin Sans', fontWeight: '300' }}>{prototype.position_code}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardPosition}>{prototype.position_code}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{displayPrototypeName(prototype.name)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function PrototypeEditView({ prototype, onChange, onClose, onSave, onUpload, uploading, saving }: {
  prototype: Prototype; onChange: (p: Prototype) => void; onClose: () => void; onSave: () => void; onUpload: () => void; uploading: boolean; saving: boolean;
}) {
  const [positionDropdownOpen, setPositionDropdownOpen] = useState(false);
  const imgUrl = getPrototypeImageUrl(prototype.image_path);
  const [keyWordsLocal, setKeyWordsLocal] = useState<string[]>(() => {
    const lines = (prototype.description || '').split('\n').map(l => l.replace(/^[-•·▸]\s*/, '').trim());
    return lines.length > 0 ? lines : [''];
  });
  return (
    <ScrollView>
      <View style={styles.detailHeader}>
        <Text style={styles.detailName}>{prototype.id ? 'Prototyp bearbeiten' : 'Neuer Prototyp'}</Text>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}><Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>✕</Text></TouchableOpacity>
      </View>

      {/* Bild-Upload */}
      <TouchableOpacity onPress={onUpload} style={{ marginBottom: 16 }}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={[styles.detailImage, { opacity: uploading ? 0.4 : 1 }]} resizeMode="cover" />
        ) : (
          <View style={[styles.detailImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed' }]}>
            <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.4)" />
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontSize: 12 }}>{uploading ? 'Lädt…' : 'Bild wählen'}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={{ gap: 14 }}>
        <View>
          <Text style={styles.detailFieldLabel}>Name</Text>
          <TextInput style={styles.input} value={prototype.name} onChangeText={(v) => onChange({ ...prototype, name: v })} placeholder="z.B. Moderner 6er – Spielmacher" placeholderTextColor="rgba(255,255,255,0.3)" />
        </View>

        <View>
          <Text style={styles.detailFieldLabel}>Positionen (Mehrfach möglich)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {POSITION_SHORTS.map(code => {
              const active = (prototype.position_codes || []).includes(code);
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => {
                    const codes = prototype.position_codes || [];
                    const next = active ? codes.filter(c => c !== code) : [...codes, code];
                    onChange({ ...prototype, position_codes: next, position_code: next[0] || '' });
                  }}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: active ? '#22c55e' : 'rgba(255,255,255,0.2)', backgroundColor: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#22c55e' : 'rgba(255,255,255,0.7)' }}>
                    {active ? '✓ ' : ''}{code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={styles.detailFieldLabel}>Weapons</Text>
          {prototype.requirements.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="chevron-forward-outline" size={10} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={[styles.input, { flex: 1, paddingVertical: 4 }]}
                value={r}
                onChangeText={(v) => {
                  const arr = [...prototype.requirements]; arr[i] = v; onChange({ ...prototype, requirements: arr });
                }}
                placeholder={`Weapon ${i + 1}`}
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity onPress={() => {
                const arr = prototype.requirements.filter((_, idx) => idx !== i);
                onChange({ ...prototype, requirements: arr.length > 0 ? arr : [''] });
              }}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => onChange({ ...prototype, requirements: [...prototype.requirements, ''] })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="add-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Weapon hinzufügen</Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={styles.detailFieldLabel}>Key Words</Text>
          {keyWordsLocal.map((kw, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="chevron-forward-outline" size={10} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={[styles.input, { flex: 1, paddingVertical: 4 }]}
                value={kw}
                onChangeText={(v) => {
                  const arr = [...keyWordsLocal]; arr[i] = v;
                  setKeyWordsLocal(arr);
                  onChange({ ...prototype, description: arr.map(k => k.trim()).filter(Boolean).map(k => '- ' + k).join('\n') });
                }}
                placeholder={`Key Word ${i + 1}`}
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity onPress={() => {
                const arr = keyWordsLocal.filter((_, idx) => idx !== i);
                const next = arr.length > 0 ? arr : [''];
                setKeyWordsLocal(next);
                onChange({ ...prototype, description: next.map(k => k.trim()).filter(Boolean).map(k => '- ' + k).join('\n') });
              }}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => setKeyWordsLocal([...keyWordsLocal, ''])} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="add-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Key Word hinzufügen</Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={styles.detailFieldLabel}>Role Models (Vergleichsspieler)</Text>
          {(prototype.role_models || []).map((rm, i) => {
            const imgPath = (prototype.role_model_images || [])[i] || '';
            const imgUrl = getPrototypeImageUrl(imgPath);
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    const path = await uploadRoleModelImage(prototype.id || 'new', i);
                    if (path) {
                      const imgs = [...(prototype.role_model_images || [])];
                      while (imgs.length <= i) imgs.push('');
                      imgs[i] = path;
                      onChange({ ...prototype, role_model_images: imgs });
                    }
                  }}
                  style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={16} color="rgba(255,255,255,0.5)" />
                  )}
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1, paddingVertical: 4 }]}
                  value={rm}
                  onChangeText={(v) => {
                    const arr = [...(prototype.role_models || [])]; arr[i] = v; onChange({ ...prototype, role_models: arr });
                  }}
                  placeholder={`Role Model ${i + 1}`}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                <TouchableOpacity onPress={() => {
                  const names = (prototype.role_models || []).filter((_, idx) => idx !== i);
                  const imgs = (prototype.role_model_images || []).filter((_, idx) => idx !== i);
                  onChange({ ...prototype, role_models: names.length > 0 ? names : [''], role_model_images: imgs.length > 0 ? imgs : [''] });
                }}>
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity
            onPress={() => onChange({ ...prototype, role_models: [...(prototype.role_models || []), ''], role_model_images: [...(prototype.role_model_images || []), ''] })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
          >
            <Ionicons name="add-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Role Model hinzufügen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
          <Text style={styles.cancelBtnText}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Speichere…' : 'Speichern'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: '#fff' },
  subtitle: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#22c55e' },
  newBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipActive: { backgroundColor: 'rgba(34,197,94,0.2)', borderColor: '#22c55e' },
  chipText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  chipTextActive: { color: '#22c55e' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { width: 220, height: 260, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  cardImageWrap: { height: 160, backgroundColor: 'rgba(0,0,0,0.3)' },
  cardImage: { width: '100%', height: '100%' },
  cardFooter: { padding: 14, flex: 1, justifyContent: 'space-between' },
  cardPosition: { fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: '600', letterSpacing: 2, color: '#22c55e', textTransform: 'uppercase' },
  cardTitle: { fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: '400', letterSpacing: 1, color: '#fff', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  modalBox: { width: '100%', maxWidth: 780, maxHeight: '100%', backgroundColor: '#000', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  detailPosition: { fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: '600', letterSpacing: 2, color: '#22c55e', textTransform: 'uppercase', marginBottom: 4 },
  detailName: { fontFamily: 'Josefin Sans', fontSize: 22, fontWeight: '400', letterSpacing: 1, color: '#fff' },
  detailImage: { width: '100%', height: 220, borderRadius: 10 },
  detailSectionLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 },
  detailText: { fontSize: 13, fontWeight: '500', color: '#fff' },
  posterSectionLabel: { fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: '400', letterSpacing: 4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  posterText: { fontSize: 14, fontWeight: '400', color: '#fff', letterSpacing: 0.3 },
  detailFieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 6 },

  barBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },

  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  input: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' },
  dropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6, zIndex: 1000 },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },

  cancelBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  saveBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#22c55e' },
  saveBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
