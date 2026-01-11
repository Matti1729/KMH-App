import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';

interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completed_at?: string;
  created_at: string;
  subtasks?: Subtask[];
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
}

interface Reminder {
  id: string;
  user_id: string;
  title: string;
  source_type: string;
  source_id?: string;
  player_name?: string;
  club_name?: string; // Für Highlight im TransferDetail
  due_date: string;
  completed: boolean;
  completed_at?: string;
}

const PRIORITIES = [
  { id: 'high', label: 'Hoch', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
  { id: 'medium', label: 'Mittel', color: '#ca8a04', bgColor: '#fefce8', borderColor: '#fef08a' },
  { id: 'low', label: 'Niedrig', color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
];

// Date constants
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i);

const parseDateToParts = (dateStr: string): { day: number; month: number; year: number } | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() };
};

const buildDateFromParts = (day: number, month: number, year: number): string => {
  // Format as YYYY-MM-DD without timezone conversion
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

const getDaysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};

const isToday = (dateStr: string): boolean => {
  const today = new Date();
  const date = new Date(dateStr);
  return date.toDateString() === today.toDateString();
};

const isTomorrow = (dateStr: string): boolean => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = new Date(dateStr);
  return date.toDateString() === tomorrow.toDateString();
};

const isInTwoDays = (dateStr: string): boolean => {
  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const date = new Date(dateStr);
  return date.toDateString() === inTwoDays.toDateString();
};

