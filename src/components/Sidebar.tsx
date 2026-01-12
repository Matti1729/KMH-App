import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { supabase } from '../config/supabase';
import { CommonActions } from '@react-navigation/native';

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
});
