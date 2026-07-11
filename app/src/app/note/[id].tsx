import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { formatParagraphs, transcribe } from '@/ai/whisper';
import { useRecorder } from '@/audio/useRecorder';
import { Background } from '@/components/Background';
import { ChatDrawer } from '@/components/ChatDrawer';
import { GlassCard } from '@/components/GlassCard';
import { RecordButton } from '@/components/RecordButton';
import type { Segment } from '@/db/repo';
import { getKey } from '@/store/secrets';
import { useStore } from '@/store/useStore';
import { theme } from '@/theme/theme';

const COLLAPSED_LINES = 3;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recorder = useRecorder();

  const selectedBackgroundId = useStore((s) => s.selectedBackgroundId);
  const currentNote = useStore((s) => s.currentNote);
  const currentSegments = useStore((s) => s.currentSegments);
  const loadNote = useStore((s) => s.loadNote);
  const appendToNote = useStore((s) => s.appendToNote);
  const reanalyzeNote = useStore((s) => s.reanalyzeNote);
  const loadChatMessages = useStore((s) => s.loadChatMessages);

  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const buttonState = recorder.state === 'recording' ? 'recording' : processing ? 'processing' : 'idle';

  useFocusEffect(
    useCallback(() => {
      if (id) loadNote(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  useEffect(() => {
    if (chatVisible && id) loadChatMessages(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatVisible, id]);

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
      if (!audioUri || !id) return;

      const key = await getKey('openai');
      if (!key) {
        Alert.alert('Add your OpenAI key', 'Add your OpenAI key in Settings to transcribe notes.');
        return;
      }

      try {
        const raw = await transcribe(audioUri, key);
        const transcript = formatParagraphs(raw);
        appendToNote(id, transcript, audioUri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Reveal the newly-added segment in the (now stacked) transcript.
        setExpanded(true);
        // Fire-and-forget: re-title/re-summarize off the FULL transcript
        // without blocking the recording UI from returning to idle.
        reanalyzeNote(id).catch(() => {});
      } catch {
        // Never lose the recording: save it as a placeholder segment so the
        // user can retry later, and let them know something went wrong.
        appendToNote(id, '[Transcription failed — audio saved]', audioUri);
        Alert.alert(
          'Transcription failed',
          'We saved your recording as a new segment. You can try again later.'
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  if (!currentNote) {
    return (
      <Background backgroundId={selectedBackgroundId}>
        <SafeAreaView style={styles.safe}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        </SafeAreaView>
      </Background>
    );
  }

  const hasNextSteps = currentNote.next_steps.length > 0;
  const combinedTranscript = currentSegments.map((s) => s.text).join('\n\n');

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
          <View style={styles.header}>
            <Text style={styles.title}>{currentNote.title || 'Untitled'}</Text>
            <Text style={styles.date}>{formatDate(currentNote.created_at)}</Text>
          </View>

          <GlassCard radius={theme.radius.lg} style={styles.card}>
            <View style={styles.cardContent}>
              {!!currentNote.summary && <Text style={styles.summary}>{currentNote.summary}</Text>}
              {!currentNote.summary && (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator size="small" color={theme.color.textFaint} />
                  <Text style={styles.summaryPending}>Analyzing…</Text>
                </View>
              )}
              {hasNextSteps && (
                <View style={styles.nextSteps}>
                  <Text style={styles.sectionLabel}>Next steps</Text>
                  {currentNote.next_steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={styles.stepBullet}>{'•'}</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </GlassCard>

          <TranscriptCard
            segments={currentSegments}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
          />

          <Pressable
            onPress={() => setChatVisible(true)}
            style={styles.chatButtonWrap}
            accessibilityRole="button"
            accessibilityLabel="Chat with this note"
          >
            <GlassCard radius={theme.radius.md} style={styles.chatButton}>
              <View style={styles.chatButtonContent}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.color.textPrimary} />
                <Text style={styles.chatButtonText}>Chat with this note</Text>
              </View>
            </GlassCard>
          </Pressable>
        </ScrollView>

        <View style={styles.recordSection}>
          <RecordButton size={84} state={buttonState} onToggle={handleRecordToggle} />
          <Text style={styles.recordCaption}>Add to note</Text>
        </View>
      </SafeAreaView>

      {/* Sibling to (and rendered after) the SafeAreaView, both inside
          Background: ChatDrawer is now a plain in-tree absolutely-positioned
          overlay rather than a native Modal, so paint order matters — being
          the LAST child here means it layers above the ScrollView content
          AND the fixed record-button footer, and its absoluteFill sizes to
          Background's full-bleed view rather than being clipped by
          SafeAreaView's inset padding. */}
      <ChatDrawer
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        noteId={currentNote.id}
        transcript={combinedTranscript}
      />
    </Background>
  );
}

function TranscriptCard({
  segments,
  expanded,
  onToggle,
}: {
  segments: Segment[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const combinedText = segments.map((s) => s.text).join('\n\n');

  const handleToggle = () => {
    Haptics.selectionAsync();
    onToggle();
  };

  return (
    <GlassCard radius={theme.radius.lg} style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.sectionLabel}>Transcript</Text>

        {/* Layout animation (not a measured-height tween): collapsed renders
            numberOfLines={3}, expanded renders the full text at its natural
            (auto) height. There's no invisible measurer to get wrong and no
            clipped height cap — the ScrollView always sees the true content
            height, so arbitrarily long transcripts stay fully reachable. */}
        <Animated.View layout={LinearTransition.duration(280)}>
          {expanded ? (
            <View>
              {segments.map((seg) => (
                <Animated.View key={seg.id} entering={FadeIn.duration(250)} style={styles.segment}>
                  <Text style={styles.segmentTimestamp}>{formatTimestamp(seg.created_at)}</Text>
                  <Text style={styles.segmentText}>{seg.text}</Text>
                </Animated.View>
              ))}
            </View>
          ) : (
            <Text style={styles.collapsedText} numberOfLines={COLLAPSED_LINES}>
              {combinedText}
            </Text>
          )}
        </Animated.View>

        <Pressable
          onPress={handleToggle}
          style={styles.expandRow}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Show more'}
        >
          <Text style={styles.expandLabel}>{expanded ? 'Show less' : 'Show more'}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.color.textSecondary}
          />
        </Pressable>
      </View>
    </GlassCard>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: theme.space.lg,
    paddingBottom: theme.space.lg,
  },
  header: {
    gap: theme.space.xs,
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  date: {
    fontSize: theme.font.small,
    color: theme.color.textFaint,
  },
  card: {},
  cardContent: {
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  summary: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
    lineHeight: 22,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  summaryPending: {
    fontSize: theme.font.body,
    color: theme.color.textFaint,
    fontStyle: 'italic',
  },
  nextSteps: {
    gap: theme.space.xs,
  },
  sectionLabel: {
    fontSize: theme.font.small,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row',
    gap: theme.space.xs,
  },
  stepBullet: {
    fontSize: theme.font.body,
    color: theme.color.textSecondary,
  },
  stepText: {
    flex: 1,
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
  },
  collapsedText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
    lineHeight: 22,
  },
  segment: {
    gap: theme.space.xs,
    paddingBottom: theme.space.md,
  },
  segmentTimestamp: {
    fontSize: theme.font.small,
    color: theme.color.textFaint,
  },
  segmentText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
    lineHeight: 22,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    paddingTop: theme.space.xs,
  },
  expandLabel: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
  },
  chatButtonWrap: {},
  chatButton: {},
  chatButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.md,
  },
  chatButtonText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
  },
  recordSection: {
    alignItems: 'center',
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xl,
  },
  recordCaption: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
  },
});
