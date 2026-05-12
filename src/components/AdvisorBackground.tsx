import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const BG_IMAGE = require('../../assets/advisor-bg.jpg');

export function AdvisorBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Image source={BG_IMAGE} style={styles.image} resizeMode="cover" />
      <View style={styles.overlay} />
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
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
