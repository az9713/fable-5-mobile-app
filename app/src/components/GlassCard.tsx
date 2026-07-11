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
  /** Override the glass border color, e.g. theme.glass.borderStrong for extra definition. */
  borderColor?: string;
};

export function GlassCard({
  children,
  style,
  radius = theme.radius.lg,
  intensity = theme.glass.blurIntensity,
  pressed = false,
  blur = true,
  borderColor = theme.glass.border,
}: GlassCardProps) {
  const fillStyle: ViewStyle = {
    backgroundColor: pressed ? theme.glass.fillPressed : theme.glass.fill,
    borderWidth: 1,
    borderColor,
    borderRadius: radius,
  };

  const content = (
    <>
      <View style={[StyleSheet.absoluteFill, fillStyle]} />
      <Sheen />
      <TopEdgeHighlight />
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
      colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.10)', 'transparent']}
      locations={[0, 0.25, 0.6]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.sheen}
      pointerEvents="none"
    />
  );
}

/** Crisp 1px bright rim along the top inner edge — reads as a glass edge catching light. */
function TopEdgeHighlight() {
  return <View pointerEvents="none" style={styles.topEdgeHighlight} />;
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
    height: '55%',
  },
  topEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

export default GlassCard;
