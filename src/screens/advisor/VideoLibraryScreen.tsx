import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Pressable, Modal, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { AdvisorHeroHeader } from '../../components/AdvisorHeroHeader';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useDialog } from '../../components/DialogProvider';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';

const VIDEO_BUCKET = 'player-videos';
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30 MB

type VideoPhase = 'negative' | 'positive' | 'neutral';

interface VideoRow {
  id: string;
  video_path: string | null;
  video_url: string | null;
  label: string;
  description: string | null;
  role_model_name: string | null;
  role_model_club: string | null;
  role_model_image_path: string | null;
  phase: VideoPhase;
  created_by: string | null;
  created_at?: string;
}

interface PlayerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  club: string | null;
  strengths: string | null;
  potentials: string | null;
}

interface VideoAssignment {
  player_id: string;
  video_id: string;
  type: 'strength' | 'potential';
}

type DraftVideo = Omit<VideoRow, 'id' | 'created_at'> & { id?: string };

function getVideoPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export function VideoLibraryScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session } = useAuth();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; photo_url?: string; role?: string } | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [assignments, setAssignments] = useState<VideoAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DraftVideo | null>(null);
  const [editingAssignments, setEditingAssignments] = useState<VideoAssignment[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadProfile();
    loadAll();
  }, [session]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('advisors').select('first_name, last_name, photo_url, role').eq('id', user.id).single();
      if (data) setProfile(data);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const [videosRes, playersRes, assignmentsRes] = await Promise.all([
      supabase.from('player_videos').select('*').order('created_at', { ascending: false }),
      supabase.from('player_details').select('id, first_name, last_name, club, strengths, potentials').order('last_name'),
      supabase.from('player_video_assignments').select('*'),
    ]);
    setVideos((videosRes.data as VideoRow[]) || []);
    setPlayers((playersRes.data as PlayerRow[]) || []);
    setAssignments((assignmentsRes.data as VideoAssignment[]) || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditing({
      video_path: null, video_url: null, label: '', description: '',
      role_model_name: '', role_model_club: '', role_model_image_path: null,
      phase: 'neutral', created_by: null,
    });
    setEditingAssignments([]);
    setSelectedPlayerId(null);
    setPlayerSearch('');
    setPlayerDropdownOpen(false);
  };

  const startEdit = (v: VideoRow) => {
    setEditing({ ...v });
    const existing = assignments.filter(a => a.video_id === v.id);
    setEditingAssignments(existing);
    setSelectedPlayerId(existing[0]?.player_id ?? null);
    setPlayerSearch('');
    setPlayerDropdownOpen(false);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditingAssignments([]);
    setSelectedPlayerId(null);
    setPlayerSearch('');
    setPlayerDropdownOpen(false);
  };

  const pickAndUpload = async () => {
    if (!editing) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_VIDEO_SIZE) {
        alertDialog({ title: 'Datei zu groß', message: `Video ist zu groß (${(asset.size / (1024*1024)).toFixed(1)} MB). Maximum 30 MB.` });
        return;
      }
      setUploading(true);
      const ext = (asset.name || 'mp4').split('.').pop() || 'mp4';
      const uid = session?.user?.id || 'anon';
      const fileName = `${uid}/${Date.now()}.${ext}`;
      let fileData: any;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        fileData = await resp.blob();
      } else {
        fileData = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'video/mp4' };
      }
      const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(fileName, fileData, { contentType: asset.mimeType || 'video/mp4', upsert: false });
      setUploading(false);
      if (error) {
        alertDialog({ title: 'Upload-Fehler', message: error.message });
        return;
      }
      setEditing({ ...editing, video_path: fileName, video_url: null });
    } catch (e: any) {
      setUploading(false);
      console.error('Upload error:', e);
    }
  };

  const saveVideo = async () => {
    if (!editing) return;
    if (!editing.label.trim()) { alertDialog({ title: 'Eingabe fehlt', message: 'Label ist Pflicht.' }); return; }
    if (!editing.video_path && !editing.video_url) { alertDialog({ title: 'Eingabe fehlt', message: 'Bitte Video hochladen oder URL angeben.' }); return; }
    // Bei Potenzial: Phase muss gewählt sein (negative oder positive)
    const currentType = editingAssignments[0]?.type;
    if (currentType === 'potential' && editing.phase === 'neutral') {
      alertDialog({ title: 'Auswahl fehlt', message: 'Bitte wähle: Negativ- oder Positiv-Beispiel.' });
      return;
    }
    setSaving(true);
    const payload = {
      video_path: editing.video_path,
      video_url: editing.video_url || null,
      label: editing.label.trim(),
      description: editing.description || null,
      role_model_name: editing.role_model_name || null,
      role_model_club: editing.role_model_club || null,
      role_model_image_path: editing.role_model_image_path,
      phase: editing.phase || 'neutral',
      created_by: session?.user?.id || null,
    };
    let videoId = editing.id;
    if (videoId) {
      const { error } = await supabase.from('player_videos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', videoId);
      if (error) { alertDialog({ title: 'Fehler', message: error.message }); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('player_videos').insert(payload).select('id').single();
      if (error || !data) { alertDialog({ title: 'Fehler', message: error?.message || 'Unbekannter Fehler' }); setSaving(false); return; }
      videoId = data.id;
    }
    // Assignments diffen: alle für dieses Video löschen + neu setzen
    await supabase.from('player_video_assignments').delete().eq('video_id', videoId);
    if (editingAssignments.length > 0) {
      const rows = editingAssignments.map(a => ({ player_id: a.player_id, video_id: videoId!, type: a.type }));
      await supabase.from('player_video_assignments').insert(rows);
    }
    setSaving(false);
    setEditing(null);
    setEditingAssignments([]);
    loadAll();
  };

  const deleteVideo = async (id: string) => {
    const ok = await confirmDialog({ title: 'Video löschen', message: 'Video wirklich löschen?', danger: true, confirmLabel: 'Löschen' });
    if (!ok) return;
    await supabase.from('player_videos').delete().eq('id', id);
    loadAll();
  };

  // Wählt eine Stärke oder ein Potenzial des aktuell gewählten Spielers als Label+Typ für dieses Video
  const pickStrengthOrPotential = (label: string, type: 'strength' | 'potential') => {
    if (!editing || !selectedPlayerId) return;
    // Stärken haben immer 'neutral'; Potenziale behalten die bestehende Phase (oder fragen per Radio)
    const nextPhase: VideoPhase = type === 'strength' ? 'neutral' : (editing.phase && editing.phase !== 'neutral' ? editing.phase : 'neutral');
    setEditing({ ...editing, label, phase: nextPhase });
    setEditingAssignments([{ player_id: selectedPlayerId, video_id: editing.id || '', type }]);
  };

  const mainContent = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 16 : 32, paddingBottom: 80 }}>
      <View style={{ marginHorizontal: -32, marginTop: -32, marginBottom: 16 }}>
        <AdvisorHeroHeader title="VIDEO-LIBRARY" subtitle="KURATIERTE CLIPS FÜR STÄRKEN & POTENZIALE" backgroundImage={require('../../../assets/scouting-header-bg.jpg')} backgroundImageOpacity={0.45}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={{ height: 28, paddingVertical: 0, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={openNew}>
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Neues Video</Text>
          </TouchableOpacity>
        </AdvisorHeroHeader>
      </View>

      {loading ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 24 }}>Lade…</Text>
      ) : videos.length === 0 ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 24 }}>
          Noch keine Videos — lege das erste an.
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
          {videos.map(v => {
            const assignmentCount = assignments.filter(a => a.video_id === v.id).length;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => startEdit(v)}
                style={styles.videoCard}
              >
                <View style={styles.videoThumb}>
                  <Ionicons name="play-circle-outline" size={44} color="rgba(255,255,255,0.4)" />
                  {v.phase === 'negative' && (
                    <View style={[styles.phaseBadge, { backgroundColor: '#ef4444' }]}>
                      <Text style={styles.phaseBadgeText}>NEGATIV</Text>
                    </View>
                  )}
                  {v.phase === 'positive' && (
                    <View style={[styles.phaseBadge, { backgroundColor: '#22c55e' }]}>
                      <Text style={styles.phaseBadgeText}>POSITIV</Text>
                    </View>
                  )}
                  {v.video_url && (
                    <View style={styles.urlBadge}>
                      <Ionicons name="link" size={10} color="#fff" />
                      <Text style={styles.urlBadgeText}>URL</Text>
                    </View>
                  )}
                </View>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoLabel} numberOfLines={1}>{v.label}</Text>
                  {v.role_model_name ? (
                    <Text style={styles.videoMeta} numberOfLines={1}>
                      {v.role_model_name}{v.role_model_club ? ` · ${v.role_model_club}` : ''}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.videoAssignCount}>
                      {assignmentCount} Zuordnung{assignmentCount === 1 ? '' : 'en'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, flexDirection: isMobile ? 'column' : 'row', backgroundColor: 'transparent' }}>
      <AdvisorBackground />
      {isMobile ? (
        <>
          <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="videolibrary" profile={profile} />
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <MobileHeader title="Video-Library" backgroundImage={require('../../../assets/scouting-header-bg.jpg')} onMenuPress={() => setShowMobileSidebar(true)} />
            {mainContent}
          </View>
        </>
      ) : (
        <>
          <Sidebar navigation={navigation} activeScreen="videolibrary" profile={profile} />
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            {mainContent}
          </View>
        </>
      )}

      {/* Edit/Create Modal */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={cancelEdit}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={cancelEdit} />
          <View style={styles.modalBox}>
            {editing && (() => {
              const selectedPlayer = selectedPlayerId ? players.find(p => p.id === selectedPlayerId) : null;
              const playerName = selectedPlayer ? `${selectedPlayer.first_name || ''} ${selectedPlayer.last_name || ''}`.trim() : '';
              const strengths = selectedPlayer?.strengths ? selectedPlayer.strengths.split(';').map(s => s.trim()).filter(Boolean) : [];
              const potentials = selectedPlayer?.potentials ? selectedPlayer.potentials.split(';').map(s => s.trim()).filter(Boolean) : [];
              const filteredPlayers = players.filter(p => {
                const haystack = `${p.first_name || ''} ${p.last_name || ''} ${p.club || ''}`.trim().toLowerCase();
                return !playerSearch || haystack.includes(playerSearch.toLowerCase());
              });
              const currentAssignment = editingAssignments[0] || null;
              return (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={styles.modalTitle}>{editing.id ? 'Video bearbeiten' : 'Neues Video'}</Text>
                    <TouchableOpacity onPress={cancelEdit}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 1. Spieler-Auswahl — Search-Dropdown */}
                  <Text style={styles.fieldLabel}>Spieler</Text>
                  <View style={{ position: 'relative', zIndex: playerDropdownOpen ? 1000 : 1 }}>
                    <TouchableOpacity
                      onPress={() => setPlayerDropdownOpen(!playerDropdownOpen)}
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }]}
                    >
                      {selectedPlayer ? (
                        <Text style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                          <Text style={{ color: '#fff', fontWeight: '500' }}>{playerName}</Text>
                          {selectedPlayer.club ? <Text style={{ color: 'rgba(255,255,255,0.45)', fontWeight: '400' }}> · {selectedPlayer.club}</Text> : null}
                        </Text>
                      ) : (
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 }}>Spieler auswählen…</Text>
                      )}
                      <Ionicons name={playerDropdownOpen ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                    {playerDropdownOpen && (
                      <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, backgroundColor: '#252525', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, maxHeight: 320 }}>
                        <View style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, backgroundColor: '#000', borderRadius: 6 }}>
                            <Ionicons name="search" size={14} color="rgba(255,255,255,0.4)" />
                            <TextInput
                              style={{ flex: 1, paddingVertical: 6, color: '#fff', fontSize: 13 }}
                              value={playerSearch}
                              onChangeText={setPlayerSearch}
                              placeholder="Spieler suchen…"
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              autoFocus
                            />
                          </View>
                        </View>
                        <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedPlayerId(null);
                              setPlayerDropdownOpen(false);
                              setPlayerSearch('');
                              setEditing({ ...editing, label: '' });
                              setEditingAssignments([]);
                            }}
                            style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}
                          >
                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Leeren</Text>
                          </TouchableOpacity>
                          {filteredPlayers.length === 0 ? (
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: 14 }}>Keine Treffer.</Text>
                          ) : filteredPlayers.map(p => {
                            const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';
                            const isActive = p.id === selectedPlayerId;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                onPress={() => {
                                  setSelectedPlayerId(p.id);
                                  setPlayerDropdownOpen(false);
                                  setPlayerSearch('');
                                  // Wechsel des Spielers → Label + Assignment reset
                                  setEditing({ ...editing, label: '' });
                                  setEditingAssignments([]);
                                }}
                                style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'transparent' }}
                              >
                                <Text style={{ fontSize: 13 }} numberOfLines={1}>
                                  <Text style={{ color: isActive ? '#22c55e' : '#fff', fontWeight: isActive ? '600' : '500' }}>{name}</Text>
                                  {p.club ? <Text style={{ color: 'rgba(255,255,255,0.45)', fontWeight: '400' }}> · {p.club}</Text> : null}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* 2. Stärken / Potenziale des Spielers — klickbar, eines auswählen */}
                  {selectedPlayer && (
                    <>
                      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Welche Stärke / welches Potenzial?</Text>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#22c55e', letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', marginBottom: 8 }}>Stärken</Text>
                          {strengths.length === 0 ? (
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>—</Text>
                          ) : strengths.map((s, i) => {
                            const isActive = currentAssignment?.type === 'strength' && editing.label === s;
                            return (
                              <TouchableOpacity
                                key={`s-${i}`}
                                onPress={() => pickStrengthOrPotential(s, 'strength')}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: isActive ? 'rgba(34,197,94,0.2)' : 'transparent', borderWidth: 1, borderColor: isActive ? '#22c55e' : 'transparent', marginBottom: 4 }}
                              >
                                <Ionicons name="chevron-forward-outline" size={12} color="#22c55e" />
                                <Text style={{ fontSize: 13, color: isActive ? '#22c55e' : '#fff', fontWeight: isActive ? '600' : '500', flex: 1 }}>{s}</Text>
                                {isActive && <Ionicons name="checkmark" size={14} color="#22c55e" />}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#ef4444', letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', marginBottom: 8 }}>Potenziale</Text>
                          {potentials.length === 0 ? (
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>—</Text>
                          ) : potentials.map((p, i) => {
                            const isActive = currentAssignment?.type === 'potential' && editing.label === p;
                            return (
                              <TouchableOpacity
                                key={`p-${i}`}
                                onPress={() => pickStrengthOrPotential(p, 'potential')}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: isActive ? 'rgba(239,68,68,0.2)' : 'transparent', borderWidth: 1, borderColor: isActive ? '#ef4444' : 'transparent', marginBottom: 4 }}
                              >
                                <Ionicons name="chevron-forward-outline" size={12} color="#ef4444" />
                                <Text style={{ fontSize: 13, color: isActive ? '#ef4444' : '#fff', fontWeight: isActive ? '600' : '500', flex: 1 }}>{p}</Text>
                                {isActive && <Ionicons name="checkmark" size={14} color="#ef4444" />}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </>
                  )}

                  {/* Phase-Auswahl nur bei Potenzial */}
                  {currentAssignment?.type === 'potential' && (
                    <View style={{ marginTop: 20 }}>
                      <Text style={styles.fieldLabel}>Was zeigt dieser Clip?</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setEditing({ ...editing, phase: 'negative' })}
                          style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: editing.phase === 'negative' ? '#ef4444' : 'rgba(255,255,255,0.15)', backgroundColor: editing.phase === 'negative' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: editing.phase === 'negative' ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>
                            {editing.phase === 'negative' ? '✓ Negativ-Beispiel' : 'Negativ-Beispiel'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setEditing({ ...editing, phase: 'positive' })}
                          style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: editing.phase === 'positive' ? '#22c55e' : 'rgba(255,255,255,0.15)', backgroundColor: editing.phase === 'positive' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: editing.phase === 'positive' ? '#22c55e' : 'rgba(255,255,255,0.7)' }}>
                            {editing.phase === 'positive' ? '✓ Positiv-Beispiel' : 'Positiv-Beispiel'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                        Pflicht bei Potenzialen: wähle, ob dieser Clip den Verbesserungsbedarf oder eine gelungene Umsetzung zeigt.
                      </Text>
                    </View>
                  )}

                  {/* 3. Beschreibung */}
                  <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Beschreibung</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={editing.description || ''}
                    onChangeText={v => setEditing({ ...editing, description: v })}
                    placeholder="Worum geht es in diesem Clip…"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline
                  />

                  {/* 4. Video-Quelle */}
                  <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Video</Text>
                  {editing.video_path ? (
                    <View style={styles.videoPreviewBox}>
                      <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      <Text style={{ color: '#fff', fontSize: 12, flex: 1 }} numberOfLines={1}>
                        Hochgeladen: {editing.video_path.split('/').pop()}
                      </Text>
                      <TouchableOpacity onPress={() => setEditing({ ...editing, video_path: null })}>
                        <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={pickAndUpload} style={styles.uploadBtn} disabled={uploading}>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.uploadBtnText}>{uploading ? 'Lädt…' : 'Video-Datei wählen (MP4, max 30MB)'}</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.fieldLabel, { marginTop: 12, fontSize: 10 }]}>Oder URL (YouTube / Vimeo / MP4-Link)</Text>
                  <TextInput
                    style={styles.input}
                    value={editing.video_url || ''}
                    onChangeText={v => setEditing({ ...editing, video_url: v, video_path: v ? null : editing.video_path })}
                    placeholder="https://…"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                  />

                  {/* 5. Role Model (optional) */}
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Role Model (optional)</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 2 }]}
                      value={editing.role_model_name || ''}
                      onChangeText={v => setEditing({ ...editing, role_model_name: v })}
                      placeholder="Name"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editing.role_model_club || ''}
                      onChangeText={v => setEditing({ ...editing, role_model_club: v })}
                      placeholder="Verein"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 28, justifyContent: 'flex-end' }}>
                    {editing.id && (
                      <TouchableOpacity style={styles.dangerBtn} onPress={() => { deleteVideo(editing.id!); cancelEdit(); }}>
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        <Text style={styles.dangerBtnText}>Löschen</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.secondaryBtn} onPress={cancelEdit}>
                      <Text style={styles.secondaryBtnText}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryBtn} onPress={saveVideo} disabled={saving}>
                      <Text style={styles.primaryBtnText}>{saving ? 'Speichert…' : 'Speichern'}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: '#fff' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, letterSpacing: 1 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#22c55e', borderRadius: 8 },
  newBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Video-Card
  videoCard: {
    width: 260,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoThumb: {
    aspectRatio: 16 / 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  urlBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  urlBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  phaseBadge: {
    position: 'absolute', top: 8, left: 8,
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: 4,
  },
  phaseBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  videoInfo: { padding: 12 },
  videoLabel: { fontSize: 13, fontWeight: '600', color: '#fff', letterSpacing: 0.5 },
  videoMeta: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 },
  videoAssignCount: { fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  modalTitle: { fontFamily: 'Josefin Sans', fontSize: 18, fontWeight: '400', letterSpacing: 3, textTransform: 'uppercase', color: '#fff' },

  // Form fields
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  input: {
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#fff',
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)', borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
  },
  uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  videoPreviewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 8,
  },

  // Player Rows
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6 },
  playerRowName: { flex: 1, fontSize: 12, color: '#fff' },
  toggleBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  toggleBtnActiveGreen: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)' },
  toggleBtnActiveRed: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)' },
  toggleBtnText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  // Action Buttons
  primaryBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#22c55e', borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  secondaryBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 8 },
  secondaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)', marginRight: 'auto' },
  dangerBtnText: { color: '#ef4444', fontSize: 11, fontWeight: '500' },
});
