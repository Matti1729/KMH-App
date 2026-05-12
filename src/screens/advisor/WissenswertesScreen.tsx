import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { AdvisorHeroHeader } from '../../components/AdvisorHeroHeader';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export function WissenswertesScreen({ navigation }: { navigation: any }) {
  const isMobile = useIsMobile();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const isMatti = session?.user?.id === '892d4dbc-3c5b-4908-9735-ac0ca3794dfc';

  const tools = [
    {
      id: 'prototypes',
      icon: '🎯',
      title: 'Prototypen',
      subtitle: 'Positions-Profile & Anforderungen',
      screen: 'PlayerPrototypes',
    },
    {
      id: 'videolibrary',
      icon: '🎬',
      title: 'Video-Library',
      subtitle: 'Kuratierte Clips für Stärken & Potenziale',
      screen: 'VideoLibrary',
    },
    {
      id: 'ae-rechner',
      icon: '📊',
      title: 'Ausbildungsentschädigung',
      subtitle: 'AE-Rechner nach DFL/DFB 2024',
      screen: 'AECalculator',
    },
    ...(isMatti ? [{
      id: 'finanzen',
      icon: '💰',
      title: 'Finanzen',
      subtitle: 'Provisionen & Rechnungen',
      screen: 'Finanzen',
    }] : []),
  ];

  // --- Mobile View ---
  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="wissenswertes" />
        <MobileHeader title="Wissenswertes" subtitle="Tools & Informationen" backgroundImage={require('../../../assets/scouting-header-bg.jpg')} onMenuPress={() => setShowMobileSidebar(true)} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {tools.map((tool) => (
            <Pressable
              key={tool.id}
              onPress={() => navigation.navigate(tool.screen)}
              onHoverIn={() => setHoveredCard(tool.id)}
              onHoverOut={() => setHoveredCard(null)}
              style={[
                styles.toolCard,
                { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
                hoveredCard === tool.id && { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <View style={styles.toolCardContent}>
                <View style={[styles.toolCardIcon, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={styles.toolCardIconText}>{tool.icon}</Text>
                </View>
                <View style={styles.toolCardText}>
                  <Text style={[styles.toolCardTitle, { color: colors.text }]}>{tool.title}</Text>
                  <Text style={[styles.toolCardSubtitle, { color: colors.textSecondary }]}>{tool.subtitle}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  // --- Desktop View ---
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="wissenswertes" profile={profile} />

      <View style={styles.mainContent}>
        <AdvisorHeroHeader title="WISSENSWERTES" subtitle="TOOLS · RECHNER · INFORMATIONEN" backgroundImage={require('../../../assets/scouting-header-bg.jpg')} backgroundImageOpacity={0.45} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32 }}>
          <Text style={[styles.sectionTitleDesktop, { color: colors.text }]}>Tools & Informationen</Text>
          <View style={styles.toolsGrid}>
            {tools.map((tool) => (
              <Pressable
                key={tool.id}
                onPress={() => navigation.navigate(tool.screen)}
                onHoverIn={() => setHoveredCard(tool.id)}
                onHoverOut={() => setHoveredCard(null)}
                style={[
                  styles.toolCardDesktop,
                  { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
                  hoveredCard === tool.id && { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <View style={[styles.toolCardIconLarge, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={{ fontSize: 32 }}>{tool.icon}</Text>
                </View>
                <Text style={[styles.toolCardTitleDesktop, { color: colors.text }]}>{tool.title}</Text>
                <Text style={[styles.toolCardSubtitleDesktop, { color: colors.textSecondary }]}>{tool.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  containerMobile: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionTitleDesktop: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  toolCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  toolCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toolCardIconText: {
    fontSize: 22,
  },
  toolCardText: {
    flex: 1,
  },
  toolCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  toolCardSubtitle: {
    fontSize: 13,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  toolCardDesktop: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  toolCardIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  toolCardTitleDesktop: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  toolCardSubtitleDesktop: {
    fontSize: 13,
    textAlign: 'center',
  },
});
