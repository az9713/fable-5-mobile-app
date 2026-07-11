import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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

        <View style={styles.header}>
          <Text style={styles.title}>{currentNote.title || 'Untitled'}</Text>
          <Text style={styles.date}>{formatDate(currentNote.created_at)}</Text>
        </View>

        <GlassCard radius={theme.radius.lg} style={styles.card}>
          <View style={styles.cardContent}>
            {!!currentNote.summary && <Text style={styles.summary}>{currentNote.summary}</Text>}
            {!currentNote.summary && (
              <Text style={styles.summaryPending}>Analysis will appear here shortly.</Text>
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

        <View style={styles.recordSection}>
          <RecordButton size={84} state={buttonState} onToggle={handleRecordToggle} />
        </View>
      </SafeAreaView>

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

  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null);
  const animatedHeight = useSharedValue(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (collapsedHeight === null || initialized.current) return;
    initialized.current = true;
    animatedHeight.value = expanded ? (expandedHeight ?? collapsedHeight) : collapsedHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedHeight]);

  useEffect(() => {
    if (!initialized.current) return;
    const target = expanded ? expandedHeight : collapsedHeight;
    if (target === null) return;
    animatedHeight.value = withTiming(target, { duration: 280 });
  }, [expanded, expandedHeight, collapsedHeight, animatedHeight]);

  const clipStyle = useAnimatedStyle(() => ({ height: animatedHeight.value }));

  const handleToggle = () => {
    Haptics.selectionAsync();
    onToggle();
  };

  return (
    <GlassCard radius={theme.radius.lg} style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.sectionLabel}>Transcript</Text>

        <Animated.View style={[styles.transcriptClip, clipStyle]}>
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

        {/* Off-screen measurers: keep collapsed/expanded heights up to date
            without affecting visible layout, so the toggle above can animate
            height smoothly instead of popping instantly. */}
        <View style={styles.measureHidden} pointerEvents="none">
          <Text
            style={styles.collapsedText}
            numberOfLines={COLLAPSED_LINES}
            onLayout={(e) => setCollapsedHeight(e.nativeEvent.layout.height)}
          >
            {combinedText}
          </Text>
        </View>
        <View style={styles.measureHidden} pointerEvents="none">
          <View onLayout={(e) => setExpandedHeight(e.nativeEvent.layout.height)}>
            {segments.map((seg) => (
              <View key={seg.id} style={styles.segment}>
                <Text style={styles.segmentTimestamp}>{formatTimestamp(seg.created_at)}</Text>
                <Text style={styles.segmentText}>{seg.text}</Text>
              </View>
            ))}
          </View>
        </View>

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
  transcriptClip: {
    overflow: 'hidden',
  },
  collapsedText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
    lineHeight: 22,
  },
  measureHidden: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
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
});
