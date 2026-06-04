import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
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
import { useDialog } from '../../components/DialogProvider';

type Scope = 'team' | 'personal';

interface TaskRow {
  id: string;
  scope: Scope;
  owner_advisor_id: string | null;
  title: string;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
}

interface AdvisorLite {
  id: string;
  first_name: string;
  last_name: string;
}

export function AufgabenScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [activeTab, setActiveTab] = useState<Scope>('team');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [advisors, setAdvisors] = useState<Record<string, AdvisorLite>>({});
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const userId = session?.user?.id || null;

  const canEdit = (task: TaskRow): boolean => {
    if (!userId) return false;
    if (task.scope === 'team') return true; // kollaborativ, RLS erlaubt update für alle
    return task.owner_advisor_id === userId;
  };

  const startEdit = (task: TaskRow) => {
    if (!canEdit(task)) return;
    setEditingId(task.id);
    setEditingTitle(task.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = editingTitle.trim();
    if (!title) { cancelEdit(); return; }
    const target = tasks.find(t => t.id === editingId);
    if (!target || target.title === title) { cancelEdit(); return; }
    // Optimistisch
    setTasks(prev => prev.map(t => t.id === editingId ? { ...t, title } : t));
    const id = editingId;
    cancelEdit();
    const { error } = await supabase.from('advisor_tasks').update({ title }).eq('id', id);
    if (error) {
      // Revert
      setTasks(prev => prev.map(t => t.id === id ? { ...t, title: target.title } : t));
      alertDialog({ title: 'Fehler beim Speichern', message: error.message });
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('advisor_tasks')
      .select('id, scope, owner_advisor_id, title, completed_at, completed_by, created_by, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setTasks(data as TaskRow[]);
    setLoading(false);
  }, [userId]);

  const fetchAdvisors = useCallback(async () => {
    const { data } = await supabase.from('advisors').select('id, first_name, last_name');
    if (data) {
      const map: Record<string, AdvisorLite> = {};
      for (const a of data as AdvisorLite[]) map[a.id] = a;
      setAdvisors(map);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchAdvisors();
  }, [fetchTasks, fetchAdvisors]);

  const visibleTasks = tasks.filter(t => t.scope === activeTab);
  // Sort: offen (created_at desc) zuerst, erledigte (completed_at desc) unten
  visibleTasks.sort((a, b) => {
    const aDone = !!a.completed_at;
    const bDone = !!b.completed_at;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (aDone && bDone) return (b.completed_at || '').localeCompare(a.completed_at || '');
    return b.created_at.localeCompare(a.created_at);
  });

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title || !userId || submitting) return;
    setSubmitting(true);
    const payload: any = {
      scope: activeTab,
      title,
      created_by: userId,
      owner_advisor_id: activeTab === 'personal' ? userId : null,
    };
    const { data, error } = await supabase.from('advisor_tasks').insert(payload).select().single();
    setSubmitting(false);
    if (error) {
      alertDialog({ title: 'Fehler', message: error.message });
      return;
    }
    if (data) setTasks(prev => [data as TaskRow, ...prev]);
    setNewTitle('');
  };

  const toggleComplete = async (task: TaskRow) => {
    if (!userId) return;
    const isDone = !!task.completed_at;
    const update: any = isDone
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: userId };
    // Optimistisch
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...update } : t));
    const { error } = await supabase.from('advisor_tasks').update(update).eq('id', task.id);
    if (error) {
      // Revert
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      alertDialog({ title: 'Fehler', message: error.message });
    }
  };

  const deleteTask = async (task: TaskRow) => {
    const ok = await confirmDialog({
      title: 'Aufgabe löschen',
      message: `"${task.title}" wirklich löschen?`,
      danger: true,
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    const prev = tasks;
    setTasks(prev.filter(t => t.id !== task.id));
    const { error } = await supabase.from('advisor_tasks').delete().eq('id', task.id);
    if (error) {
      setTasks(prev);
      alertDialog({ title: 'Fehler beim Löschen', message: error.message });
    }
  };

  const canDelete = (task: TaskRow): boolean => {
    if (!userId) return false;
    if (task.scope === 'team') return task.created_by === userId;
    return task.owner_advisor_id === userId;
  };

  const advisorName = (id: string | null | undefined): string => {
    if (!id) return '';
    const a = advisors[id];
    if (!a) return '';
    return `${a.first_name} ${a.last_name}`.trim();
  };

  // Segmented Pill — zwei Buttons in einer Pille mit vertikalem Trenner.
  // Aktiv: weiße Schrift; inaktiv: gedimmt. Folgt dem Hero-Button-Stil
  // (height 28, bg rgba(0,0,0,0.7), border rgba(255,255,255,0.25)).
  // Wrapper schiebt die Pille im Toolbar-Slot nach rechts.
  const renderSegmentedTabs = () => (
    <View style={styles.segmentedAlignRight}>
    <View style={styles.segmentedWrap}>
      {(['team', 'personal'] as const).map((scope, idx) => {
        const isActive = activeTab === scope;
        const label = scope === 'team' ? 'Team Aufgaben' : 'Meine Aufgaben';
        const openCount = tasks.filter(t => t.scope === scope && !t.completed_at && (scope === 'team' || t.owner_advisor_id === userId)).length;
        return (
          <React.Fragment key={scope}>
            {idx > 0 ? <View style={styles.segmentedDivider} /> : null}
            <TouchableOpacity
              onPress={() => setActiveTab(scope)}
              style={[styles.segmentedBtn, isActive && styles.segmentedBtnActive]}
            >
              <Text style={[styles.segmentedLabel, isActive && styles.segmentedLabelActive]}>{label}</Text>
              {openCount > 0 ? (
                <View style={[styles.segmentedCountPill, isActive && styles.segmentedCountPillActive]}>
                  <Text style={[styles.segmentedCountText, isActive && styles.segmentedCountTextActive]}>{openCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </View>
    </View>
  );

  const renderInputRow = () => (
    <View style={styles.inputRow}>
      <TextInput
        style={styles.input}
        value={newTitle}
        onChangeText={setNewTitle}
        placeholder={activeTab === 'team' ? 'Neue Team-Aufgabe…' : 'Neue persönliche Aufgabe…'}
        placeholderTextColor="rgba(255,255,255,0.4)"
        onSubmitEditing={handleAdd}
        returnKeyType="done"
        editable={!submitting}
      />
      <TouchableOpacity
        style={[styles.addBtn, (!newTitle.trim() || submitting) && { opacity: 0.4 }]}
        onPress={handleAdd}
        disabled={!newTitle.trim() || submitting}
      >
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={styles.addBtnText}>Hinzufügen</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTaskList = () => {
    if (loading && tasks.length === 0) {
      return <Text style={styles.emptyText}>Lade…</Text>;
    }
    if (visibleTasks.length === 0) {
      return (
        <Text style={styles.emptyText}>
          {activeTab === 'team' ? 'Noch keine Team-Aufgaben. Trag oben die erste ein.' : 'Noch keine persönlichen Aufgaben.'}
        </Text>
      );
    }
    return visibleTasks.map(task => {
      const done = !!task.completed_at;
      const isEditing = editingId === task.id;
      const showHover = hoveredId === task.id;
      const showActions = (!isMobile ? showHover : true) && !isEditing;
      const showEdit = canEdit(task) && showActions;
      const showDelete = canDelete(task) && showActions;
      return (
        <View
          key={task.id}
          style={styles.taskCard}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setHoveredId(task.id),
            onMouseLeave: () => setHoveredId(null),
          } as any : {})}
        >
          <TouchableOpacity onPress={() => toggleComplete(task)} style={styles.checkboxBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={isEditing}>
            <Ionicons
              name={done ? 'checkbox' : 'square-outline'}
              size={20}
              color={done ? '#22c55e' : 'rgba(255,255,255,0.55)'}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <TextInput
                style={[styles.taskTitle, styles.taskTitleInput]}
                value={editingTitle}
                onChangeText={setEditingTitle}
                onSubmitEditing={saveEdit}
                onBlur={saveEdit}
                autoFocus
                returnKeyType="done"
                blurOnSubmit
              />
            ) : (
              <TouchableOpacity
                onPress={() => startEdit(task)}
                disabled={!canEdit(task)}
                activeOpacity={canEdit(task) ? 0.6 : 1}
              >
                <Text
                  style={[styles.taskTitle, done && styles.taskTitleDone]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>
              </TouchableOpacity>
            )}
            {task.scope === 'team' ? (
              <Text style={styles.taskMeta} numberOfLines={1}>
                von {advisorName(task.created_by) || '—'}
                {done && task.completed_by ? `  ·  erledigt von ${advisorName(task.completed_by) || '—'}` : ''}
              </Text>
            ) : done && task.completed_at ? (
              <Text style={styles.taskMeta} numberOfLines={1}>
                erledigt {new Date(task.completed_at).toLocaleDateString('de-DE')}
              </Text>
            ) : null}
          </View>
          {isEditing ? (
            <TouchableOpacity onPress={saveEdit} style={styles.saveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="checkmark" size={16} color="#22c55e" />
            </TouchableOpacity>
          ) : (
            <>
              {showEdit ? (
                <TouchableOpacity onPress={() => startEdit(task)} style={styles.editBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              ) : null}
              {showDelete ? (
                <TouchableOpacity onPress={() => deleteTask(task)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      );
    });
  };

  const cardsContent = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 16 : 32, paddingBottom: 80 }}>
      <View style={styles.frostedCard}>
        {renderInputRow()}
        <View style={styles.divider} />
        <View style={{ gap: 8 }}>{renderTaskList()}</View>
      </View>
    </ScrollView>
  );

  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="aufgaben" />
        <MobileHeader
          title="Aufgaben"
          subtitle="Team & persönliche To-Dos"
          backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
          onMenuPress={() => setShowMobileSidebar(true)}
        >
          {renderSegmentedTabs()}
        </MobileHeader>
        {cardsContent}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="aufgaben" profile={profile} />
      <View style={styles.mainContent}>
        <AdvisorHeroHeader
          title="AUFGABEN"
          subtitle="TEAM-PUNKTE · PERSÖNLICHE TO-DOS"
          backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
          backgroundImageOpacity={0.45}
        >
          {renderSegmentedTabs()}
        </AdvisorHeroHeader>
        {cardsContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)' },
  containerMobile: { flex: 1, flexDirection: 'column' },
  mainContent: { flex: 1, minHeight: 0, padding: 24 },

  // Wrapper schiebt die Segmented-Pille rechts in den Toolbar-Slot
  // (flex: 1 schluckt die volle Breite, alignItems: 'flex-end' richtet die Pille rechts aus).
  segmentedAlignRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // Segmented Pill — eine Pille, zwei Buttons, vertikaler Divider.
  // Hero-Button-Stil: height 28, bg rgba(0,0,0,0.7), border rgba(255,255,255,0.25), borderRadius 6.
  segmentedWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  segmentedDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  segmentedBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  segmentedLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  segmentedLabelActive: {
    color: '#fff',
  },
  segmentedCountPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 5,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedCountPillActive: {
    backgroundColor: '#22c55e',
  },
  segmentedCountText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
  },
  segmentedCountTextActive: {
    color: '#fff',
  },

  // Frosted-Glass Container für die Liste
  frostedCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any) : {}),
  },

  // Input-Row: Pill-Input + Add-Button
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 14,
  },

  // Task-Card
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
  },
  checkboxBtn: {
    paddingTop: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 18,
  },
  taskTitleInput: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  taskTitleDone: {
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
