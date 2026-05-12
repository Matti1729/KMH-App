import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Pressable, useWindowDimensions, Platform } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface AdvisorProfile {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string;
  role: string;
}

const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function AdvisorHomeScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState<AdvisorProfile | null>(null);
  const currentWeekday = WEEKDAYS_DE[new Date().getDay()];
  const { width: windowWidth } = useWindowDimensions();
  const uniformCardWidth = Math.max(160, Math.floor((windowWidth - (isMobile ? 0 : 240) - 48 - 32) / 3));
  const [playerCount, setPlayerCount] = useState(0);
  const [scoutingCount, setScoutingCount] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [transferCount, setTransferCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [openFeedbackCount, setOpenFeedbackCount] = useState(0);
  const [todayGamesCount, setTodayGamesCount] = useState(0);
  const [networkContactsCount, setNetworkContactsCount] = useState(0);
  const dataLoadedRef = useRef(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Daten nur laden wenn Auth bereit ist
  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (dataLoadedRef.current) return;

    dataLoadedRef.current = true;
    fetchProfile();
    fetchPlayerCount();
    fetchScoutingCount();
    fetchTransferCount();
    fetchPendingRequestsCount();
    fetchOpenFeedbackCount();
    fetchTodayGamesCount();
    fetchNetworkContactsCount();
  }, [authLoading, session]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, photo_url, role')
        .eq('id', user.id)
        .single();

      if (data) setProfile(data);
    }
  };

  const fetchPlayerCount = async () => {
    // Alle aktiven Spieler aus player_details zählen
    const { count } = await supabase
      .from('player_details')
      .select('*', { count: 'exact', head: true });
    
    setPlayerCount(count || 0);
  };

  const fetchScoutingCount = async () => {
    const { count } = await supabase
      .from('scouted_players')
      .select('*', { count: 'exact', head: true });
    
    setScoutingCount(count || 0);
  };

  // Spieler mit auslaufendem Vertrag in der aktuellen Saison und ohne zukünftigen Verein
  const fetchTransferCount = async () => {
    const { data } = await supabase
      .from('player_details')
      .select('id, contract_end, future_club');
    
    if (data) {
      // Gleiche Logik wie in TransfersScreen - isContractInCurrentSeason
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const seasonStartYear = todayMonth >= 6 ? todayYear : todayYear - 1;
      const seasonEndYear = seasonStartYear + 1;
      
      const isContractInCurrentSeason = (contractEnd: string): boolean => {
        if (!contractEnd) return false;
        const contractDate = new Date(contractEnd);
        const contractYear = contractDate.getFullYear();
        const contractMonth = contractDate.getMonth();
        const contractDay = contractDate.getDate();
        const afterStart = (contractYear > seasonStartYear) || (contractYear === seasonStartYear && contractMonth >= 6);
        const beforeEnd = (contractYear < seasonEndYear) || (contractYear === seasonEndYear && contractMonth < 5) || (contractYear === seasonEndYear && contractMonth === 5 && contractDay <= 30);
        return afterStart && beforeEnd;
      };
      
      const isContractExpired = (contractEnd: string): boolean => {
        if (!contractEnd) return false;
        return today > new Date(contractEnd);
      };
      
      const transferPlayers = data.filter(p => {
        // Hat bereits zukünftigen Verein? -> Nicht zählen
        if (p.future_club && p.future_club.trim() !== '') return false;
        // Vertrag abgelaufen oder läuft in aktueller Saison aus?
        return isContractExpired(p.contract_end) || isContractInCurrentSeason(p.contract_end);
      });
      
      setTransferCount(transferPlayers.length);
    }
  };

  const fetchPendingRequestsCount = async () => {
    const { count } = await supabase
      .from('access_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    setPendingRequestsCount(count || 0);
  };

  const fetchOpenFeedbackCount = async () => {
    const { count } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    setOpenFeedbackCount(count || 0);
  };

  const fetchTodayGamesCount = async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    let totalCount = 0;
    
    // 1. Spiele aus player_games zählen (date = heute)
    const { count: gamesCount } = await supabase
      .from('player_games')
      .select('*', { count: 'exact', head: true })
      .eq('date', todayStr);
    
    totalCount += gamesCount || 0;
    
    // 2. Termine aus termine zählen (heute zwischen datum und datum_ende)
    // Nur aktive Termine laden (wie im TermineScreen)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: termineData } = await supabase
      .from('termine')
      .select('*')
      .or(`datum.gte.${oneDayAgo.toISOString()},datum_ende.gte.${now.toISOString()}`);
    
    if (termineData) {
      const todayTermineCount = termineData.filter(t => {
        const terminStart = new Date(t.datum);
        terminStart.setHours(0, 0, 0, 0);
        const terminEnde = t.datum_ende ? new Date(t.datum_ende) : new Date(t.datum);
        terminEnde.setHours(23, 59, 59, 999);
        
        return terminStart <= now && terminEnde >= now;
      }).length;
      
      totalCount += todayTermineCount;
    }
    
    setTodayGamesCount(totalCount);
  };

  const fetchNetworkContactsCount = async () => {
    const { count } = await supabase
      .from('football_network_contacts')
      .select('*', { count: 'exact', head: true });
    
    setNetworkContactsCount(count || 0);
  };

  const DashboardCard = ({
    id,
    children,
    style,
    onPress,
    hoverStyle
  }: {
    id: string;
    children: React.ReactNode;
    style?: any;
    onPress?: () => void;
    hoverStyle?: any;
  }) => (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHoveredCard(id)}
      onHoverOut={() => setHoveredCard(null)}
      style={[
        styles.card,
        style,
        hoveredCard === id && (hoverStyle || { backgroundColor: colors.surfaceSecondary })
      ]}
    >
      {children}
    </Pressable>
  );

  // Profile initials for header
  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  // Mobile View
  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="dashboard"
          profile={profile}
        />

        <View style={[styles.mainContentMobile, { backgroundColor: 'transparent' }]}>
          <MobileHeader
            title="Dashboard"
            backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          >
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
              Schönen {currentWeekday}, {profile?.first_name || 'User'}!
            </Text>
          </MobileHeader>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentMobile}>
            <View style={styles.mobileCardsContainer}>
              {/* KMH-Spieler */}
              <DashboardCard
                id="players"
                style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => navigation.navigate('PlayerOverview')}
                hoverStyle={{ backgroundColor: 'transparent' }}
              >
                <View style={styles.mobileCardContent}>
                  <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>👤</Text></View>
                  <View style={styles.mobileCardText}>
                    <Text style={[styles.mobileCardTitle, { color: colors.text }]}>KMH-Spieler</Text>
                    <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Verwaltung aller Spieler</Text>
                  </View>
                  <Text style={[styles.mobileCardCount, { color: colors.text }]}>{playerCount}</Text>
                </View>
              </DashboardCard>

              {/* Transfers */}
              <DashboardCard
                id="transfers"
                style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => navigation.navigate('Transfers')}
                hoverStyle={{ backgroundColor: 'transparent' }}
              >
                <View style={styles.mobileCardContent}>
                  <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>🔄</Text></View>
                  <View style={styles.mobileCardText}>
                    <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Transfers</Text>
                    <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Auslaufende Verträge</Text>
                  </View>
                  <Text style={[styles.mobileCardCount, { color: colors.text }]}>{transferCount}</Text>
                </View>
              </DashboardCard>

              {/* Football Network */}
              <DashboardCard
                id="network"
                style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => navigation.navigate('FootballNetwork')}
                hoverStyle={{ backgroundColor: 'transparent' }}
              >
                <View style={styles.mobileCardContent}>
                  <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>💼</Text></View>
                  <View style={styles.mobileCardText}>
                    <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Football Network</Text>
                    <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Kontakte & Entscheider</Text>
                  </View>
                  <Text style={[styles.mobileCardCount, { color: colors.text }]}>{networkContactsCount}</Text>
                </View>
              </DashboardCard>

              {/* Scouting */}
              <DashboardCard
                id="scouting"
                style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => navigation.navigate('Scouting')}
                hoverStyle={{ backgroundColor: 'transparent' }}
              >
                <View style={styles.mobileCardContent}>
                  <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>🔍</Text></View>
                  <View style={styles.mobileCardText}>
                    <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Scouting</Text>
                    <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Talente im Blick</Text>
                  </View>
                  <Text style={[styles.mobileCardCount, { color: colors.text }]}>{scoutingCount}</Text>
                </View>
              </DashboardCard>

              {/* Spieltage */}
              <DashboardCard
                id="termine"
                style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => navigation.navigate('Calendar')}
                hoverStyle={{ backgroundColor: 'transparent' }}
              >
                <View style={styles.mobileCardContent}>
                  <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>📅</Text></View>
                  <View style={styles.mobileCardText}>
                    <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Spieltage</Text>
                    <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Spiele & Termine</Text>
                  </View>
                  <View style={[styles.mobileCardBadgeRed, { backgroundColor: colors.error }]}>
                    <Text style={styles.mobileCardBadgeRedText}>{todayGamesCount}</Text>
                  </View>
                </View>
              </DashboardCard>

              {/* Wissenswertes — TEMPORÄR nur für Matti (Feature in Bearbeitung) */}
              {session?.user?.id === '892d4dbc-3c5b-4908-9735-ac0ca3794dfc' && (
                <DashboardCard
                  id="wissenswertes"
                  style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                  onPress={() => navigation.navigate('Wissenswertes')}
                  hoverStyle={{ backgroundColor: 'transparent' }}
                >
                  <View style={styles.mobileCardContent}>
                    <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>💡</Text></View>
                    <View style={styles.mobileCardText}>
                      <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Wissenswertes</Text>
                      <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Tools & Informationen</Text>
                    </View>
                  </View>
                </DashboardCard>
              )}

              {/* Admin */}
              {profile?.role === 'admin' && (
                <DashboardCard
                  id="admin"
                  style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                  onPress={() => navigation.navigate('AdminPanel')}
                  hoverStyle={{ backgroundColor: 'transparent' }}
                >
                  <View style={styles.mobileCardContent}>
                    <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>⚙️</Text></View>
                    <View style={styles.mobileCardText}>
                      <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Administration</Text>
                      <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>Benutzer & Rechte</Text>
                    </View>
                    {(pendingRequestsCount + openFeedbackCount) > 0 && (
                      <View style={[styles.mobileCardBadgeRed, { backgroundColor: colors.error }]}>
                        <Text style={styles.mobileCardBadgeRedText}>{pendingRequestsCount + openFeedbackCount}</Text>
                      </View>
                    )}
                  </View>
                </DashboardCard>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Desktop View
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Sidebar */}
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="dashboard" profile={profile} />

      {/* Main Content */}
      <View style={[styles.mainContent, { backgroundColor: 'transparent' }]}>
        {/* Header */}
        <View style={[styles.header, { overflow: 'hidden' }]}>
          <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 }} resizeMode="cover" />
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('MyProfile')}
              style={styles.profileButton}
            >
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.profileAvatar} />
              ) : (
                <View style={[styles.profileAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.profileAvatarText, { color: colors.primaryText }]}>
                    {profile?.first_name?.[0] || ''}{profile?.last_name?.[0] || ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.headerTitle}>KARL HERZOG SPORTMANAGEMENT</Text>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.headerBottomRow}>
            <Text style={styles.greeting}>
              Einen schönen {currentWeekday}, {profile?.first_name || 'User'}.
            </Text>
          </View>
        </View>

        {/* Dashboard Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentUniform}>
          {(() => {
            const isAdmin = profile?.role === 'admin';
            const isMatti = session?.user?.id === '892d4dbc-3c5b-4908-9735-ac0ca3794dfc';
            const allCards = [
              { id: 'players', icon: '👤', title: 'KMH-Spieler', subtitle: 'Verwaltung aller Spieler', count: playerCount, screen: 'PlayerOverview' },
              { id: 'transfers', icon: '🔄', title: 'Transfers', subtitle: 'Auslaufende Verträge & Wechsel', count: transferCount, screen: 'Transfers' },
              { id: 'scouting', icon: '🔍', title: 'Scouting', subtitle: 'Talente im Blick', count: scoutingCount, screen: 'Scouting' },
              { id: 'network', icon: '💼', title: 'Football Network', subtitle: 'Kontakte zu Vereinen & Entscheidern', count: networkContactsCount, screen: 'FootballNetwork' },
              { id: 'termine', icon: '📅', title: 'Spieltage', subtitle: 'Lehrgänge, Spiele & Turniere', badge: todayGamesCount, screen: 'Calendar' },
              // Wissenswertes TEMPORÄR nur für Matti (Feature in Bearbeitung)
              ...(isMatti ? [{ id: 'wissenswertes', icon: '💡', title: 'Wissenswertes', subtitle: 'Tools & Informationen', screen: 'Wissenswertes' }] : []),
              ...(isAdmin ? [{ id: 'admin', icon: '⚙️', title: 'Administration', subtitle: 'Benutzer & Rechte verwalten', badge: pendingRequestsCount + openFeedbackCount, screen: 'AdminPanel' }] : []),
            ] as Array<{ id: string; icon: string; title: string; subtitle: string; count?: number; badge?: number; screen: string }>;

            const rows: typeof allCards[] = [];
            for (let i = 0; i < allCards.length; i += 3) {
              rows.push(allCards.slice(i, i + 3));
            }

            return (
              <View style={styles.uniformGrid}>
                {rows.map((rowCards, rowIdx) => {
                  return (
                    <View key={rowIdx} style={styles.uniformGridRow}>
                      {rowCards.map((card) => {
                        const isHovered = hoveredCard === card.id;
                        return (
                        <DashboardCard
                          key={card.id}
                          id={card.id}
                          style={[
                            styles.uniformCard,
                            { width: uniformCardWidth, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
                            isHovered && Platform.OS === 'web' ? ({ backdropFilter: 'none', WebkitBackdropFilter: 'none' } as any) : null,
                          ]}
                          onPress={() => navigation.navigate(card.screen)}
                          hoverStyle={{ backgroundColor: 'transparent' }}
                        >
                          <View style={styles.uniformCardHeader}>
                            <View style={{ flex: 1 }} />
                            {typeof card.count === 'number' && (
                              <Text style={[styles.uniformCardCount, { color: '#fff' }]}>{card.count}</Text>
                            )}
                            {typeof card.badge === 'number' && card.badge > 0 && (
                              <View style={[styles.redBadge, { backgroundColor: colors.error }]}>
                                <Text style={styles.redBadgeText}>{card.badge}</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.uniformCardFooter, isHovered && { backgroundColor: 'transparent' }]}>
                            <Text style={styles.uniformCardTitle}>{card.title}</Text>
                            <Text style={styles.uniformCardSubtitle}>{card.subtitle}</Text>
                          </View>
                        </DashboardCard>
                        );
                      })}
                    </View>
                  );
                })}
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
    backgroundColor: '#f5f5f5',
  },
  containerMobile: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
  },

  // Sidebar Overlay
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    flexDirection: 'row',
  },
  sidebarMobile: {
    width: 280,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  mainContentMobile: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Mobile Greeting Banner
  mobileGreetingBanner: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mobileGreetingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
  },

  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingBottom: 4,
  },
  headerTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  headerDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMobile: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  greeting: {
    fontFamily: 'Josefin Sans',
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#fff',
  },
  greetingMobile: {
    fontSize: 18,
  },
  subGreeting: {
    fontFamily: 'Josefin Sans',
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
  },
  subGreetingMobile: {
    fontSize: 11,
  },
  profileButton: {
    // @ts-ignore
    cursor: 'pointer',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileAvatarMobile: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  profileAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Dashboard Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  scrollContentUniform: {
    padding: 24,
  },
  uniformGrid: {
    gap: 16,
  },
  uniformGridRow: {
    flexDirection: 'row',
    gap: 16,
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
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uniformCardIconText: { fontSize: 18 },
  uniformCardCount: {
    fontFamily: 'Josefin Sans',
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 2,
    color: '#fff',
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
  scrollContentMobile: {
    padding: 16,
  },

  // Mobile Cards
  mobileCardsContainer: {
    // gap not supported in older mobile browsers
  },
  mobileCard: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any : {}),
  },
  mobileCardDark: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  mobileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mobileCardIconDark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mobileCardIconText: {
    fontSize: 20,
  },
  mobileCardText: {
    flex: 1,
  },
  mobileCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileCardTitleDark: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  mobileCardSubtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  mobileCardSubtitleDark: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  mobileCardCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  mobileCardCountDark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  gridContainer: {
    maxWidth: 1000,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  rowMobile: {
    flexDirection: 'column',
  },

  // Card base styles mit 3D-Lift-Effekt (asymmetrische Borders + starker Shadow + Web-Inset-Highlight)
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
    // @ts-ignore — Web-only: kombinierter Drop-Shadow + Inset-Highlight oben/unten
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 22px 44px rgba(0,0,0,0.6), 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
    } : {}),
  },
  cardHovered: {
    // @ts-ignore
    transform: [{ scale: 1.02 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  lightCardHovered: {
    backgroundColor: '#f0f0f0',
    // @ts-ignore
    transform: [{ scale: 1.01 }],
  },
  darkCardHovered: {
    backgroundColor: '#2a2a2a',
    // @ts-ignore
    transform: [{ scale: 1.02 }],
  },
  mainCardHovered: {
    backgroundColor: '#fafafa',
    // @ts-ignore
    transform: [{ scale: 1.005 }],
  },

  // Main KMH Spieler Card
  mainCard: {
    flex: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 28,
    minHeight: 300,
    borderWidth: 1,
    borderColor: '#eee',
    position: 'relative',
    marginRight: 16,
  },
  mainCardBackgroundEmoji: {
    position: 'absolute',
    right: 20,
    bottom: -30,
    fontSize: 150,
    opacity: 0.08,
  },
  mainCardContent: {
    flex: 1,
    flexDirection: 'row',
  },
  mainCardLeft: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mainCardRight: {
    width: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCountTopRight: {
    position: 'absolute',
    top: 20,
    right: 24,
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
  },
  coreBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  coreBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
  },
  mainCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  mainCardSubtitle: {
    fontSize: 11,
    color: '#888',
    lineHeight: 16,
  },
  mainCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
  },
  mainCardLink: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mainCardArrow: {
    fontSize: 16,
    marginLeft: 8,
    color: '#1a1a1a',
  },
  silhouetteContainer: {
    alignItems: 'center',
  },
  silhouetteHead: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ccc',
    marginBottom: -8,
  },
  silhouetteBody: {
    width: 100,
    height: 70,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    backgroundColor: '#ccc',
  },

  // Right Column
  rightColumn: {
    flex: 1,
  },

  // Left Column (KMH + Transfers oben, Scouting unten)
  leftColumn: {
    flex: 1,
    marginRight: 16,
  },

  // Top Row innerhalb linker Spalte
  topRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  topRowMobile: {
    flexDirection: 'column',
  },

  // Middle Column (Transfers + Scouting)
  middleColumn: {
    flex: 1,
  },

  // Scouting Card
  scoutingCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
  },
  scoutingCardWide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
    minHeight: 120,
  },
  // Scouting Card - Tall (Säule) - Light
  scoutingCardTallLight: {
    width: 130,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'flex-start',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#eee',
  },
  scoutingTallCountLight: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scoutingVerticalTextLight: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 24,
    letterSpacing: 4,
  },
  scoutingTallSubtitleLight: {
    fontSize: 11,
    fontWeight: '500',
    color: '#888',
    lineHeight: 15,
  },

  // Scouting Card - Tall (Säule) - Dark (deprecated)
  scoutingCardTall: {
    width: 130,
    backgroundColor: '#1a1a1a',
    padding: 16,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  scoutingCardTallMobile: {
    width: '100%',
    minHeight: 120,
  },
  scoutingTallCount: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scoutingVerticalTextContainer: {
    alignSelf: 'flex-start',
  },
  scoutingVerticalText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 24,
    letterSpacing: 4,
  },
  scoutingTallFooter: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  scoutingTallSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 15,
  },
  scoutingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  searchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconText: {
    fontSize: 18,
  },
  scoutingCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scoutingFooter: {
    marginTop: 'auto',
  },
  scoutingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scoutingSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },

  // Football Network Card - Wide (unter KMH + Transfers) - Light
  networkCardWide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 75,
  },
  networkWideTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  networkWideIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  networkWideIconText: {
    fontSize: 18,
  },
  networkWideTitleContainer: {
    justifyContent: 'flex-start',
  },
  networkWideCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  networkWideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  networkWideSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },

  // Football Network Card - Dark Säule (alte Version, kann weg)
  networkCard: {
    width: 130,
    backgroundColor: '#1a1a1a',
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
  },
  networkCount: {
    position: 'absolute',
    top: 20,
    right: 20,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  networkVerticalTextContainer: {
    alignSelf: 'flex-start',
  },
  networkVerticalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 15,
    letterSpacing: 2,
  },
  networkFooter: {
    marginTop: 'auto',
  },
  networkSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  networkIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkIconText: {
    fontSize: 18,
  },
  networkTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Dark Bottom Cards (Aufgaben, Spieltage, Admin)
  darkBottomCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    justifyContent: 'center',
    minHeight: 70,
  },
  darkBottomCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  darkBottomCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  darkBottomCardIconText: {
    fontSize: 16,
  },
  darkBottomCardText: {
    flex: 1,
  },
  darkBottomCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  darkBottomCardSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  darkBottomCardBadge: {
    backgroundColor: '#ff6b6b',
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  darkBottomCardBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Light Bottom Cards (Aufgaben, Spieltage, Admin)
  lightBottomCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'center',
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#eee',
  },
  lightBottomCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lightBottomCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lightBottomCardIconText: {
    fontSize: 16,
  },
  lightBottomCardText: {
    flex: 1,
  },
  lightBottomCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  lightBottomCardSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  lightBottomCardBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  lightBottomCardBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Red Badge styles (for Spieltage & Aufgaben)
  redBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  redBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  mobileCardBadgeRed: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  mobileCardBadgeRedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Admin Card - Light, full width
  adminCardLight: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'center',
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#eee',
  },

  // Admin Card - Dark, full width (deprecated)
  adminCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    justifyContent: 'center',
    minHeight: 70,
  },
  adminRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  // Termine Card - Dark
  termineCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
    position: 'relative',
    justifyContent: 'space-between',
  },
  urgentBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  urgentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  termineIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termineIconText: {
    fontSize: 18,
  },
  termineFooter: {
    marginTop: 'auto',
  },
  termineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  termineSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  // Transfer Card
  transferCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transferIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferIconText: {
    fontSize: 18,
  },
  transferCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  transferFooter: {
    marginTop: 'auto',
  },
  transferTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  transferSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },

  // Bottom Cards
  bottomCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  bottomCardPlaceholder: {
    flex: 1,
  },
  bottomCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bottomCardIconText: {
    fontSize: 18,
  },
  bottomCardText: {
    flex: 1,
  },
  bottomCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  bottomCardSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
