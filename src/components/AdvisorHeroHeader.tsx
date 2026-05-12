import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Image, ImageSourcePropType } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  secondRow?: React.ReactNode;
  tableHeader?: React.ReactNode;
  style?: ViewStyle;
  flatBottom?: boolean;
  backgroundImage?: ImageSourcePropType;
  backgroundImageOpacity?: number;
};

export function AdvisorHeroHeader({ title, subtitle, children, secondRow, tableHeader, style, flatBottom, backgroundImage, backgroundImageOpacity = 1 }: Props) {
  const cardStyle: any = [
    styles.heroCard,
    flatBottom ? styles.heroCardFlatBottom : null,
    tableHeader ? styles.heroCardWithTableHeader : null,
    style,
  ];
  return (
    <View style={cardStyle}>
      {backgroundImage && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 12,
            borderBottomLeftRadius: flatBottom ? 0 : 12,
            borderBottomRightRadius: flatBottom ? 0 : 12,
            overflow: 'hidden',
          }}
        >
          <Image
            source={backgroundImage}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: backgroundImageOpacity }}
            resizeMode="cover"
          />
        </View>
      )}
      <View style={styles.heroTopRow}>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.heroScreenLabel}>{title}</Text>
          {subtitle ? <Text style={styles.heroScreenSubLabel}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.heroDivider} />
      {children ? <View style={styles.heroToolbar}>{children}</View> : null}
      {secondRow ? <View style={[styles.heroToolbar, { paddingTop: 0 }]}>{secondRow}</View> : null}
      {tableHeader ? <View style={styles.heroTableHeaderSlot}>{tableHeader}</View> : null}
    </View>
  );
}

export const heroCardAttachedToolbar: ViewStyle = {
  marginHorizontal: 24,
  marginTop: 0,
  marginBottom: 0,
  paddingHorizontal: 28,
  paddingVertical: 14,
  backgroundColor: 'rgba(0,0,0,0.5)',
  borderLeftWidth: 1,
  borderRightWidth: 1,
  borderBottomWidth: 1,
  borderColor: 'rgba(255,255,255,0.15)',
  borderBottomLeftRadius: 12,
  borderBottomRightRadius: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  zIndex: 100,
};

export const HERO_BUTTON_BG = 'rgba(0,0,0,0.7)';
export const HERO_BUTTON_BORDER = 'rgba(255,255,255,0.25)';
export const HERO_BUTTON_HEIGHT = 28;

export const heroButton: ViewStyle = {
  height: HERO_BUTTON_HEIGHT,
  paddingVertical: 0,
  paddingHorizontal: 10,
  borderRadius: 6,
  borderWidth: 1,
  backgroundColor: HERO_BUTTON_BG,
  borderColor: HERO_BUTTON_BORDER,
  justifyContent: 'center',
  alignItems: 'center',
};

export const heroSearch: ViewStyle = {
  height: HERO_BUTTON_HEIGHT,
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 0,
  borderRadius: 6,
  borderWidth: 1,
  backgroundColor: HERO_BUTTON_BG,
  borderColor: HERO_BUTTON_BORDER,
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 0,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 0,
    zIndex: 1000,
  },
  heroCardFlatBottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 60, paddingBottom: 4 },
  heroScreenLabel: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  heroScreenSubLabel: { fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  heroDivider: { height: 1, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, zIndex: 100 },
  heroCardWithTableHeader: { paddingBottom: 0 },
  heroTableHeaderSlot: {
    marginHorizontal: -28,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    zIndex: 50,
  },
});
