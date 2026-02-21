import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, TouchableOpacity, Platform, useWindowDimensions, Image, ScrollView } from 'react-native';
import { supabase } from '../config/supabase';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';

interface SidebarProps {
  navigation: any;
  activeScreen: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    role?: string;
  } | null;
  onNavigate?: () => void;
  embedded?: boolean; // Wenn true, wird nur der Inhalt ohne Mobile-Header/Modal gerendert
  onFeedbackModalChange?: (isOpen: boolean) => void; // Callback für Feedback-Modal Status
}

// Breakpoint für Mobile
const MOBILE_BREAKPOINT = 768;

export function Sidebar({ navigation, activeScreen, profile, onNavigate, embedded, onFeedbackModalChange }: SidebarProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModalState] = useState(false);

  // Wrapper für setShowFeedbackModal um Parent zu informieren
  const setShowFeedbackModal = (value: boolean) => {
    setShowFeedbackModalState(value);
    onFeedbackModalChange?.(value);
  };
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [promptCopied, setPromptCopied] = useState(false);
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const { colors, isDark } = useTheme();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setFeedbackImage(result.assets[0].uri);
    }
  };

  const generateAIPrompt = () => {
    const typeLabels: Record<string, string> = {
      bug: 'Bug/Fehler',
      feature: 'Feature/Verbesserung',
      other: 'Sonstiges'
    };

    const prompt = `Ich habe ein ${typeLabels[feedbackType]} in der KMH Sports Agency App gefunden:

**Bereich:** ${activeScreen}
**Typ:** ${typeLabels[feedbackType]}

**Beschreibung:**
${feedbackText}

${feedbackImage ? '**Screenshot:** [Screenshot wurde angehängt - bitte separat teilen]' : ''}

Bitte analysiere das Problem und implementiere eine Lösung. Achte dabei auf:
- Dark Mode Kompatibilität
- Mobile und Desktop Ansichten
- Bestehende Code-Patterns im Projekt`;

    setGeneratedPrompt(prompt);
    setPromptCopied(false);
  };

  const copyPromptToClipboard = async () => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(generatedPrompt);
    }
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

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
      setFeedbackImage(null);
      setGeneratedPrompt('');
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
    onNavigate?.();
  };

  const handleNavigation = (screen: string, id: string) => {
    if (activeScreen === id) {
      onNavigate?.();
      return;
    }
    navigation.navigate(screen);
    onNavigate?.();
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

  // Sidebar-Inhalt (wird sowohl für Desktop als auch Mobile verwendet)
  const SidebarContent = () => (
    <>
      {/* Logo - klickbar zum Dashboard */}
      <Pressable onPress={goToDashboard} style={styles.logoContainer}>
        <Image
          source={require('../../assets/kmh-logo.png')}
          style={styles.logoImage}
        />
        <Text style={[styles.logoTitle, { color: colors.text }]}>Sports Agency</Text>
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
              activeScreen === item.id && { backgroundColor: colors.surfaceSecondary },
              hoveredNav === item.id && { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            {item.id === 'aufgaben' ? (
              <View style={[styles.checkboxIcon, { borderColor: isDark ? '#fff' : '#64748b' }]}>
                <Text style={[styles.checkboxIconText, { color: isDark ? '#fff' : '#64748b' }]}>✓</Text>
              </View>
            ) : (
              <Text style={styles.navIcon}>{item.icon}</Text>
            )}
            <Text style={[
              styles.navLabel,
              { color: colors.textSecondary },
              activeScreen === item.id && { color: colors.text, fontWeight: '600' }
            ]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Finanzen - only for Matti */}
      {profile?.id === '892d4dbc-3c5b-4908-9735-ac0ca3794dfc' && (
        <View style={{ marginTop: 4 }}>
          <Pressable
            onHoverIn={() => setHoveredNav('finanzen')}
            onHoverOut={() => setHoveredNav(null)}
            onPress={() => handleNavigation('Finanzen', 'finanzen')}
            style={[
              styles.navItem,
              activeScreen === 'finanzen' && { backgroundColor: colors.surfaceSecondary },
              hoveredNav === 'finanzen' && { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Text style={styles.navIcon}>💰</Text>
            <Text style={[
              styles.navLabel,
              { color: colors.textSecondary },
              activeScreen === 'finanzen' && { color: colors.text, fontWeight: '600' }
            ]}>Finanzen</Text>
          </Pressable>
        </View>
      )}

      {/* Wissenswertes - only for Matti */}
      {profile?.id === '892d4dbc-3c5b-4908-9735-ac0ca3794dfc' && (
        <View style={{ marginTop: 4 }}>
          <Pressable
            onHoverIn={() => setHoveredNav('wissenswertes')}
            onHoverOut={() => setHoveredNav(null)}
            onPress={() => handleNavigation('Wissenswertes', 'wissenswertes')}
            style={[
              styles.navItem,
              activeScreen === 'wissenswertes' && { backgroundColor: colors.surfaceSecondary },
              hoveredNav === 'wissenswertes' && { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Text style={styles.navIcon}>💡</Text>
            <Text style={[
              styles.navLabel,
              { color: colors.textSecondary },
              activeScreen === 'wissenswertes' && { color: colors.text, fontWeight: '600' }
            ]}>Wissenswertes</Text>
          </Pressable>
        </View>
      )}

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Admin - only if admin */}
      {profile?.role === 'admin' && (
        <Pressable
          onHoverIn={() => setHoveredNav('admin')}
          onHoverOut={() => setHoveredNav(null)}
          onPress={() => {
            navigation.navigate('AdminPanel');
            onNavigate?.();
          }}
          style={[
            styles.navItem,
            activeScreen === 'admin' && { backgroundColor: colors.surfaceSecondary },
            hoveredNav === 'admin' && { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={[
            styles.navLabel,
            { color: colors.textSecondary },
            activeScreen === 'admin' && { color: colors.text, fontWeight: '600' }
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
          { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#f0f9ff' },
          hoveredNav === 'feedback' && { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.3)' : '#e0f2fe' },
        ]}
      >
        <Text style={styles.feedbackIcon}>💬</Text>
        <Text style={[styles.feedbackText, { color: isDark ? '#7dd3fc' : '#0284c7' }]}>Feedback / Bug</Text>
      </Pressable>

      {/* Logout */}
      <Pressable
        onHoverIn={() => setHoveredNav('logout')}
        onHoverOut={() => setHoveredNav(null)}
        onPress={handleLogout}
        style={[
          styles.logoutButton,
          { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2' },
          hoveredNav === 'logout' && { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fee2e2' },
        ]}
      >
        <Text style={styles.logoutIcon}>↪</Text>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </>
  );

  // Mobile embedded: Nur Content ohne Header/Modal (für externes Overlay)
  if (isMobile && embedded) {
    return (
      <View style={[styles.sidebarEmbedded, { backgroundColor: colors.surface }]}>
        <SidebarContent />
        <Modal visible={showFeedbackModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isMobile && styles.modalContentMobile, { backgroundColor: colors.surface }]}>
              <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Feedback / Bug melden</Text>
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
                        { borderColor: colors.border },
                        feedbackType === type.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setFeedbackType(type.id as any)}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        { color: colors.textSecondary },
                        feedbackType === type.id && { color: colors.primaryText },
                      ]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Beschreibung</Text>
                <TextInput
                  style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Beschreibe das Problem oder deinen Vorschlag..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={5}
                />

                {/* Screenshot Upload */}
                <Text style={[styles.inputLabel, { color: colors.text, marginTop: 8 }]}>Screenshot (optional)</Text>
                <View style={styles.imageUploadContainer}>
                  <TouchableOpacity
                    style={[styles.imageUploadButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                    onPress={pickImage}
                  >
                    <Text style={{ fontSize: 20, marginRight: 8 }}>📷</Text>
                    <Text style={[styles.imageUploadText, { color: colors.textSecondary }]}>
                      {feedbackImage ? 'Bild ändern' : 'Bild auswählen'}
                    </Text>
                  </TouchableOpacity>
                  {feedbackImage && (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: feedbackImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setFeedbackImage(null)}
                      >
                        <Text style={styles.removeImageText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <Text style={[styles.hintText, { color: colors.textMuted }]}>
                  Aktueller Bereich: {activeScreen}
                </Text>

                {/* AI Prompt Generator */}
                {feedbackText.trim().length > 0 && (
                  <View style={[styles.promptSection, { borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.generatePromptButton, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f3e8ff' }]}
                      onPress={generateAIPrompt}
                    >
                      <Text style={{ fontSize: 16, marginRight: 8 }}>🤖</Text>
                      <Text style={[styles.generatePromptText, { color: isDark ? '#c4b5fd' : '#7c3aed' }]}>
                        AI-Prompt generieren
                      </Text>
                    </TouchableOpacity>

                    {generatedPrompt.length > 0 && (
                      <View style={[styles.promptContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                        <Text style={[styles.promptText, { color: colors.text }]} selectable>
                          {generatedPrompt}
                        </Text>
                        <TouchableOpacity
                          style={[styles.copyButton, { backgroundColor: promptCopied ? '#22c55e' : colors.primary }]}
                          onPress={copyPromptToClipboard}
                        >
                          <Text style={[styles.copyButtonText, { color: colors.primaryText }]}>
                            {promptCopied ? '✓ Kopiert!' : '📋 Kopieren'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              <View style={[styles.modalButtons, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowFeedbackModal(false);
                    setFeedbackText('');
                    setFeedbackImage(null);
                    setGeneratedPrompt('');
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
                  onPress={submitFeedback}
                  disabled={submitting}
                >
                  <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>
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

  // Mobile ohne embedded: Wird nicht mehr verwendet
  // Alle Screens nutzen jetzt MobileHeader + embedded Sidebar
  if (isMobile && !embedded) {
    return null; // Sidebar wird auf Mobile nur mit embedded prop gerendert
  }

  // Desktop: Normale Sidebar
  return (
    <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <SidebarContent />
      <Modal visible={showFeedbackModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && styles.modalContentMobile, { backgroundColor: colors.surface }]}>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Feedback / Bug melden</Text>
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
                      { borderColor: colors.border },
                      feedbackType === type.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setFeedbackType(type.id as any)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      { color: colors.textSecondary },
                      feedbackType === type.id && { color: colors.primaryText },
                    ]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Beschreibung</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.text }]}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Beschreibe das Problem oder deinen Vorschlag..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
              />

              {/* Screenshot Upload */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 8 }]}>Screenshot (optional)</Text>
              <View style={styles.imageUploadContainer}>
                <TouchableOpacity
                  style={[styles.imageUploadButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                  onPress={pickImage}
                >
                  <Text style={{ fontSize: 20, marginRight: 8 }}>📷</Text>
                  <Text style={[styles.imageUploadText, { color: colors.textSecondary }]}>
                    {feedbackImage ? 'Bild ändern' : 'Bild auswählen'}
                  </Text>
                </TouchableOpacity>
                {feedbackImage && (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: feedbackImage }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setFeedbackImage(null)}
                    >
                      <Text style={styles.removeImageText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={[styles.hintText, { color: colors.textMuted }]}>
                Aktueller Bereich: {activeScreen}
              </Text>

              {/* AI Prompt Generator */}
              {feedbackText.trim().length > 0 && (
                <View style={[styles.promptSection, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.generatePromptButton, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f3e8ff' }]}
                    onPress={generateAIPrompt}
                  >
                    <Text style={{ fontSize: 16, marginRight: 8 }}>🤖</Text>
                    <Text style={[styles.generatePromptText, { color: isDark ? '#c4b5fd' : '#7c3aed' }]}>
                      AI-Prompt generieren
                    </Text>
                  </TouchableOpacity>

                  {generatedPrompt.length > 0 && (
                    <View style={[styles.promptContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                      <Text style={[styles.promptText, { color: colors.text }]} selectable>
                        {generatedPrompt}
                      </Text>
                      <TouchableOpacity
                        style={[styles.copyButton, { backgroundColor: promptCopied ? '#22c55e' : colors.primary }]}
                        onPress={copyPromptToClipboard}
                      >
                        <Text style={[styles.copyButtonText, { color: colors.primaryText }]}>
                          {promptCopied ? '✓ Kopiert!' : '📋 Kopieren'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalButtons, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText('');
                  setFeedbackImage(null);
                  setGeneratedPrompt('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
                onPress={submitFeedback}
                disabled={submitting}
              >
                <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>
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
  // Desktop Sidebar
  sidebar: {
    width: 240,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  // Embedded Sidebar (für externes Overlay)
  sidebarEmbedded: {
    flex: 1,
    backgroundColor: '#fff',
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
  checkboxIcon: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxIconText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: -1,
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
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
  // Image Upload Styles
  imageUploadContainer: {
    marginBottom: 16,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed' as any,
  },
  imageUploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 150,
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // AI Prompt Styles
  promptSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  generatePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  generatePromptText: {
    fontSize: 14,
    fontWeight: '600',
  },
  promptContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
