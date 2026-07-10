import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '@/theme/theme';

export type GlassCardProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  intensity?: number;
  pressed?: boolean;
  blur?: boolean;
};

export function GlassCard({
  children,
  style,
  radius = theme.radius.lg,
  intensity = theme.glass.blurIntensity,
  pressed = false,
  blur = true,
}: GlassCardProps) {
  const fillStyle: ViewStyle = {
    backgroundColor: pressed ? theme.glass.fillPressed : theme.glass.fill,
    borderWidth: 1,
    borderColor: theme.glass.border,
    borderRadius: radius,
  };

  const content = (
    <>
      <View style={[StyleSheet.absoluteFill, fillStyle]} />
      <Sheen />
      {children}
    </>
  );

  return (
    <View style={[styles.shadowWrap, { borderRadius: radius }, style]}>
      {blur ? (
        <BlurView
          tint={theme.glass.blurTint}
          intensity={intensity}
          style={[styles.clip, { borderRadius: radius }]}
        >
          {content}
        </BlurView>
      ) : (
        <View style={[styles.clip, { borderRadius: radius }]}>{content}</View>
      )}
    </View>
  );
}

function Sheen() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.25)', 'transparent']}
      style={styles.sheen}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...theme.shadow,
  },
  clip: {
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '33%',
  },
});

export default GlassCard;
