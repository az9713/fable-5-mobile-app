import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/components/GlassCard';
import type { Note } from '@/db/repo';
import { theme } from '@/theme/theme';

export type NoteRowProps = {
  note: Note;
  /** First segment's transcript text, if loaded — shown as a 1-2 line preview. */
  snippet?: string;
  onPress: () => void;
  /** Long-press affordance, e.g. opening the "Move to…" sheet. */
  onLongPress?: () => void;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A slim, non-blurred row for a note inside a folder/Inbox list. */
export function NoteRow({ note, snippet, onPress, onLongPress }: NoteRowProps) {
  // Prefer the AI-generated summary once it's ready; fall back to the raw
  // transcript snippet while analysis is still pending (or failed).
  const preview = note.summary || snippet;
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
    Haptics.selectionAsync();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={note.title}
    >
      <GlassCard blur={false} pressed={pressed} radius={theme.radius.md} style={styles.card}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {note.title || 'Untitled'}
            </Text>
            <Text style={styles.date}>{formatDate(note.created_at)}</Text>
          </View>
          {!!preview && (
            <Text style={styles.snippet} numberOfLines={2}>
              {preview}
            </Text>
          )}
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.space.md,
  },
  content: {
    padding: theme.space.lg,
    gap: theme.space.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.font.body,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  date: {
    fontSize: theme.font.small,
    color: theme.color.textFaint,
  },
  snippet: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
  },
});

export default NoteRow;
