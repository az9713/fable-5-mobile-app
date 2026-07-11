import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import type { Note } from '@/db/repo';
import { theme } from '@/theme/theme';

export type NoteRowProps = {
  note: Note;
  /** First segment's transcript text, if loaded — shown as a 1-2 line preview. */
  snippet?: string;
  onPress: () => void;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A slim, non-blurred row for a note inside a folder/Inbox list. */
export function NoteRow({ note, snippet, onPress }: NoteRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={note.title}>
      <GlassCard blur={false} radius={theme.radius.md} style={styles.card}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {note.title || 'Untitled'}
            </Text>
            <Text style={styles.date}>{formatDate(note.created_at)}</Text>
          </View>
          {!!snippet && (
            <Text style={styles.snippet} numberOfLines={2}>
              {snippet}
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
