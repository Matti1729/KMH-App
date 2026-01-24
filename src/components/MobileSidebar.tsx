import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { Sidebar } from './Sidebar';
import { useTheme } from '../contexts/ThemeContext';

interface MobileSidebarProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  activeScreen: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    role?: string;
  } | null;
}

const SIDEBAR_WIDTH = 280;

export function MobileSidebar({ visible, onClose, navigation, activeScreen, profile }: MobileSidebarProps) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (visible) {
      // Show component first, then animate in
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out, then hide component
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  if (!shouldRender) return null;

  // Handler für Backdrop-Klick - schließt nicht wenn Feedback-Modal offen
  const handleBackdropPress = () => {
    if (!feedbackModalOpen) {
      onClose();
    }
  };

  return (
    <View style={styles.container} pointerEvents="auto">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }], backgroundColor: colors.surface }]}>
        <Sidebar
          navigation={navigation}
          activeScreen={activeScreen}
          profile={profile}
          onNavigate={onClose}
          embedded
          onFeedbackModalChange={setFeedbackModalOpen}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropPressable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
});
