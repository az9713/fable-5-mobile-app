import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Background } from '@/components/Background';
import { NoteRow } from '@/components/NoteRow';
import type { Note } from '@/db/repo';
import { useStore } from '@/store/useStore';
import { theme } from '@/theme/theme';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const folders = useStore((s) => s.folders);
  const notes = useStore((s) => s.notes);
  const noteSnippets = useStore((s) => s.noteSnippets);
  const selectedBackgroundId = useStore((s) => s.selectedBackgroundId);
  const loadNotes = useStore((s) => s.loadNotes);

  const folderId = id === 'inbox' ? null : (id ?? null);
  const name =
    id === 'inbox' ? 'Inbox' : (folders.find((f) => f.id === id)?.name ?? 'Folder');

  useFocusEffect(
    useCallback(() => {
      loadNotes(folderId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folderId])
  );

  const renderItem = ({ item }: { item: Note }) => (
    <NoteRow
      note={item}
      snippet={noteSnippets[item.id]}
      onPress={() => router.push(`/note/${item.id}`)}
    />
  );

  return (
    <Background backgroundId={selectedBackgroundId}>
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>{name}</Text>

        <FlatList
          data={notes}
          keyExtractor={(note) => note.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notes yet</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.md,
    gap: theme.space.lg,
  },
  back: {
    fontSize: theme.font.body,
    color: theme.color.textSecondary,
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: theme.space.xxxl,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.space.xxxl,
  },
  emptyText: {
    fontSize: theme.font.body,
    color: theme.color.textFaint,
  },
});
