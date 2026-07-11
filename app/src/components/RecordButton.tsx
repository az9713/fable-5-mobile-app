import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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

export type RecordButtonState = 'idle' | 'recording' | 'processing';

export type RecordButtonProps = {
  /** Diameter of the button, in px. */
  size?: number;
  /** Called after the local recording state toggles, with the new state. */
  onToggle?: (recording: boolean) => void;
  /**
   * Controlled recording state (from a real recorder, e.g. `useRecorder`).
   * When provided, the throb/dot/spinner reflect this instead of internal
   * press state, and RecordButton skips its own haptics (the controller is
   * expected to fire them) to avoid a double buzz.
   */
  state?: RecordButtonState;
};

const DEFAULT_SIZE = 120;

export function RecordButton({ size = DEFAULT_SIZE, onToggle, state }: RecordButtonProps) {
  const controlled = state !== undefined;
  const [internalRecording, setInternalRecording] = useState(false);

  const recording = controlled ? state === 'recording' : internalRecording;
  const processing = controlled && state === 'processing';

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
      glow.value = withTiming(processing ? 0.5 : 0, { duration: 250 });
    }
  }, [recording, processing, scale, glow]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.2 }],
  }));

  const handlePress = () => {
    if (processing) return;
    const next = !recording;
    if (!controlled) {
      Haptics.impactAsync(
        next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy
      );
      setInternalRecording(next);
    }
    onToggle?.(next);
  };

  const haloSize = size * 1.5;
  const accessibilityLabel = processing
    ? 'Processing recording'
    : recording
      ? 'Stop recording'
      : 'Start recording';

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
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <GlassCard
            radius={theme.radius.pill}
            borderColor={theme.glass.borderStrong}
            style={{ width: size, height: size }}
          >
            <View
              pointerEvents="none"
              style={[
                styles.specular,
                {
                  width: size * 0.42,
                  height: size * 0.42,
                  borderRadius: size * 0.42,
                  top: size * 0.08,
                  left: size * 0.1,
                },
              ]}
            />
            <View style={[styles.center, { width: size, height: size }]}>
              {processing ? (
                <ActivityIndicator color={theme.color.textPrimary} />
              ) : (
                <View style={[styles.dot, recording && styles.dotRecording]} />
              )}
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
  specular: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.28)',
    // Squash into a soft, elliptical reflection rather than a hard pill.
    transform: [{ scaleY: 0.7 }],
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
