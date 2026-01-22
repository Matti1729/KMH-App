import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, TouchableOpacity, Platform, useWindowDimensions, Image } from 'react-native';
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

// Breakpoint für Mobile
const MOBILE_BREAKPOINT = 768;
const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function Sidebar({ navigation, activeScreen, profile }: SidebarProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const currentWeekday = WEEKDAYS_DE[new Date().getDay()];
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

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
    setMobileMenuOpen(false);
    navigation.navigate('AdvisorDashboard');
  };

  const handleNavigation = (screen: string, id: string) => {
    if (activeScreen === id) {
      setMobileMenuOpen(false);
      return;
    }
    setMobileMenuOpen(false);
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

  // Aktuellen Screen-Namen finden
  const currentScreenLabel = navItems.find(item => item.id === activeScreen)?.label ||
    (activeScreen === 'admin' ? 'Administration' : 'Dashboard');

  // Sidebar-Inhalt (wird sowohl für Desktop als auch Mobile verwendet)
  const SidebarContent = () => (
    <>
      {/* Logo - klickbar zum Dashboard */}
      <Pressable onPress={goToDashboard} style={styles.logoContainer}>
        <Image
          source={require('../../assets/kmh-logo.png')}
          style={styles.logoImage}
        />
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
          onPress={() => {
            setMobileMenuOpen(false);
            navigation.navigate('AdminPanel');
          }}
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
    </>
  );

  // Feedback Modal
  const FeedbackModal = () => (
    <Modal visible={showFeedbackModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
          <Text style={styles.modalTitle}>Feedback / Bug melden</Text>

          {/* Type Selection */}
          <View style={[styles.typeContainer, isMobile && styles.typeContainerMobile]}>
            {[
              { id: 'bug', label: '🐛 Bug' },
              { id: 'feature', label: '💡 Idee' },
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
            placeholder="Beschreibe das Problem oder deinen Vorschlag..."
            placeholderTextColor="#999"
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
  );

  // Mobile: Header mit Hamburger-Menü
  if (isMobile) {
    return (
      <>
        {/* Mobile Header */}
        <View style={styles.mobileHeader}>
          <Pressable
            onPress={() => setMobileMenuOpen(true)}
            style={styles.hamburgerButton}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </Pressable>
          {activeScreen === 'dashboard' ? (
            <View style={styles.mobileGreetingContainer}>
              <Text style={styles.mobileGreeting}>
                Einen schönen {currentWeekday}, {profile?.first_name || 'User'}.
              </Text>
              <Text style={styles.mobileSubGreeting}>
                Willkommen im Karl M. Herzog Sportmanagement!
              </Text>
            </View>
          ) : (
            <Text style={styles.mobileTitle}>{currentScreenLabel}</Text>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('MyProfile')}
            style={styles.profileButtonMobile}
          >
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.profileAvatarMobile} />
            ) : (
              <View style={styles.profileAvatarPlaceholderMobile}>
                <Text style={styles.profileAvatarTextMobile}>
                  {profile?.first_name?.[0] || ''}{profile?.last_name?.[0] || ''}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Mobile Menu Overlay */}
        <Modal
          visible={mobileMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMobileMenuOpen(false)}
        >
          <View style={styles.mobileMenuOverlay}>
            <Pressable
              style={styles.mobileMenuBackdrop}
              onPress={() => setMobileMenuOpen(false)}
            />
            <View style={styles.mobileMenuContent}>
              {/* Close Button */}
              <Pressable
                style={styles.closeButton}
                onPress={() => setMobileMenuOpen(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
              <SidebarContent />
            </View>
          </View>
        </Modal>

        <FeedbackModal />
      </>
    );
  }

  // Desktop: Normale Sidebar
  return (
    <View style={styles.sidebar}>
      <SidebarContent />
      <FeedbackModal />
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop Sidebar
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
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  logoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  navContainer: {
    // gap removed for mobile compatibility
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
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

  // Mobile Header
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  hamburgerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: {
    fontSize: 24,
    color: '#1a1a1a',
  },
  mobileTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileGreetingContainer: {
    flex: 1,
    marginLeft: 4,
  },
  mobileGreeting: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  mobileSubGreeting: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  profileButtonMobile: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profileAvatarPlaceholderMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarTextMobile: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Mobile Menu
  mobileMenuOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  mobileMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileMenuContent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    // @ts-ignore
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },

  // Modal Styles
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
  modalContentMobile: {
    width: '95%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  typeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeContainerMobile: {
    flexDirection: 'column',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
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
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 12,
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
