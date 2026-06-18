import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Platform, useWindowDimensions } from 'react-native';
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
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const uniformCardWidth = Math.max(160, Math.floor((windowWidth - (isMobile ? 0 : 240) - 48 - 32) / 3));

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
    {
      id: 'finanzen',
      icon: '💰',
      title: 'Finanzen',
      subtitle: 'Provisionen & Rechnungen',
      screen: 'Finanzen',
    },
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

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContentUniform}>
          {(() => {
            const rows: typeof tools[] = [];
            for (let i = 0; i < tools.length; i += 3) {
              rows.push(tools.slice(i, i + 3));
            }
            return (
              <View style={styles.uniformGrid}>
                {rows.map((rowCards, rowIdx) => (
                  <View key={rowIdx} style={styles.uniformGridRow}>
                    {rowCards.map((tool) => {
                      const isHovered = hoveredCard === tool.id;
                      return (
                        <Pressable
                          key={tool.id}
                          onPress={() => navigation.navigate(tool.screen)}
                          onHoverIn={() => setHoveredCard(tool.id)}
                          onHoverOut={() => setHoveredCard(null)}
                          style={[
                            styles.card,
                            styles.uniformCard,
                            { width: uniformCardWidth, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
                            isHovered ? { backgroundColor: 'transparent' } : null,
                            isHovered && Platform.OS === 'web' ? ({ backdropFilter: 'none', WebkitBackdropFilter: 'none' } as any) : null,
                          ]}
                        >
                          <View style={styles.uniformCardHeader}>
                            <View style={{ flex: 1 }} />
                            <Text style={styles.uniformCardIcon}>{tool.icon}</Text>
                          </View>
                          <View style={styles.uniformCardFooter}>
                            <Text style={styles.uniformCardTitle}>{tool.title}</Text>
                            <Text style={styles.uniformCardSubtitle}>{tool.subtitle}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })()}
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

  // Dashboard-style Cards (gleiche Werte wie in AdvisorHomeScreen)
  scrollContentUniform: { padding: 24 },
  uniformGrid: { gap: 16 },
  uniformGridRow: { flexDirection: 'row', gap: 16 },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.2s ease',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightColor: 'rgba(255,255,255,0.12)',
    borderBottomColor: 'rgba(0,0,0,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
    // @ts-ignore
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 22px 44px rgba(0,0,0,0.6), 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
    } : {}),
  },
  uniformCard: {
    height: 160,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any : {}),
  },
  uniformCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  uniformCardIcon: {
    fontSize: 32,
    lineHeight: 38,
  },
  uniformCardFooter: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  uniformCardTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#fff',
  },
  uniformCardSubtitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 1,
    marginTop: 4,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.7)',
  },
});