export function TasksRemindersScreen({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal States
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Form States
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  
  // Date picker states
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  const closeAllDatePickers = () => {
    setShowDayPicker(false);
    setShowMonthPicker(false);
    setShowYearPicker(false);
  };

  useEffect(() => {
    fetchProfile();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchTasks();
      fetchReminders();
    }
  }, [currentUserId]);

  // Daten neu laden wenn Screen fokussiert wird (z.B. nach Rückkehr von TransferDetail)
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        fetchReminders();
      }
    }, [currentUserId])
  );

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('advisors')
        .select('first_name, last_name, photo_url, role')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchTasks = async () => {
    if (!currentUserId) return;
    
    const { data: tasksData, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (tasksData) {
      // Fetch subtasks for each task
      const tasksWithSubtasks = await Promise.all(
        tasksData.map(async (task) => {
          const { data: subtasks } = await supabase
            .from('subtasks')
            .select('*')
            .eq('task_id', task.id)
            .order('created_at', { ascending: true });
          return { ...task, subtasks: subtasks || [] };
        })
      );
      setTasks(tasksWithSubtasks);
    }
    setLoading(false);
  };

  const fetchReminders = async () => {
    if (!currentUserId) return;

    // Fetch reminders from reminders table
    const { data: remindersData } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', currentUserId)
      .gte('due_date', new Date().toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    // Also fetch transfer reminders
    const { data: transferReminders } = await supabase
      .from('transfer_clubs')
      .select(`
        id, club_name, reminder_days, created_at,
        player_details!inner(id, first_name, last_name)
      `)
      .not('reminder_days', 'is', null)
      .gt('reminder_days', 0);

    // Convert transfer reminders to reminder format
    const convertedTransferReminders: Reminder[] = (transferReminders || []).map((tr: any) => {
      const createdDate = new Date(tr.created_at);
      const dueDate = new Date(createdDate);
      dueDate.setDate(dueDate.getDate() + tr.reminder_days);
      
      return {
        id: `transfer-${tr.id}`,
        user_id: currentUserId,
        title: `${tr.club_name} nachfassen`,
        source_type: 'transfer',
        source_id: tr.player_details.id, // Player ID für Navigation
        player_name: `${tr.player_details.first_name} ${tr.player_details.last_name}`,
        club_name: tr.club_name, // Für Highlight im TransferDetail
        due_date: dueDate.toISOString().split('T')[0],
        completed: false,
      };
    });

    // Combine all reminders - include overdue ones too
    const allReminders = [...(remindersData || []), ...convertedTransferReminders];
    
    setReminders(allReminders);
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setSelectedDay(null);
    setSelectedMonth(null);
    setSelectedYear(null);
    setTaskPriority('medium');
    setNewSubtasks([]);
    setNewSubtaskInput('');
    closeAllDatePickers();
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskDueDate(task.due_date || '');
    // Parse existing date
    const parts = parseDateToParts(task.due_date || '');
    setSelectedDay(parts?.day || null);
    setSelectedMonth(parts?.month ?? null);
    setSelectedYear(parts?.year || null);
    setTaskPriority(task.priority);
    setNewSubtasks(task.subtasks?.map(s => s.title) || []);
    setNewSubtaskInput('');
    closeAllDatePickers();
    setShowTaskModal(true);
  };

  const saveTask = async () => {
    if (!taskTitle.trim() || !currentUserId) return;

    // Build date from selected parts
    const finalDueDate = (selectedDay && selectedMonth !== null && selectedYear) 
      ? buildDateFromParts(selectedDay, selectedMonth, selectedYear)
      : null;

    if (editingTask) {
      // Update existing task
      await supabase
        .from('tasks')
        .update({
          title: taskTitle,
          description: taskDescription || null,
          due_date: finalDueDate,
          priority: taskPriority,
        })
        .eq('id', editingTask.id);

      // Delete old subtasks and insert new ones
      await supabase.from('subtasks').delete().eq('task_id', editingTask.id);
      
      if (newSubtasks.length > 0) {
        await supabase.from('subtasks').insert(
          newSubtasks.map(title => ({
            task_id: editingTask.id,
            title,
            completed: false,
          }))
        );
      }
    } else {
      // Create new task
      const { data: newTask } = await supabase
        .from('tasks')
        .insert({
          user_id: currentUserId,
          title: taskTitle,
          description: taskDescription || null,
          due_date: finalDueDate,
          priority: taskPriority,
        })
        .select()
        .single();

      if (newTask && newSubtasks.length > 0) {
        await supabase.from('subtasks').insert(
          newSubtasks.map(title => ({
            task_id: newTask.id,
            title,
            completed: false,
          }))
        );
      }
    }

    setShowTaskModal(false);
    fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    setShowTaskModal(false);
    fetchTasks();
  };

  const toggleTaskComplete = async (task: Task) => {
    const newCompleted = !task.completed;
    await supabase
      .from('tasks')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq('id', task.id);
    fetchTasks();
  };

  const toggleSubtaskComplete = async (subtask: Subtask) => {
    await supabase
      .from('subtasks')
      .update({ completed: !subtask.completed })
      .eq('id', subtask.id);
    fetchTasks();
  };

  const toggleReminderComplete = async (reminder: Reminder) => {
    if (reminder.id.startsWith('transfer-')) {
      // For transfer reminders, toggle locally in state
      setReminders(prev => prev.map(r => 
        r.id === reminder.id 
          ? { ...r, completed: !r.completed, completed_at: !r.completed ? new Date().toISOString() : undefined }
          : r
      ));
      return;
    }
    
    await supabase
      .from('reminders')
      .update({
        completed: !reminder.completed,
        completed_at: !reminder.completed ? new Date().toISOString() : null,
      })
      .eq('id', reminder.id);
    fetchReminders();
  };

  const addSubtask = () => {
    if (newSubtaskInput.trim()) {
      setNewSubtasks([...newSubtasks, newSubtaskInput.trim()]);
      setNewSubtaskInput('');
    }
  };

  const removeSubtask = (index: number) => {
    setNewSubtasks(newSubtasks.filter((_, i) => i !== index));
  };

  const navigateToTransfer = (reminder: Reminder) => {
    if (reminder.source_type === 'transfer' && reminder.source_id) {
      // Navigate to transfer detail with player ID and club to highlight
      navigation.navigate('TransferDetail', { 
        playerId: reminder.source_id,
        highlightClub: reminder.club_name 
      });
    }
  };

  // Filter tasks
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  // Group active tasks by priority
  const highPriorityTasks = activeTasks.filter(t => t.priority === 'high');
  const mediumPriorityTasks = activeTasks.filter(t => t.priority === 'medium');
  const lowPriorityTasks = activeTasks.filter(t => t.priority === 'low');

  // Filter reminders by date
  // Filter reminders: Heute = heute + überfällig, später = morgen und danach
  const todayAndOverdueReminders = reminders
    .filter(r => {
      const daysUntil = getDaysUntil(r.due_date);
      return daysUntil <= 0 && !r.completed;
    })
    .sort((a, b) => getDaysUntil(a.due_date) - getDaysUntil(b.due_date)); // Überfälligste zuerst
  
  const laterReminders = reminders
    .filter(r => {
      const daysUntil = getDaysUntil(r.due_date);
      return daysUntil > 0 && !r.completed;
    })
    .sort((a, b) => getDaysUntil(a.due_date) - getDaysUntil(b.due_date)); // Nächste zuerst
  
  const completedRemindersToday = reminders.filter(r => isToday(r.due_date) && r.completed);

  const renderPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    const p = PRIORITIES.find(pr => pr.id === priority);
    if (!p) return null;
    return (
      <View style={[styles.priorityBadge, { backgroundColor: p.bgColor, borderColor: p.borderColor }]}>
        <Text style={[styles.priorityBadgeText, { color: p.color }]}>{p.label}</Text>
      </View>
    );
  };

  const renderTaskCard = (task: Task) => {
    const isExpanded = expandedTaskId === task.id;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;

    return (
      <View key={task.id} style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <TouchableOpacity 
            style={[styles.checkbox, task.completed && styles.checkboxChecked]}
            onPress={() => toggleTaskComplete(task)}
          >
            {task.completed && <Text style={styles.checkboxIcon}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.taskContent}
            onPress={() => hasSubtasks ? setExpandedTaskId(isExpanded ? null : task.id) : openEditTaskModal(task)}
          >
            <View style={styles.taskTitleRow}>
              <Text style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}>{task.title}</Text>
              {task.due_date && (
                <View style={styles.taskDateBadge}>
                  <Text style={styles.taskDateBadgeText}>{formatDateShort(task.due_date)}</Text>
                </View>
              )}
            </View>
            {task.description && (
              <Text style={styles.taskDescriptionPreview} numberOfLines={1}>{task.description}</Text>
            )}
          </TouchableOpacity>
          {hasSubtasks && (
            <View style={styles.subtaskCountBadge}>
              <Text style={styles.subtaskCountText}>{completedSubtasks}/{totalSubtasks}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.taskEditButton} onPress={() => openEditTaskModal(task)}>
            <Text style={styles.taskEditIcon}>✎</Text>
          </TouchableOpacity>
        </View>
        
        {isExpanded && hasSubtasks && (
          <View style={styles.taskExpanded}>
            <View style={styles.subtasksList}>
              {task.subtasks?.map(subtask => (
                <TouchableOpacity 
                  key={subtask.id} 
                  style={styles.subtaskItem}
                  onPress={() => toggleSubtaskComplete(subtask)}
                >
                  <View style={[styles.subtaskCheckbox, subtask.completed && styles.subtaskCheckboxChecked]}>
                    {subtask.completed && <Text style={styles.subtaskCheckIcon}>✓</Text>}
                  </View>
                  <Text style={[styles.subtaskTitle, subtask.completed && styles.subtaskTitleCompleted]}>
                    {subtask.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderReminderCard = (reminder: Reminder, showDays: boolean = false) => {
    const isTransfer = reminder.source_type === 'transfer';
    const daysUntil = getDaysUntil(reminder.due_date);
    const isOverdue = daysUntil < 0;
    
    return (
      <View key={reminder.id} style={[
        styles.reminderCard, 
        reminder.completed && styles.reminderCardCompleted,
        isOverdue && styles.reminderCardOverdue
      ]}>
        <TouchableOpacity 
          style={[styles.checkbox, reminder.completed && styles.checkboxChecked]}
          onPress={() => toggleReminderComplete(reminder)}
        >
          {reminder.completed && <Text style={styles.checkboxIcon}>✓</Text>}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.reminderContent}
          onPress={() => isTransfer && navigateToTransfer(reminder)}
          disabled={!isTransfer}
        >
          <Text style={[
            styles.reminderTitle, 
            reminder.completed && styles.reminderTitleCompleted,
            isOverdue && styles.reminderTitleOverdue
          ]}>
            {reminder.title}
          </Text>
          {reminder.player_name && (
            <View style={styles.reminderPlayerRow}>
              <Text style={styles.reminderPlayer}>({reminder.player_name})</Text>
              {isTransfer && (
                <View style={styles.reminderSourceBadge}>
                  <Text style={styles.reminderSourceText}>Transfer</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
        {/* Tagesanzahl rechts oben */}
        {isOverdue && (
          <View style={styles.reminderDaysBadgeCorner}>
            <Text style={styles.reminderOverdueText}>vor {Math.abs(daysUntil)} {Math.abs(daysUntil) === 1 ? 'Tag' : 'Tagen'}</Text>
          </View>
        )}
        {showDays && daysUntil > 0 && (
          <View style={styles.reminderDaysBadgeCorner}>
            <Text style={styles.reminderDaysText}>in {daysUntil} {daysUntil === 1 ? 'Tag' : 'Tagen'}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderPrioritySection = (priority: 'high' | 'medium' | 'low', tasks: Task[]) => {
    const p = PRIORITIES.find(pr => pr.id === priority)!;
    if (tasks.length === 0) return null;

    const headerStyle = priority === 'high' 
      ? styles.prioritySectionHeaderHigh 
      : priority === 'medium' 
        ? styles.prioritySectionHeaderMedium 
        : styles.prioritySectionHeaderLow;

    return (
      <View key={priority} style={styles.prioritySection}>
        <View style={[styles.prioritySectionHeader, headerStyle]}>
          <Text style={styles.prioritySectionTitle}>{p.label}</Text>
          <View style={styles.priorityCountBadge}>
            <Text style={styles.priorityCountText}>{tasks.length}</Text>
          </View>
        </View>
        <View style={styles.prioritySectionContent}>
          {tasks.map(renderTaskCard)}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Sidebar navigation={navigation} activeScreen="tasks" profile={profile} />
      
      <View style={styles.mainContent}>
        {/* Overlay zum Schließen der expanded Task */}
        {expandedTaskId && (
          <Pressable 
            style={styles.closeOverlay} 
            onPress={() => setExpandedTaskId(null)}
          />
        )}
        
        {/* Header Banner - wie ScoutingScreen */}
        <View style={styles.headerBanner}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('AdvisorDashboard')}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.headerBannerCenter}>
            <Text style={styles.headerTitle}>Aufgaben & Erinnerungen</Text>
            <Text style={styles.headerSubtitle}>To-Dos und Reminder im Überblick</Text>
          </View>
          <View style={{ width: 100 }} />
        </View>

        {/* Content - 60/40 Split */}
        <View style={styles.splitContainer}>
          {/* Left Side - Tasks */}
          <View style={[styles.leftPanel, expandedTaskId && { zIndex: 10 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Aufgaben</Text>
              <TouchableOpacity style={styles.addButton} onPress={openNewTaskModal}>
                <Text style={styles.addButtonText}>+ Neue Aufgabe</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.panelContent} contentContainerStyle={{ gap: 16 }}>
              {activeTasks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Keine offenen Aufgaben</Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {renderPrioritySection('high', highPriorityTasks)}
                  {renderPrioritySection('medium', mediumPriorityTasks)}
                  {renderPrioritySection('low', lowPriorityTasks)}
                </View>
              )}

              {/* Completed Tasks Section */}
              {completedTasks.length > 0 && (
                <View style={styles.completedSection}>
                  <TouchableOpacity 
                    style={styles.completedHeader}
                    onPress={() => setShowCompletedTasks(!showCompletedTasks)}
                  >
                    <Text style={styles.completedHeaderText}>
                      Erledigt ({completedTasks.length})
                    </Text>
                    <Text style={styles.completedHeaderIcon}>
                      {showCompletedTasks ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {showCompletedTasks && (
                    <View style={styles.completedList}>
                      {completedTasks.map(renderTaskCard)}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>

          {/* Right Side - Reminders */}
          <View style={styles.rightPanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Erinnerungen</Text>
            </View>

            <ScrollView style={styles.reminderScrollContainer}>
              <View style={styles.reminderColumns}>
                {/* Heute (inkl. überfällige) */}
                <View style={styles.reminderColumn}>
                  <View style={[styles.reminderColumnHeader, styles.reminderColumnToday]}>
                    <Text style={styles.reminderColumnTitle}>Heute</Text>
                    <View style={styles.reminderCountBadge}>
                      <Text style={styles.reminderCountText}>{todayAndOverdueReminders.length}</Text>
                    </View>
                  </View>
                  <View style={styles.reminderColumnContent}>
                    {todayAndOverdueReminders.length === 0 && completedRemindersToday.length === 0 ? (
                      <Text style={styles.noRemindersText}>Keine Erinnerungen</Text>
                    ) : (
                      <>
                        {todayAndOverdueReminders.map(r => renderReminderCard(r, false))}
                        {completedRemindersToday.map(r => renderReminderCard(r, false))}
                      </>
                    )}
                  </View>
                </View>

                {/* In den nächsten Tagen */}
                <View style={styles.reminderColumn}>
                  <View style={[styles.reminderColumnHeader, styles.reminderColumnLater]}>
                    <Text style={styles.reminderColumnTitle}>In den nächsten Tagen</Text>
                    <View style={styles.reminderCountBadge}>
                      <Text style={styles.reminderCountText}>{laterReminders.length}</Text>
                    </View>
                  </View>
                  <View style={styles.reminderColumnContent}>
                    {laterReminders.length === 0 ? (
                      <Text style={styles.noRemindersText}>Keine Erinnerungen</Text>
                    ) : (
                      laterReminders.map(r => renderReminderCard(r, true))
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Task Modal */}
      <Modal visible={showTaskModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTaskModal(false)}>
          <Pressable 
            style={styles.modalContent} 
            onPress={() => closeAllDatePickers()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowTaskModal(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.modalBody, { overflow: 'visible' }]} contentContainerStyle={{ overflow: 'visible' }}>
              {/* Title */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Titel *</Text>
                <TextInput
                  style={styles.formInput}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="Was ist zu tun?"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Description */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Beschreibung</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  placeholder="Weitere Details..."
                  placeholderTextColor="#999"
                  multiline
                />
              </View>

              {/* Due Date */}
              <View style={[styles.formField, { zIndex: 100 }]}>
                <Text style={styles.formLabel}>Fälligkeitsdatum</Text>
                <View style={styles.datePickerRow}>
                  {/* Day */}
                  <View style={{ position: 'relative', flex: 1, zIndex: 103 }}>
                    <TouchableOpacity 
                      style={styles.dateDropdownButton}
                      onPress={() => { 
                        setShowDayPicker(!showDayPicker); 
                        setShowMonthPicker(false); 
                        setShowYearPicker(false); 
                      }}
                    >
                      <Text style={styles.dateDropdownText}>
                        {selectedDay || 'Tag'}
                      </Text>
                      <Text>▼</Text>
                    </TouchableOpacity>
                    {showDayPicker && (
                      <View style={styles.datePickerList}>
                        <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                          {DAYS.map(d => (
                            <TouchableOpacity 
                              key={d} 
                              style={[styles.datePickerItem, selectedDay === d && styles.datePickerItemSelected]}
                              onPress={() => {
                                setSelectedDay(d);
                                setShowDayPicker(false);
                              }}
                            >
                              <Text style={[styles.datePickerItemText, selectedDay === d && styles.datePickerItemTextSelected]}>{d}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  
                  {/* Month */}
                  <View style={{ position: 'relative', flex: 2, zIndex: 102 }}>
                    <TouchableOpacity 
                      style={styles.dateDropdownButton}
                      onPress={() => { 
                        setShowMonthPicker(!showMonthPicker); 
                        setShowDayPicker(false); 
                        setShowYearPicker(false); 
                      }}
                    >
                      <Text style={styles.dateDropdownText}>
                        {selectedMonth !== null ? MONTHS[selectedMonth] : 'Monat'}
                      </Text>
                      <Text>▼</Text>
                    </TouchableOpacity>
                    {showMonthPicker && (
                      <View style={styles.datePickerList}>
                        <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                          {MONTHS.map((m, idx) => (
                            <TouchableOpacity 
                              key={m} 
                              style={[styles.datePickerItem, selectedMonth === idx && styles.datePickerItemSelected]}
                              onPress={() => {
                                setSelectedMonth(idx);
                                setShowMonthPicker(false);
                              }}
                            >
                              <Text style={[styles.datePickerItemText, selectedMonth === idx && styles.datePickerItemTextSelected]}>{m}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  
                  {/* Year */}
                  <View style={{ position: 'relative', flex: 1, zIndex: 101 }}>
                    <TouchableOpacity 
                      style={styles.dateDropdownButton}
                      onPress={() => { 
                        setShowYearPicker(!showYearPicker); 
                        setShowDayPicker(false); 
                        setShowMonthPicker(false); 
                      }}
                    >
                      <Text style={styles.dateDropdownText}>
                        {selectedYear || 'Jahr'}
                      </Text>
                      <Text>▼</Text>
                    </TouchableOpacity>
                    {showYearPicker && (
                      <View style={styles.datePickerList}>
                        <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                          {YEARS.map(y => (
                            <TouchableOpacity 
                              key={y} 
                              style={[styles.datePickerItem, selectedYear === y && styles.datePickerItemSelected]}
                              onPress={() => {
                                setSelectedYear(y);
                                setShowYearPicker(false);
                              }}
                            >
                              <Text style={[styles.datePickerItemText, selectedYear === y && styles.datePickerItemTextSelected]}>{y}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Priority */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Priorität</Text>
                <View style={styles.prioritySelector}>
                  {PRIORITIES.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.priorityOption,
                        { borderColor: p.color },
                        taskPriority === p.id && { backgroundColor: p.bgColor }
                      ]}
                      onPress={() => setTaskPriority(p.id as 'high' | 'medium' | 'low')}
                    >
                      <Text style={[styles.priorityOptionText, { color: p.color }]}>
                        {taskPriority === p.id ? '✓ ' : ''}{p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Subtasks */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Unteraufgaben</Text>
                <View style={styles.subtaskInputRow}>
                  <TextInput
                    style={[styles.formInput, styles.subtaskInput]}
                    value={newSubtaskInput}
                    onChangeText={setNewSubtaskInput}
                    placeholder="Unteraufgabe hinzufügen..."
                    placeholderTextColor="#999"
                    onSubmitEditing={addSubtask}
                  />
                  <TouchableOpacity style={styles.addSubtaskButton} onPress={addSubtask}>
                    <Text style={styles.addSubtaskButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                {newSubtasks.map((subtask, index) => (
                  <View key={index} style={styles.subtaskPreviewItem}>
                    <Text style={styles.subtaskPreviewText}>• {subtask}</Text>
                    <TouchableOpacity onPress={() => removeSubtask(index)}>
                      <Text style={styles.subtaskRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingTask && (
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => deleteTask(editingTask.id)}
                >
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowTaskModal(false)}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveTask}>
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  mainContent: { flex: 1, backgroundColor: '#f8fafc', position: 'relative', display: 'flex', flexDirection: 'column' },
  closeOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 5,
    backgroundColor: 'transparent',
  },
  
  // Header Banner - wie ScoutingScreen
  headerBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 24, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0' 
  },
  headerBannerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  backButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  backButtonText: { fontSize: 14, color: '#64748b' },

  // Split Container
  splitContainer: { flex: 1, flexDirection: 'row', padding: 16, gap: 16, height: '100%' },
  
  // Panels - beide gleiche Höhe durch flex: 1 in row
  leftPanel: { flex: 6, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', height: '100%' },
  rightPanel: { flex: 4, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', height: '100%' },
  
  panelHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  panelTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  panelContent: { flex: 1, padding: 12 },

  // Add Button
  addButton: { 
    backgroundColor: '#1a1a1a', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 8 
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Priority Section (wie Reminder Columns)
  prioritySection: { backgroundColor: '#f8fafc', borderRadius: 8, overflow: 'hidden' },
  prioritySectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  prioritySectionHeaderHigh: { backgroundColor: '#fef2f2' },
  prioritySectionHeaderMedium: { backgroundColor: '#fefce8' },
  prioritySectionHeaderLow: { backgroundColor: '#f0fdf4' },
  prioritySectionTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  priorityCountBadge: { 
    backgroundColor: '#1a1a1a', 
    paddingVertical: 2, 
    paddingHorizontal: 8, 
    borderRadius: 10 
  },
  priorityCountText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  prioritySectionContent: { padding: 8 },

  // Task Card
  taskCard: { 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  taskHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  taskContent: { flex: 1, marginLeft: 12 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskTitle: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: '#94a3b8' },
  taskDateBadge: { 
    backgroundColor: '#fef3c7', 
    paddingVertical: 2, 
    paddingHorizontal: 6, 
    borderRadius: 4,
  },
  taskDateBadgeText: { fontSize: 11, color: '#b45309', fontWeight: '600' },
  taskDescriptionPreview: { fontSize: 12, color: '#64748b', marginTop: 4 },
  taskDueDate: { fontSize: 12, color: '#64748b' },
  subtaskCountBadge: { 
    backgroundColor: '#f1f5f9', 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 4,
    marginRight: 8,
  },
  subtaskCountText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  taskEditButton: { padding: 8 },
  taskEditIcon: { fontSize: 16, color: '#64748b' },
  taskExpanded: { 
    padding: 12, 
    paddingTop: 0,
    borderTopWidth: 1, 
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  taskDescription: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  
  // Subtasks
  subtasksList: { gap: 8 },
  subtaskItem: { flexDirection: 'row', alignItems: 'center' },
  subtaskCheckbox: { 
    width: 18, 
    height: 18, 
    borderRadius: 4, 
    borderWidth: 1.5, 
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subtaskCheckboxChecked: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  subtaskCheckIcon: { color: '#fff', fontSize: 12 },
  subtaskTitle: { fontSize: 13, color: '#475569' },
  subtaskTitleCompleted: { textDecorationLine: 'line-through', color: '#94a3b8' },

  // Checkbox
  checkbox: { 
    width: 22, 
    height: 22, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  checkboxIcon: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Priority Badge
  priorityBadge: { 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 4, 
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  priorityBadgeText: { fontSize: 11, fontWeight: '600' },

  // Completed Section
  completedSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16 },
  completedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  completedHeaderText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  completedHeaderIcon: { fontSize: 12, color: '#64748b' },
  completedList: { opacity: 0.6 },

  // Empty State
  emptyState: { alignItems: 'center', padding: 40 },
  emptyStateIcon: { fontSize: 40, color: '#10b981', marginBottom: 12 },
  emptyStateText: { fontSize: 14, color: '#64748b' },

  // Reminder Columns
  reminderScrollContainer: { flex: 1 },
  reminderColumns: { flex: 1, flexDirection: 'column', gap: 16, padding: 12 },
  reminderColumn: { backgroundColor: '#f8fafc', borderRadius: 8, overflow: 'hidden' },
  reminderColumnHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  reminderColumnToday: { backgroundColor: '#fef2f2' },
  reminderColumnTomorrow: { backgroundColor: '#fefce8' },
  reminderColumnLater: { backgroundColor: '#f0fdf4' },
  reminderColumnTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  reminderCountBadge: { 
    backgroundColor: '#1a1a1a', 
    paddingVertical: 2, 
    paddingHorizontal: 8, 
    borderRadius: 10 
  },
  reminderCountText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reminderColumnContent: { padding: 8 },
  noRemindersText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 16 },

  // Reminder Card
  reminderCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    backgroundColor: '#fff', 
    padding: 10,
    paddingRight: 70, // Platz für Badge rechts oben
    borderRadius: 6, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  reminderCardCompleted: { opacity: 0.5 },
  reminderContent: { flex: 1, marginLeft: 10 },
  reminderTitle: { fontSize: 13, fontWeight: '500', color: '#1a1a1a' },
  reminderTitleCompleted: { textDecorationLine: 'line-through', color: '#94a3b8' },
  reminderPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  reminderPlayer: { fontSize: 11, color: '#64748b' },
  reminderSourceBadge: { 
    backgroundColor: '#eff6ff', 
    paddingVertical: 2, 
    paddingHorizontal: 6, 
    borderRadius: 4 
  },
  reminderSourceText: { fontSize: 10, color: '#3b82f6', fontWeight: '500' },
  reminderDaysBadgeCorner: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fef3c7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 500, maxHeight: '90%', overflow: 'visible' },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0' 
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  modalBody: { padding: 20, zIndex: 10 },
  modalFooter: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 12, 
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: '#e2e8f0',
    zIndex: 1,
  },
  closeButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  closeButtonText: { fontSize: 16, color: '#64748b' },

  // Form
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  formInput: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 14, 
    backgroundColor: '#fff' 
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  // Priority Selector
  prioritySelector: { flexDirection: 'row', gap: 8 },
  priorityOption: { 
    flex: 1, 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 8, 
    borderWidth: 1.5,
    alignItems: 'center',
  },
  priorityOptionText: { fontSize: 13, fontWeight: '500' },

  // Subtask Input
  subtaskInputRow: { flexDirection: 'row', gap: 8 },
  subtaskInput: { flex: 1 },
  addSubtaskButton: { 
    width: 44, 
    height: 44, 
    backgroundColor: '#1a1a1a', 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  addSubtaskButtonText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  subtaskPreviewItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    marginTop: 8,
  },
  subtaskPreviewText: { fontSize: 13, color: '#475569' },
  subtaskRemoveText: { fontSize: 16, color: '#ef4444' },

  // Buttons
  deleteButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#ef4444',
    marginRight: 'auto',
  },
  deleteButtonText: { fontSize: 14, color: '#ef4444', fontWeight: '500' },
  cancelButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  cancelButtonText: { fontSize: 14, color: '#64748b' },
  saveButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: '#1a1a1a' 
  },
  saveButtonText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  
  // Date Picker
  datePickerRow: { flexDirection: 'row', gap: 8 },
  dateDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateDropdownText: { fontSize: 14, color: '#333' },
  datePickerList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: '#fff',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  datePickerScroll: { maxHeight: 200 },
  datePickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  datePickerItemSelected: { backgroundColor: '#1a1a1a' },
  datePickerItemText: { fontSize: 14, color: '#333' },
  datePickerItemTextSelected: { color: '#fff' },
  
  // Reminder Days Badge
  reminderDaysBadge: { 
    backgroundColor: '#fef3c7', 
    paddingVertical: 2, 
    paddingHorizontal: 6, 
    borderRadius: 4,
    marginLeft: 4,
  },
  reminderDaysText: { fontSize: 11, color: '#b45309', fontWeight: '600' },
  
  // Overdue Styles
  reminderCardOverdue: { 
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  reminderTitleOverdue: { color: '#dc2626' },
  reminderOverdueBadge: { 
    backgroundColor: '#fecaca', 
    paddingVertical: 2, 
    paddingHorizontal: 6, 
    borderRadius: 4,
    marginLeft: 4,
  },
  reminderOverdueText: { fontSize: 11, color: '#dc2626', fontWeight: '600' },
});
