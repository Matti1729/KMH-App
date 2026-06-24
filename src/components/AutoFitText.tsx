import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent, StyleProp, TextStyle, ViewStyle } from 'react-native';

type Props = {
  /** Eine oder mehrere Zeilen (z.B. Vor-/Nachname). Alle nutzen die gleiche, an die
   *  längste Zeile angepasste Schriftgröße. */
  lines: string[];
  /** Maximale Schriftgröße (Design-Wert). Wird nur unterschritten, wenn nötig. */
  maxFontSize: number;
  minFontSize?: number;
  /** letterSpacing des Texts — fließt in die Breitenberechnung ein. */
  letterSpacing?: number;
  /** Glyphen-Breite als Anteil der Schriftgröße (Uppercase Josefin ≈ 0.58; 0.62 = sicher kleiner). */
  charRatio?: number;
  lineHeightRatio?: number;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Skaliert Text so, dass er in die verfügbare Breite passt und NIE abgeschnitten wird.
 * RN-Web unterstützt adjustsFontSizeToFit nicht zuverlässig — daher messen wir die
 * (per flex:1 stabile) Containerbreite und berechnen die Schriftgröße selbst.
 */
export function AutoFitText({
  lines,
  maxFontSize,
  minFontSize = 11,
  letterSpacing = 0,
  charRatio = 0.62,
  lineHeightRatio = 1.28,
  textStyle,
  containerStyle,
}: Props) {
  const [width, setWidth] = useState(0);
  const visible = lines.filter(Boolean);
  const longest = Math.max(1, ...visible.map((l) => l.length));
  const fontSize = width > 0
    ? Math.max(minFontSize, Math.min(maxFontSize, Math.floor((width / longest - letterSpacing) / charRatio)))
    : maxFontSize;
  const lineHeight = Math.round(fontSize * lineHeightRatio);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next && next !== width) setWidth(next);
  };

  return (
    <View style={[{ flex: 1, minWidth: 0 }, containerStyle]} onLayout={onLayout}>
      {visible.map((l, i) => (
        <Text key={i} numberOfLines={1} style={[textStyle, { fontSize, lineHeight }]}>{l}</Text>
      ))}
    </View>
  );
}
