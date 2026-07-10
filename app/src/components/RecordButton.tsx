import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlassCard } from '@/components/GlassCard';
import { theme } from '@/theme/theme';

export type RecordButtonProps = {
  /** Diameter of the button, in px. */
  size?: number;
  /** Called after the local recording state toggles, with the new state. */
  onToggle?: (recording: boolean) => void;
};

const DEFAULT_SIZE = 120;

export function RecordButton({ size = DEFAULT_SIZE, onToggle }: RecordButtonProps) {
  // Phase 4 will replace the local toggle with real expo-audio recording.
  const [recording, setRecording] = useState(false);

  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (recording) {
      scale.value = withRepeat(
        withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      glow.value = withTiming(1, { duration: 300 });
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 250 });
      glow.value = withTiming(0, { duration: 250 });
    }
  }, [recording, scale, glow]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.2 }],
  }));

  const handlePress = () => {
    const next = !recording;
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy
    );
    setRecording(next);
    onToggle?.(next);
  };

  const haloSize = size * 1.5;

  return (
    <View style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
          },
          haloStyle,
        ]}
      />
      <Animated.View style={scaleStyle}>
        <Pressable
          onPress={handlePress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        >
          <GlassCard radius={theme.radius.pill} style={{ width: size, height: size }}>
            <View style={[styles.center, { width: size, height: size }]}>
              <View style={[styles.dot, recording && styles.dotRecording]} />
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    backgroundColor: theme.color.recordGlow,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.record,
  },
  dotRecording: {
    borderRadius: theme.radius.sm,
  },
});

export default RecordButton;
