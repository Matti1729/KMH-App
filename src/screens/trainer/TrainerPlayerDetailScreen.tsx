import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../config/supabase';

const BACKGROUND_IMAGE = require('../../../assets/stadion-bg.jpeg');

// Anzeige-Kette _player → _advisor → unsuffixed (wie im Berater-View).
const pick = (r: any, key: string): string => r?.[`${key}_player`] || r?.[`${key}_advisor`] || r?.[key] || '';

function formatPhone(phone: string, cc: string): string {
  if (!phone) return '-';
  return `${cc || ''} ${phone}`.trim();
}
function formatAddress(street: string, plz: string, city: string): string {
  const line2 = [plz, city].filter(Boolean).join(' ');
  const out = [street, line2].filter(Boolean).join(', ');
  return out || '-';
}

export function TrainerPlayerDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const playerId: string | undefined = route.params?.playerId;
  const { profile } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [player, setPlayer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayer = useCallback(async () => {
    if (!playerId) { setLoading(false); return; }
    const { data } = await supabase.from('player_details').select('*').eq('id', playerId).single();
    setPlayer(data || null);
    setLoading(false);
  }, [playerId]);

  useEffect(() => { fetchPlayer(); }, [fetchPlayer]);

  const firstName = (player?.first_name || '').toUpperCase();
  const lastName = (player?.last_name || '').toUpperCase();
  const club = player?.club || 'VEREINSLOS';

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value || '-'}</Text>
    </View>
  );

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );

  const Content = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 16 : 24 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Zurück zur Liste</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : !player ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 40 }}>Spieler nicht gefunden.</Text>
      ) : (
        <>
          {/* Header */}
          <View style={styles.headerCard}>
            {player.photo_url ? (
              <Image source={{ uri: player.photo_url }} style={styles.headerPhoto} />
            ) : (
              <View style={[styles.headerPhoto, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: colors.primaryText, fontSize: 36, fontWeight: '700' }}>{firstName[0] || ''}{lastName[0] || ''}</Text>
              </View>
            )}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={styles.headerName}>{firstName}</Text>
              <Text style={styles.headerName}>{lastName}</Text>
              <Text style={styles.headerClub}>{club}</Text>
            </View>
          </View>

          {/* Performance CTA */}
          <TouchableOpacity onPress={() => navigation.navigate('Performance', { playerId, trainerMode: true })} style={styles.perfButton}>
            <Ionicons name="stats-chart" size={18} color="#fff" />
            <Text style={styles.perfButtonText}>Performance öffnen</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          <Card title="Kontaktdaten">
            <InfoRow label="Telefon" value={formatPhone(pick(player, 'phone'), pick(player, 'phone_country_code'))} />
            <InfoRow label="E-Mail" value={pick(player, 'email')} />
            <InfoRow label="Adresse" value={formatAddress(pick(player, 'street'), pick(player, 'postal_code'), pick(player, 'city'))} />
          </Card>

          <Card title="Verletzungen & Krankheiten">
            <Text style={[styles.infoValue, { color: colors.text }]}>{player.injuries || '-'}</Text>
          </Card>
        </>
      )}
    </ScrollView>
  );

  if (isMobile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="trainerPlayers" profile={profile as any} trainerMode />
        <MobileHeader title="Spielerprofil" onMenuPress={() => setShowMobileSidebar(true)} />
        <View style={{ flex: 1, position: 'relative' }}>
          <Image source={BACKGROUND_IMAGE} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          {Content}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.containerDesktop, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="trainerPlayers" profile={profile as any} trainerMode />
      <View style={[styles.mainContent, { position: 'relative' }]}>
        <Image source={BACKGROUND_IMAGE} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
        {Content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1 },
  headerCard: { flexDirection: 'row', gap: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 20, marginBottom: 14 },
  headerPhoto: { width: 110, height: 140, borderRadius: 8 },
  headerName: { fontFamily: 'Josefin Sans', fontSize: 34, lineHeight: 38, fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' },
  headerClub: { fontFamily: 'Josefin Sans', fontSize: 18, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  perfButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(34,197,94,0.85)', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 14 },
  perfButtonText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
});
