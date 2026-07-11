import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Background } from '@/components/Background';
import { GlassCard } from '@/components/GlassCard';
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
  const loadFolders = useStore((s) => s.loadFolders);
  const loadNotes = useStore((s) => s.loadNotes);
  const moveNoteToFolder = useStore((s) => s.moveNoteToFolder);

  const [moveTarget, setMoveTarget] = useState<Note | null>(null);

  const folderId = id === 'inbox' ? null : (id ?? null);
  const name =
    id === 'inbox' ? 'Inbox' : (folders.find((f) => f.id === id)?.name ?? 'Folder');

  useFocusEffect(
    useCallback(() => {
      loadFolders();
      loadNotes(folderId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folderId])
  );

  const openMoveSheet = (note: Note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMoveTarget(note);
  };

  const closeMoveSheet = () => setMoveTarget(null);

  const handleMove = (destinationId: string | null) => {
    if (!moveTarget) return;
    moveNoteToFolder(moveTarget.id, destinationId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMoveTarget(null);
  };

  // Every possible destination (Inbox + folders) minus wherever the note
  // already lives — moving a note to its current folder is a no-op.
  const allDestinations: { id: string | null; label: string }[] = [
    { id: null, label: 'Inbox' },
    ...folders.map((f) => ({ id: f.id, label: f.name })),
  ];
  const destinations = allDestinations.filter((d) => d.id !== folderId);

  const renderItem = ({ item }: { item: Note }) => (
    <NoteRow
      note={item}
      snippet={noteSnippets[item.id]}
      onPress={() => router.push(`/note/${item.id}`)}
      onLongPress={() => openMoveSheet(item)}
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
              <Ionicons
                name="file-tray-outline"
                size={32}
                color={theme.color.textFaint}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyText}>No notes yet</Text>
            </View>
          }
        />
      </SafeAreaView>

      <Modal
        visible={moveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMoveSheet}
      >
        <View style={styles.modalScrim}>
          <GlassCard radius={theme.radius.lg} style={styles.modalCard}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Move to…</Text>

              {destinations.length === 0 ? (
                <Text style={styles.emptyText}>No other folders yet</Text>
              ) : (
                <View style={styles.moveList}>
                  {destinations.map((dest) => (
                    <Pressable
                      key={dest.id ?? 'inbox'}
                      onPress={() => handleMove(dest.id)}
                      style={styles.moveRow}
                      accessibilityRole="button"
                    >
                      <Text style={styles.moveRowText}>{dest.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable onPress={closeMoveSheet} style={styles.modalButton}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </View>
      </Modal>
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
  emptyIcon: {
    marginBottom: theme.space.sm,
  },
  emptyText: {
    fontSize: theme.font.body,
    color: theme.color.textFaint,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxxl,
  },
  modalCard: {
    width: '100%',
  },
  modalContent: {
    padding: theme.space.xl,
    gap: theme.space.lg,
  },
  modalTitle: {
    fontSize: theme.font.heading,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  moveList: {
    gap: theme.space.xs,
  },
  moveRow: {
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.glass.border,
  },
  moveRowText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.space.lg,
  },
  modalButton: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
  },
  modalButtonText: {
    fontSize: theme.font.body,
    color: theme.color.textSecondary,
  },
});
