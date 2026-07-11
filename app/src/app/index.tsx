import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Background } from '@/components/Background';
import { FolderTile } from '@/components/FolderTile';
import { GlassCard } from '@/components/GlassCard';
import { RecordButton } from '@/components/RecordButton';
import { useStore } from '@/store/useStore';
import { theme } from '@/theme/theme';

export default function HomeScreen() {
  const router = useRouter();

  const folders = useStore((s) => s.folders);
  const folderCounts = useStore((s) => s.folderCounts);
  const inboxCount = useStore((s) => s.inboxCount);
  const selectedBackgroundId = useStore((s) => s.selectedBackgroundId);
  const loadFolders = useStore((s) => s.loadFolders);
  const loadFolderCounts = useStore((s) => s.loadFolderCounts);
  const createFolder = useStore((s) => s.createFolder);

  const [modalVisible, setModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadFolders();
    loadFolderCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewFolderModal = () => {
    setNewFolderName('');
    setModalVisible(true);
  };

  const submitNewFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder(name);
    loadFolderCounts();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVisible(false);
    setNewFolderName('');
  };

  return (
    <Background backgroundId={selectedBackgroundId}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.appTitle}>Ideas</Text>

        <View style={styles.recordSection}>
          <RecordButton />
        </View>

        <View style={styles.grid}>
          <View style={styles.tileWrap}>
            <FolderTile
              label="Inbox"
              icon="file-tray-outline"
              count={inboxCount}
              onPress={() =>
                router.push({ pathname: '/folder/[id]', params: { id: 'inbox' } })
              }
            />
          </View>

          {folders.map((folder) => (
            <View key={folder.id} style={styles.tileWrap}>
              <FolderTile
                label={folder.name}
                count={folderCounts[folder.id] ?? 0}
                onPress={() =>
                  router.push({ pathname: '/folder/[id]', params: { id: folder.id } })
                }
              />
            </View>
          ))}

          <View style={styles.tileWrap}>
            <FolderTile label="New folder" icon="add" dashed onPress={openNewFolderModal} />
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalScrim}>
          <GlassCard radius={theme.radius.lg} style={styles.modalCard}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New folder</Text>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Folder name"
                placeholderTextColor={theme.color.textFaint}
                style={styles.input}
                autoFocus
                onSubmitEditing={submitNewFolder}
                returnKeyType="done"
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setModalVisible(false)} style={styles.modalButton}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={submitNewFolder} style={styles.modalButton}>
                  <Text style={[styles.modalButtonText, styles.modalButtonPrimary]}>Create</Text>
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
  },
  appTitle: {
    textAlign: 'center',
    marginTop: theme.space.md,
    fontSize: theme.font.body,
    color: theme.color.textSecondary,
    letterSpacing: 1,
  },
  recordSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.space.xxxl,
    paddingBottom: theme.space.xxxl + theme.space.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileWrap: {
    width: '47%',
    marginBottom: theme.space.lg,
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
  input: {
    borderWidth: 1,
    borderColor: theme.glass.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
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
  modalButtonPrimary: {
    color: theme.color.record,
    fontWeight: theme.font.weightSemi,
  },
});
