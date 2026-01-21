import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, TouchableOpacity, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  navigation: any;
  activeScreen: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    role?: string;
  } | null;
}

export function Sidebar({ navigation, activeScreen, profile }: SidebarProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Bitte beschreibe das Problem oder den Vorschlag.');
      }
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unbekannt',
        type: feedbackType,
        description: feedbackText.trim(),
        screen: activeScreen,
        status: 'open',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Danke für dein Feedback! Es wurde an den Admin gesendet.');
      }
      setFeedbackText('');
      setFeedbackType('bug');
      setShowFeedbackModal(false);
    } catch (err: any) {
      console.error('Feedback error:', err);
      if (Platform.OS === 'web') {
        window.alert('Fehler beim Senden: ' + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  };

  const goToDashboard = () => {
    navigation.navigate('AdvisorDashboard');
  };

  const handleNavigation = (screen: string, id: string) => {
    if (activeScreen === id) return;
    navigation.navigate(screen);
  };

  // Sidebar Navigation - alle Bereiche
  const navItems = [
    { id: 'players', label: 'KMH-Spieler', icon: '👤', screen: 'PlayerOverview' },
    { id: 'transfers', label: 'Transfers', icon: '🔄', screen: 'Transfers' },
    { id: 'scouting', label: 'Scouting', icon: '🔍', screen: 'Scouting' },
    { id: 'network', label: 'Football Network', icon: '💼', screen: 'FootballNetwork' },
    { id: 'termine', label: 'Spieltage', icon: '📅', screen: 'Calendar' },
    { id: 'aufgaben', label: 'Aufgaben & Erinnerungen', icon: '✓', screen: 'Tasks' },
  ];

  return (
    <View style={styles.sidebar}>
      {/* Logo - klickbar zum Dashboard */}
      <Pressable onPress={goToDashboard} style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>KMH</Text>
        </View>
        <Text style={styles.logoTitle}>Sports Agency</Text>
      </Pressable>

      {/* Navigation */}
      <View style={styles.navContainer}>
        {navItems.map((item) => (
          <Pressable
            key={item.id}
            onHoverIn={() => setHoveredNav(item.id)}
            onHoverOut={() => setHoveredNav(null)}
            onPress={() => handleNavigation(item.screen, item.id)}
            style={[
              styles.navItem,
              activeScreen === item.id && styles.navItemActive,
              hoveredNav === item.id && styles.navItemHovered,
            ]}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={[
              styles.navLabel,
              activeScreen === item.id && styles.navLabelActive
            ]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Admin - only if admin */}
      {profile?.role === 'admin' && (
        <Pressable
          onHoverIn={() => setHoveredNav('admin')}
          onHoverOut={() => setHoveredNav(null)}
          onPress={() => navigation.navigate('AdminPanel')}
          style={[
            styles.navItem,
            activeScreen === 'admin' && styles.navItemActive,
            hoveredNav === 'admin' && styles.navItemHovered,
          ]}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={[
            styles.navLabel,
            activeScreen === 'admin' && styles.navLabelActive
          ]}>Administration</Text>
        </Pressable>
      )}

      {/* Feedback Button */}
      <Pressable
        onHoverIn={() => setHoveredNav('feedback')}
        onHoverOut={() => setHoveredNav(null)}
        onPress={() => setShowFeedbackModal(true)}
        style={[
          styles.feedbackButton,
          hoveredNav === 'feedback' && styles.feedbackButtonHovered,
        ]}
      >
        <Text style={styles.feedbackIcon}>💬</Text>
        <Text style={styles.feedbackText}>Feedback / Bug</Text>
      </Pressable>

      {/* Logout */}
      <Pressable
        onHoverIn={() => setHoveredNav('logout')}
        onHoverOut={() => setHoveredNav(null)}
        onPress={handleLogout}
        style={[
          styles.logoutButton,
          hoveredNav === 'logout' && styles.logoutButtonHovered,
        ]}
      >
        <Text style={styles.logoutIcon}>↪</Text>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      {/* Feedback Modal */}
      <Modal visible={showFeedbackModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Feedback / Bug melden</Text>

            {/* Type Selection */}
            <View style={styles.typeContainer}>
              {[
                { id: 'bug', label: '🐛 Bug/Fehler' },
                { id: 'feature', label: '💡 Verbesserung' },
                { id: 'other', label: '📝 Sonstiges' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeButton,
                    feedbackType === type.id && styles.typeButtonActive,
                  ]}
                  onPress={() => setFeedbackType(type.id as any)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    feedbackType === type.id && styles.typeButtonTextActive,
                  ]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.inputLabel}>Beschreibung</Text>
            <TextInput
              style={styles.textArea}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Beschreibe das Problem oder deinen Vorschlag möglichst genau..."
              multiline
              numberOfLines={5}
            />

            <Text style={styles.hintText}>
              Aktueller Bereich: {activeScreen}
            </Text>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={submitFeedback}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Sende...' : 'Absenden'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
    // @ts-ignore
    cursor: 'pointer',
  },
  logoBox: {
    width: 40,
    height: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  logoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  navContainer: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  navItemActive: {
    backgroundColor: '#f5f5f5',
  },
  navItemHovered: {
    backgroundColor: '#f5f5f5',
  },
  navIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  navLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: '#fef2f2',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  logoutButtonHovered: {
    backgroundColor: '#fee2e2',
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
    color: '#ef4444',
  },
  logoutText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: '#f0f9ff',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  feedbackButtonHovered: {
    backgroundColor: '#e0f2fe',
  },
  feedbackIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  feedbackText: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 450,
    maxWidth: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  submitButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
