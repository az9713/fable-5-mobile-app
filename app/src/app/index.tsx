import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';

import { formatParagraphs, transcribe } from '@/ai/whisper';
import { useRecorder } from '@/audio/useRecorder';
import { Background } from '@/components/Background';
import { FolderTile } from '@/components/FolderTile';
import { GlassCard } from '@/components/GlassCard';
import { RecordButton } from '@/components/RecordButton';
import { getKey } from '@/store/secrets';
import { useStore } from '@/store/useStore';
import { theme } from '@/theme/theme';

export default function HomeScreen() {
  const router = useRouter();
  const recorder = useRecorder();

  const folders = useStore((s) => s.folders);
  const folderCounts = useStore((s) => s.folderCounts);
  const inboxCount = useStore((s) => s.inboxCount);
  const selectedBackgroundId = useStore((s) => s.selectedBackgroundId);
  const loadFolders = useStore((s) => s.loadFolders);
  const loadFolderCounts = useStore((s) => s.loadFolderCounts);
  const createFolder = useStore((s) => s.createFolder);
  const captureNote = useStore((s) => s.captureNote);
  const analyzeNote = useStore((s) => s.analyzeNote);

  const [modalVisible, setModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  // useRecorder's own 'processing' phase only covers moving the file to
  // documentDirectory (fast); this covers the full stop -> transcribe ->
  // save flow so the button shows "processing" for its whole duration.
  const [processing, setProcessing] = useState(false);
  const buttonState = recorder.state === 'recording' ? 'recording' : processing ? 'processing' : 'idle';

  useEffect(() => {
    loadFolders();
    loadFolderCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  };

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

  const handleRecordToggle = async (recording: boolean) => {
    if (recording) {
      await recorder.start();
      if (recorder.permissionDenied) {
        Alert.alert(
          'Microphone access needed',
          'Enable microphone access for Ideas in Settings to record.'
        );
      }
      return;
    }

    setProcessing(true);
    try {
      const audioUri = await recorder.stop();
      if (!audioUri) return;

      const key = await getKey('openai');
      if (!key) {
        Alert.alert('Add your OpenAI key', 'Add your OpenAI key in Settings to transcribe notes.');
        // The recording itself is already safely saved on disk — nothing to
        // discard, we just can't transcribe it yet.
        return;
      }

      try {
        const raw = await transcribe(audioUri, key);
        const transcript = formatParagraphs(raw);
        const note = captureNote(transcript, audioUri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Fire-and-forget: the note is already visible in Inbox with its
        // placeholder title. AI title/summary/next-steps fill in a moment
        // later without blocking the recording UI from returning to idle.
        analyzeNote(note.id, transcript).catch(() => {});
      } catch {
        // Never lose the recording: save it with a placeholder transcript so
        // the user can retry later, and let them know something went wrong.
        captureNote('[Transcription failed — audio saved]', audioUri);
        Alert.alert(
          'Transcription failed',
          'We saved your recording. You can find it in Inbox and try again later.'
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Background backgroundId={selectedBackgroundId}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.appTitle}>Ideas</Text>
          <Pressable
            onPress={openSettings}
            hitSlop={12}
            style={styles.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={theme.color.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.recordSection}>
          <RecordButton state={buttonState} onToggle={handleRecordToggle} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space.md,
  },
  headerSpacer: {
    width: 22,
  },
  settingsButton: {
    width: 22,
    alignItems: 'flex-end',
  },
  appTitle: {
    flex: 1,
    textAlign: 'center',
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
