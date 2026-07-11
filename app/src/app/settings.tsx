import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { AURORA_COLORS, Background } from '@/components/Background';
import { GlassCard } from '@/components/GlassCard';
import { getDb } from '@/db/db';
import * as repo from '@/db/repo';
import type { Segment } from '@/db/repo';
import { buildExport } from '@/export/exportNotes';
import { getKey, setKey } from '@/store/secrets';
import { useStore } from '@/store/useStore';
import { BACKGROUNDS } from '@/theme/backgrounds';
import { theme } from '@/theme/theme';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

/** Pings the OpenAI API with the given key. 200 = key works. Never throws. */
async function testOpenAiKey(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Pings the Anthropic API with the given key via a minimal 1-token message. Never throws. */
async function testAnthropicKey(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const selectedBackgroundId = useStore((s) => s.selectedBackgroundId);
  const setSelectedBackgroundId = useStore((s) => s.setSelectedBackgroundId);

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [savedFlash, setSavedFlash] = useState<{ openai: boolean; anthropic: boolean }>({
    openai: false,
    anthropic: false,
  });
  const [testStatus, setTestStatus] = useState<{ openai: TestStatus; anthropic: TestStatus }>({
    openai: 'idle',
    anthropic: 'idle',
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const [o, a] = await Promise.all([getKey('openai'), getKey('anthropic')]);
      if (o) setOpenaiKey(o);
      if (a) setAnthropicKey(a);
    })();
  }, []);

  const flashSaved = (provider: 'openai' | 'anthropic') => {
    setSavedFlash((prev) => ({ ...prev, [provider]: true }));
    setTimeout(() => setSavedFlash((prev) => ({ ...prev, [provider]: false })), 1500);
  };

  const handleSave = async (provider: 'openai' | 'anthropic', value: string) => {
    await setKey(provider, value.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    flashSaved(provider);
  };

  const handleTestKeys = async () => {
    setTestStatus({ openai: 'testing', anthropic: 'testing' });
    const [openaiOk, anthropicOk] = await Promise.all([
      testOpenAiKey(openaiKey),
      testAnthropicKey(anthropicKey),
    ]);
    setTestStatus({ openai: openaiOk ? 'ok' : 'fail', anthropic: anthropicOk ? 'ok' : 'fail' });
  };

  const handleSelectBackground = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBackgroundId(id);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const db = getDb();
      const folders = repo.listFolders(db);
      const notes = [
        ...repo.listNotes(db, null),
        ...folders.flatMap((f) => repo.listNotes(db, f.id)),
      ];

      if (notes.length === 0) {
        Alert.alert('Nothing to export yet', 'Record a few notes first.');
        return;
      }

      const segmentsByNote: Record<string, Segment[]> = {};
      for (const note of notes) {
        segmentsByNote[note.id] = repo.listSegments(db, note.id);
      }

      const { markdown, json } = buildExport(folders, notes, segmentsByNote);

      const dir = new Directory(Paths.cache, `ideas-export-${Date.now()}`);
      dir.create({ intermediates: true });
      const mdFile = dir.createFile('notes.md', 'text/markdown');
      mdFile.write(markdown);
      const jsonFile = dir.createFile('notes.json', 'application/json');
      jsonFile.write(json);

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'Your device cannot open the share sheet.');
        return;
      }

      // expo-sharing shares one file per call, so offer the human-readable
      // Markdown first, then the structured JSON — both land in the same
      // AirDrop/Files/iCloud destination the user picks each time.
      await Sharing.shareAsync(mdFile.uri, { mimeType: 'text/markdown', dialogTitle: 'Export notes (Markdown)' });
      await Sharing.shareAsync(jsonFile.uri, { mimeType: 'application/json', dialogTitle: 'Export notes (JSON)' });
    } catch {
      Alert.alert('Export failed', 'Something went wrong while exporting your notes. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Background backgroundId={selectedBackgroundId}>
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Settings</Text>

          <GlassCard radius={theme.radius.lg} style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>API Keys</Text>

              <KeyField
                label="OpenAI (transcription)"
                testId="openai"
                value={openaiKey}
                onChangeText={setOpenaiKey}
                onSave={() => handleSave('openai', openaiKey)}
                saved={savedFlash.openai}
                status={testStatus.openai}
              />

              <KeyField
                label="Anthropic (AI analysis & chat)"
                testId="anthropic"
                value={anthropicKey}
                onChangeText={setAnthropicKey}
                onSave={() => handleSave('anthropic', anthropicKey)}
                saved={savedFlash.anthropic}
                status={testStatus.anthropic}
              />

              <Pressable
                onPress={handleTestKeys}
                style={styles.testButton}
                accessibilityRole="button"
                accessibilityLabel="Test keys"
                disabled={testStatus.openai === 'testing'}
              >
                <Text style={styles.testButtonText}>
                  {testStatus.openai === 'testing' ? 'Testing…' : 'Test keys'}
                </Text>
              </Pressable>

              <Text style={styles.faintNote}>Keys are stored securely on this device only.</Text>
            </View>
          </GlassCard>

          <GlassCard radius={theme.radius.lg} style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Background</Text>
              <View style={styles.bgGrid}>
                {BACKGROUNDS.map((bg) => {
                  const selected = bg.id === selectedBackgroundId;
                  return (
                    <Pressable
                      key={bg.id}
                      onPress={() => handleSelectBackground(bg.id)}
                      testID={`bg-thumb-${bg.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={bg.name}
                    >
                      <View style={[styles.bgThumbWrap, selected && styles.bgThumbSelected]}>
                        {bg.source ? (
                          <Image source={bg.source} style={styles.bgThumb} />
                        ) : (
                          <LinearGradient
                            colors={AURORA_COLORS}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bgThumb}
                          />
                        )}
                        {selected && (
                          <View style={styles.bgCheckWrap}>
                            <Ionicons name="checkmark-circle" size={18} color={theme.color.textPrimary} />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </GlassCard>

          <GlassCard radius={theme.radius.lg} style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Backup</Text>
              <Text style={styles.faintNote}>
                Export every note as Markdown and JSON, then AirDrop, save to Files, or back up to
                iCloud. This is the only copy of your notes.
              </Text>
              <Pressable
                onPress={handleExport}
                disabled={exporting}
                style={styles.exportButtonWrap}
                accessibilityRole="button"
                accessibilityLabel="Export all notes"
              >
                <GlassCard radius={theme.radius.md} style={styles.exportButton}>
                  <View style={styles.exportButtonContent}>
                    <Ionicons name="share-outline" size={18} color={theme.color.textPrimary} />
                    <Text style={styles.exportButtonText}>
                      {exporting ? 'Exporting…' : 'Export all notes'}
                    </Text>
                  </View>
                </GlassCard>
              </Pressable>
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

function KeyField({
  label,
  testId,
  value,
  onChangeText,
  onSave,
  saved,
  status,
}: {
  label: string;
  testId: string;
  value: string;
  onChangeText: (text: string) => void;
  onSave: () => void;
  saved: boolean;
  status: TestStatus;
}) {
  return (
    <View style={styles.keyField}>
      <Text style={styles.keyLabel}>{label}</Text>
      <View style={styles.keyInputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="sk-..."
          placeholderTextColor={theme.color.textFaint}
          style={styles.keyInput}
          testID={`key-input-${testId}`}
        />
        <Pressable
          onPress={onSave}
          style={styles.saveButton}
          accessibilityRole="button"
          accessibilityLabel={`Save ${label} key`}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>
      <View style={styles.keyStatusRow}>
        {saved && <Text style={styles.savedText}>Saved</Text>}
        {status === 'ok' && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
            <Text style={styles.statusTextOk}>Working</Text>
          </View>
        )}
        {status === 'fail' && (
          <View style={styles.statusRow}>
            <Ionicons name="close-circle" size={14} color={theme.color.record} />
            <Text style={styles.statusTextFail}>Failed</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const THUMB_SIZE = 64;

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: theme.space.lg,
    paddingBottom: theme.space.xxxl,
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  card: {},
  cardContent: {
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  sectionTitle: {
    fontSize: theme.font.heading,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  faintNote: {
    fontSize: theme.font.small,
    color: theme.color.textFaint,
  },
  keyField: {
    gap: theme.space.xs,
  },
  keyLabel: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
  },
  keyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  keyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.glass.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
  },
  saveButton: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
  },
  saveButtonText: {
    fontSize: theme.font.body,
    color: theme.color.record,
    fontWeight: theme.font.weightSemi,
  },
  keyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    minHeight: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  savedText: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
  },
  statusTextOk: {
    fontSize: theme.font.small,
    color: '#4ADE80',
  },
  statusTextFail: {
    fontSize: theme.font.small,
    color: theme.color.record,
  },
  testButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.space.sm,
  },
  testButtonText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
    fontWeight: theme.font.weightSemi,
  },
  bgGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
  },
  bgThumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bgThumbSelected: {
    borderColor: theme.color.record,
  },
  bgThumb: {
    width: '100%',
    height: '100%',
  },
  bgCheckWrap: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  exportButtonWrap: {},
  exportButton: {},
  exportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.md,
  },
  exportButtonText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
  },
});
