import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Pressable } from 'react-native';
import { supabase } from '../../config/supabase';

interface AdvisorProfile {
  first_name: string;
  last_name: string;
  photo_url: string;
  role: string;
}

export function AdvisorHomeScreen({ navigation }: any) {
  const [profile, setProfile] = useState<AdvisorProfile | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [scoutingCount, setScoutingCount] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [transferCount, setTransferCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [todayGamesCount, setTodayGamesCount] = useState(0);
  const [tasksAndRemindersCount, setTasksAndRemindersCount] = useState(0);
  const [networkContactsCount, setNetworkContactsCount] = useState(0);

  useEffect(() => {
    fetchProfile();
    fetchPlayerCount();
    fetchScoutingCount();
    fetchTransferCount();
    fetchPendingRequestsCount();
    fetchTodayGamesCount();
    fetchTasksAndRemindersCount();
    fetchNetworkContactsCount();
  }, []);

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
    const { data: termineData } = await supabase
      .from('termine')
      .select('*');
    
    if (termineData) {
      const todayTermineCount = termineData.filter(t => {
        const terminStart = new Date(t.datum);
        const terminEnde = t.datum_ende ? new Date(t.datum_ende) : terminStart;
        const terminStartDay = new Date(terminStart.getFullYear(), terminStart.getMonth(), terminStart.getDate());
        const terminEndeDay = new Date(terminEnde.getFullYear(), terminEnde.getMonth(), terminEnde.getDate());
        
        return terminStartDay <= today && today <= terminEndeDay;
      }).length;
      
      totalCount += todayTermineCount;
    }
    
    setTodayGamesCount(totalCount);
  };

  const fetchTasksAndRemindersCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    let totalCount = 0;
    
    // Offene Aufgaben zählen
    const { count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false);
    
    totalCount += tasksCount || 0;
    
    // Offene Erinnerungen zählen
    const { count: remindersCount } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false);
    
    totalCount += remindersCount || 0;
    
    setTasksAndRemindersCount(totalCount);
  };

  const fetchNetworkContactsCount = async () => {
    const { count } = await supabase
      .from('football_network_contacts')
      .select('*', { count: 'exact', head: true });
    
    setNetworkContactsCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
        hoveredCard === id && (hoverStyle || styles.cardHovered)
      ]}
    >
      {children}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        {/* Logo - Im Dashboard nicht klickbar da wir schon hier sind */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>KMH</Text>
          </View>
          <Text style={styles.logoTitle}>Sports Agency</Text>
        </View>

        {/* Navigation */}
        <View style={styles.navContainer}>
          {navItems.map((item) => (
            <Pressable
              key={item.id}
              onHoverIn={() => setHoveredNav(item.id)}
              onHoverOut={() => setHoveredNav(null)}
              onPress={() => {
                if (item.screen) navigation.navigate(item.screen);
              }}
              style={[
                styles.navItem,
                hoveredNav === item.id && styles.navItemHovered
              ]}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={styles.navLabel}>{item.label}</Text>
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
              hoveredNav === 'admin' && styles.navItemHovered
            ]}
          >
            <Text style={styles.navIcon}>⚙️</Text>
            <Text style={styles.navLabel}>Administration</Text>
          </Pressable>
        )}

        {/* Logout */}
        <Pressable
          onHoverIn={() => setHoveredNav('logout')}
          onHoverOut={() => setHoveredNav(null)}
          onPress={handleLogout}
          style={[
            styles.logoutButton,
            hoveredNav === 'logout' && styles.logoutButtonHovered
          ]}
        >
          <Text style={styles.logoutIcon}>↪</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hallo {profile?.first_name || 'User'}
            </Text>
            <Text style={styles.subGreeting}>Willkommen im Karl M. Herzog Sportmanagement!</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate('MyProfile')}
            style={styles.profileButton}
          >
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Text style={styles.profileAvatarText}>
                  {profile?.first_name?.[0] || ''}{profile?.last_name?.[0] || ''}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Dashboard Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gridContainer}>
            
            {/* Row 1 - KMH-Spieler + Transfers + Football Network links, Scouting rechts als Säule */}
            <View style={styles.row}>
              {/* Linke Spalte - KMH-Spieler, Transfers, Football Network */}
              <View style={styles.leftColumn}>
                {/* Obere Zeile - KMH-Spieler + Transfers */}
                <View style={styles.topRow}>
                  {/* KMH-Spieler - Large Card */}
                  <DashboardCard 
                    id="players"
                    style={styles.mainCard}
                    onPress={() => navigation.navigate('PlayerOverview')}
                    hoverStyle={styles.mainCardHovered}
                  >
                    <Text style={styles.playerCountTopRight}>{playerCount}</Text>
                    <Text style={styles.mainCardBackgroundEmoji}>👤</Text>
                    <View style={styles.mainCardContent}>
                      <View style={styles.mainCardLeft}>
                        <Text style={styles.mainCardTitle}>KMH-Spieler</Text>
                        <Text style={styles.mainCardSubtitle}>
                          Verwaltung aller Daten unserer{'\n'}
                          aktiven Spieler und Trainer.
                        </Text>
                        <View style={styles.mainCardFooter}>
                          <Text style={styles.mainCardLink}>Zur Übersicht</Text>
                          <Text style={styles.mainCardArrow}>→</Text>
                        </View>
                      </View>
                    </View>
                  </DashboardCard>

                  {/* Transfers Card */}
                  <DashboardCard 
                    id="transfers"
                    style={styles.transferCard}
                    onPress={() => navigation.navigate('Transfers')}
                    hoverStyle={styles.lightCardHovered}
                  >
                    <View style={styles.transferHeader}>
                      <View style={styles.transferIcon}>
                        <Text style={styles.transferIconText}>🔄</Text>
                      </View>
                      <Text style={styles.transferCount}>{transferCount}</Text>
                    </View>
                    <View style={styles.transferFooter}>
                      <Text style={styles.transferTitle}>Transfers</Text>
                      <Text style={styles.transferSubtitle}>Auslaufende Verträge & mögliche Wechsel</Text>
                    </View>
                  </DashboardCard>
                </View>

                {/* Football Network Card - volle Breite unter KMH + Transfers (weiß) */}
                <DashboardCard 
                  id="network"
                  style={styles.networkCardWide}
                  onPress={() => navigation.navigate('FootballNetwork')}
                  hoverStyle={styles.lightCardHovered}
                >
                  <View style={styles.networkWideTop}>
                    <View style={styles.networkWideIcon}>
                      <Text style={styles.networkWideIconText}>💼</Text>
                    </View>
                    <View style={styles.networkWideTitleContainer}>
                      <Text style={styles.networkWideTitle}>Football Network</Text>
                      <Text style={styles.networkWideSubtitle}>Kontakte zu Vereinen und Entscheidern</Text>
                    </View>
                  </View>
                  <Text style={styles.networkWideCount}>{networkContactsCount}</Text>
                </DashboardCard>
              </View>

              {/* Scouting - Säule (Dark) - volle Höhe */}
              <DashboardCard 
                id="scouting"
                style={styles.scoutingCardTall}
                onPress={() => navigation.navigate('Scouting')}
                hoverStyle={styles.darkCardHovered}
              >
                <Text style={styles.scoutingTallCount}>{scoutingCount}</Text>
                <View style={styles.scoutingVerticalTextContainer}>
                  <Text style={styles.scoutingVerticalText}>S{'\n'}C{'\n'}O{'\n'}U{'\n'}T{'\n'}I{'\n'}N{'\n'}G</Text>
                </View>
                <View style={styles.scoutingTallFooter}>
                  <Text style={styles.scoutingTallSubtitle}>Talente{'\n'}im Blick</Text>
                </View>
              </DashboardCard>
            </View>

            {/* Row 2 - Aufgaben & Spieltage */}
            <View style={styles.row}>
              {/* Aufgaben - Dark */}
              <DashboardCard 
                id="aufgaben"
                style={styles.darkBottomCard}
                onPress={() => navigation.navigate('Tasks')}
                hoverStyle={styles.darkCardHovered}
              >
                <View style={styles.darkBottomCardContent}>
                  <View style={styles.darkBottomCardIcon}>
                    <Text style={styles.darkBottomCardIconText}>✓</Text>
                  </View>
                  <View style={styles.darkBottomCardText}>
                    <Text style={styles.darkBottomCardTitle}>Aufgaben & Erinnerungen</Text>
                    <Text style={styles.darkBottomCardSubtitle}>Deine To-Dos & Erinnerungen</Text>
                  </View>
                  <View style={styles.darkBottomCardBadge}>
                    <Text style={styles.darkBottomCardBadgeText}>{tasksAndRemindersCount}</Text>
                  </View>
                </View>
              </DashboardCard>

              {/* Spieltage - Dark */}
              <DashboardCard 
                id="termine"
                style={styles.darkBottomCard}
                onPress={() => navigation.navigate('Calendar')}
                hoverStyle={styles.darkCardHovered}
              >
                <View style={styles.darkBottomCardContent}>
                  <View style={styles.darkBottomCardIcon}>
                    <Text style={styles.darkBottomCardIconText}>📅</Text>
                  </View>
                  <View style={styles.darkBottomCardText}>
                    <Text style={styles.darkBottomCardTitle}>Spieltage</Text>
                    <Text style={styles.darkBottomCardSubtitle}>Lehrgänge, Spiele & Turniere</Text>
                  </View>
                  <View style={styles.darkBottomCardBadge}>
                    <Text style={styles.darkBottomCardBadgeText}>{todayGamesCount}</Text>
                  </View>
                </View>
              </DashboardCard>
            </View>

            {/* Row 3 - Admin (only if admin) */}
            {profile?.role === 'admin' && (
              <View style={styles.adminRow}>
                <DashboardCard 
                  id="admin"
                  style={styles.adminCard}
                  onPress={() => navigation.navigate('AdminPanel')}
                  hoverStyle={styles.darkCardHovered}
                >
                  <View style={styles.darkBottomCardContent}>
                    <View style={styles.darkBottomCardIcon}>
                      <Text style={styles.darkBottomCardIconText}>⚙️</Text>
                    </View>
                    <View style={styles.darkBottomCardText}>
                      <Text style={styles.darkBottomCardTitle}>Administration</Text>
                      <Text style={styles.darkBottomCardSubtitle}>Benutzer & Rechte verwalten</Text>
                    </View>
                    {pendingRequestsCount > 0 && (
                      <View style={styles.darkBottomCardBadge}>
                        <Text style={styles.darkBottomCardBadgeText}>{pendingRequestsCount}</Text>
                      </View>
                    )}
                  </View>
                </DashboardCard>
              </View>
            )}

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
    backgroundColor: '#f5f5f5',
  },

  // Sidebar
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
    backgroundColor: '#f0f0f0',
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

  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subGreeting: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
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
    fontSize: 16,
    fontWeight: '600',
  },

  // Dashboard Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  gridContainer: {
    maxWidth: 1000,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },

  // Card base styles
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.2s ease',
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
    backgroundColor: '#fff',
    padding: 28,
    minHeight: 300,
    borderWidth: 1,
    borderColor: '#eee',
    position: 'relative',
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
    fontSize: 48,
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
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  mainCardSubtitle: {
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
  },
  mainCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
  },
  mainCardLink: {
    fontSize: 14,
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
    gap: 16,
  },

  // Left Column (KMH + Transfers oben, Scouting unten)
  leftColumn: {
    flex: 1,
    gap: 16,
  },

  // Top Row innerhalb linker Spalte
  topRow: {
    flexDirection: 'row',
    gap: 16,
  },

  // Middle Column (Transfers + Scouting)
  middleColumn: {
    flex: 1,
    gap: 16,
  },

  // Scouting Card
  scoutingCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
  },
  scoutingCardWide: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
    minHeight: 120,
  },
  // Scouting Card - Tall (Säule) - Dark
  scoutingCardTall: {
    width: 130,
    backgroundColor: '#1a1a1a',
    padding: 16,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  scoutingTallCount: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  scoutingVerticalTextContainer: {
    alignSelf: 'flex-start',
  },
  scoutingVerticalText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 34,
    letterSpacing: 4,
  },
  scoutingTallFooter: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  scoutingTallSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 17,
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
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scoutingFooter: {
    marginTop: 'auto',
  },
  scoutingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scoutingSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },

  // Football Network Card - Wide (unter KMH + Transfers) - Light
  networkCardWide: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  networkWideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  networkWideSubtitle: {
    fontSize: 12,
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
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  networkVerticalTextContainer: {
    alignSelf: 'flex-start',
  },
  networkVerticalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
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
  networkFooter: {
    marginTop: 'auto',
  },
  networkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  networkSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
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
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: '700',
  },

  // Admin Card - Dark, full width
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
    fontSize: 12,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  termineSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  // Transfer Card
  transferCard: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  transferFooter: {
    marginTop: 'auto',
  },
  transferTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  transferSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },

  // Bottom Cards
  bottomCard: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  bottomCardSubtitle: {
    fontSize: 12,
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
    fontSize: 13,
    fontWeight: '700',
  },
});
