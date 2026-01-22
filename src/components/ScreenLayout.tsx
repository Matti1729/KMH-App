import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Sidebar } from './Sidebar';

interface ScreenLayoutProps {
  navigation: any;
  activeScreen: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    role?: string;
  } | null;
  children: React.ReactNode;
}

// Breakpoint für Mobile
const MOBILE_BREAKPOINT = 768;

export function ScreenLayout({ navigation, activeScreen, profile, children }: ScreenLayoutProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <Sidebar navigation={navigation} activeScreen={activeScreen} profile={profile} />
      <View style={styles.mainContent}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  containerMobile: {
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
