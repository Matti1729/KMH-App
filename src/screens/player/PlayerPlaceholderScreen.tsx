import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

interface PlayerPlaceholderScreenProps {
  title: string;
  description: string;
  emoji: string;
  activeScreen: string;
}

export function PlayerPlaceholderScreen({ title, description, emoji, activeScreen }: PlayerPlaceholderScreenProps) {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const Content = (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>{description}</Text>
        <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>Bald verfügbar</Text>
      </View>
    </ScrollView>
  );

  if (isMobile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen={activeScreen}
          profile={profile as any}
          playerMode
        />
        <MobileHeader title={title} onMenuPress={() => setShowMobileSidebar(true)} />
        {Content}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.containerDesktop, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen={activeScreen} profile={profile as any} playerMode />
      <View style={[styles.mainContent, { backgroundColor: colors.background }]}>{Content}</View>
    </View>
  );
}

export function KmhTeamScreen() {
  return (
    <PlayerPlaceholderScreen
      title="Unser KMH-Team"
      description="Lerne dein KMH-Team kennen – deine Berater, Ansprechpartner und das gesamte Office."
      emoji="🤝"
      activeScreen="kmhTeam"
    />
  );
}

export function NewsScreen() {
  return (
    <PlayerPlaceholderScreen
      title="News"
      description="Aktuelle News, Updates und Mitteilungen rund um KMH Sports Agency."
      emoji="📰"
      activeScreen="news"
    />
  );
}

export function BeratungScreen() {
  return (
    <PlayerPlaceholderScreen
      title="Was bedeutet Beratung"
      description="Erfahre, was Beratung bei KMH bedeutet, welche Leistungen du bekommst und wie wir dich auf deinem Weg begleiten."
      emoji="💡"
      activeScreen="beratung"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: {
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  cardDescription: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 480, marginBottom: 16 },
  comingSoon: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
});
