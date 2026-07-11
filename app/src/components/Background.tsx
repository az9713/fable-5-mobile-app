import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BACKGROUNDS } from '@/theme/backgrounds';

export type BackgroundProps = {
  backgroundId?: string;
  children?: React.ReactNode;
};

const AURORA_COLORS = ['#2E1A47', '#3A6FB0', '#3FA9A0', '#F2B679'] as const;

// Vertical scrim: near-transparent at top (keeps the art vivid) to a legible
// dark base at the bottom (keeps text readable), instead of a flat wash.
const SCRIM_COLORS = ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.24)'] as const;

export function Background({ backgroundId, children }: BackgroundProps) {
  const entry =
    BACKGROUNDS.find((b) => b.id === backgroundId) ?? BACKGROUNDS[0];

  if (entry.source) {
    return (
      <ImageBackground
        source={entry.source}
        resizeMode="cover"
        style={styles.fill}
      >
        <LinearGradient
          colors={SCRIM_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={AURORA_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={SCRIM_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

export default Background;
