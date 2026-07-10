import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/components/GlassCard';
import { theme } from '@/theme/theme';

export type FolderTileProps = {
  label: string;
  /** Note count badge. Omit for the dashed "New folder" tile. */
  count?: number;
  icon?: string;
  /** Renders a dashed outline instead of the count badge — the "+ New folder" tile. */
  dashed?: boolean;
  onPress: () => void;
};

const TILE_HEIGHT = 132;

export function FolderTile({ label, count, icon = '📁', dashed = false, onPress }: FolderTileProps) {
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <GlassCard radius={theme.radius.lg} pressed={pressed} style={styles.card}>
        <View style={[styles.content, { height: TILE_HEIGHT }]}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {count !== undefined && <Text style={styles.count}>{count}</Text>}
        </View>
        {dashed && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dashedOverlay]} />
        )}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: TILE_HEIGHT,
  },
  content: {
    padding: theme.space.lg,
    justifyContent: 'space-between',
  },
  icon: {
    fontSize: theme.font.title,
  },
  label: {
    fontSize: theme.font.body,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  count: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
  },
  dashedOverlay: {
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.color.textSecondary,
  },
});

export default FolderTile;
