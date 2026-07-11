import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassCard } from '@/components/GlassCard';
import type { Message } from '@/db/repo';
import { useStore } from '@/store/useStore';
import { theme } from '@/theme/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.8);
/** Drag past 30% of the drawer's height (or a fast enough flick) dismisses it. */
const CLOSE_DISTANCE_THRESHOLD = DRAWER_HEIGHT * 0.3;
const CLOSE_VELOCITY_THRESHOLD = 800;
const SPRING_CONFIG = { damping: 24, stiffness: 220, mass: 0.9 } as const;

const SUGGESTED_PROMPTS = [
  'What were the next steps from this?',
  'What was the idea as a whole?',
];

export type ChatDrawerProps = {
  visible: boolean;
  onClose: () => void;
  noteId: string;
  /** The note's combined transcript — passed as chat context, not derived here. */
  transcript: string;
};

/**
 * Bottom-sheet drawer for chatting with a note. Gesture-driven slide (real
 * spring physics via reanimated + gesture-handler, not instant show/hide):
 * slides up from off-screen on open, and can be dragged back down to
 * dismiss — release past ~30% of the drawer height or a fast downward flick
 * closes it; released short of that, it springs back open.
 *
 * Rendered as a plain conditionally-mounted overlay inside the *screen's own*
 * view hierarchy — deliberately NOT a native `Modal`. Two earlier attempts
 * both failed on-device:
 *   v1: an ALWAYS-mounted absolutely-positioned overlay gated only by
 *       `pointerEvents={visible ? 'auto' : 'none'}` — an invisible layer was
 *       still there when "closed" and could swallow touches.
 *   v2: a native `Modal` whose open spring was started in the same effect
 *       that flipped `mounted` true — the animation began on the SAME tick
 *       as the state change, before React had committed the Modal's content
 *       to the native tree, so the spring ran against a view that didn't
 *       exist yet and the sheet never visibly slid up.
 *
 * This version fixes both: `mounted` gates rendering entirely (`if
 * (!mounted) return null` — nothing at all renders when closed, so there is
 * no touch-blocker to regress into), and the two concerns — "should the
 * overlay exist" vs "start the open animation" — are split into two
 * separate effects below so the animation can only start once the overlay
 * has actually mounted. No nested `GestureHandlerRootView` is needed since
 * this is a normal in-tree view, not separate native Modal content — the
 * root one in `_layout.tsx` already covers it.
 *
 * Chat history (chatMessages) is a store selector — the parent screen is
 * responsible for calling loadChatMessages(noteId) when the drawer opens.
 */
export function ChatDrawer({ visible, onClose, noteId, transcript }: ChatDrawerProps) {
  const chatMessages = useStore((s) => s.chatMessages);
  const sendChatMessage = useStore((s) => s.sendChatMessage);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const translateY = useSharedValue(DRAWER_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  // Step 1 of 2: `visible` only ever toggles whether the overlay is
  // mounted. Opening never touches the animated values here — see the
  // effect below for why that's deliberate. Closing (visible -> false,
  // whether from a prop change or the drag gesture) starts the close
  // spring right away and only tears the overlay down once it's actually
  // finished sliding off-screen, so the close animation always gets to
  // play out in full.
  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      translateY.value = withSpring(DRAWER_HEIGHT, SPRING_CONFIG, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, mounted, translateY, backdropOpacity]);

  // Step 2 of 2: THE critical timing fix. This effect's only dependency is
  // `mounted`, and the overlay JSX below is gated on that same `mounted`
  // (`if (!mounted) return null`). React always commits a render before
  // running its effects, so by the time this fires, the overlay's views are
  // guaranteed to already be attached to the native tree — the spring is
  // animating something that actually exists, instead of racing a
  // not-yet-mounted (or not-yet-presented) view like v2 did.
  useEffect(() => {
    if (mounted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      translateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [mounted, translateY, backdropOpacity]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [chatMessages.length]);

  const closeDrawer = () => {
    onClose();
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Clamp: dragging up (negative translation) can't push the sheet
      // above its fully-open resting position.
      translateY.value = Math.max(0, dragStartY.value + e.translationY);
    })
    .onEnd((e) => {
      const shouldClose =
        translateY.value > CLOSE_DISTANCE_THRESHOLD || e.velocityY > CLOSE_VELOCITY_THRESHOLD;
      if (shouldClose) {
        translateY.value = withSpring(DRAWER_HEIGHT, SPRING_CONFIG);
        runOnJS(closeDrawer)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    try {
      await sendChatMessage(noteId, transcript, trimmed);
    } finally {
      setSending(false);
    }
  };

  const canSend = input.trim().length > 0 && !sending;

  // Not (or no longer) open: render nothing at all, so there is never an
  // invisible full-screen layer left behind to swallow touches.
  if (!mounted) return null;

  return (
    <View style={styles.overlayRoot}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
          testID="chat-drawer-backdrop"
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.sheetWrap, { height: DRAWER_HEIGHT }, sheetStyle]}>
          <GlassCard radius={theme.radius.xl} style={styles.sheet}>
            <KeyboardAvoidingView
              style={styles.flexFull}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.dragHandle} />

              <View style={styles.header}>
                <Text style={styles.headerTitle}>Chat with this note</Text>
                <Pressable
                  onPress={closeDrawer}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={theme.color.textPrimary} />
                </Pressable>
              </View>

              <FlatList
                ref={listRef}
                data={chatMessages}
                keyExtractor={(m) => m.id}
                renderItem={({ item }) => <Bubble message={item} />}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Ask anything about this note.</Text>
                }
              />

              <View style={styles.promptRow}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => setInput(prompt)}
                    style={styles.promptChip}
                    accessibilityRole="button"
                  >
                    <Text style={styles.promptChipText} numberOfLines={1}>
                      {prompt}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask about this note…"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  multiline
                  testID="chat-drawer-input"
                />
                <Pressable
                  onPress={() => handleSend(input)}
                  disabled={!canSend}
                  style={styles.sendButton}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  testID="chat-drawer-send"
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={32}
                    color={canSend ? theme.color.textPrimary : theme.color.textFaint}
                  />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </GlassCard>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <GlassCard
        radius={theme.radius.md}
        blur={false}
        pressed={isUser}
        style={styles.bubble}
      >
        <Text style={styles.bubbleText}>{message.content}</Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills the whole screen inside the host screen's own view tree (not a
  // separate native Modal layer) — high zIndex/elevation so it paints above
  // the ScrollView content and the fixed record-button footer alike,
  // regardless of where within its parent's children array it happens to
  // sit.
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    flex: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  flexFull: {
    flex: 1,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.glass.border,
    marginTop: theme.space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  headerTitle: {
    fontSize: theme.font.heading,
    fontWeight: theme.font.weightSemi,
    color: theme.color.textPrimary,
  },
  listContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.md,
    gap: theme.space.sm,
    flexGrow: 1,
  },
  emptyText: {
    fontSize: theme.font.body,
    color: theme.color.textFaint,
    textAlign: 'center',
    marginTop: theme.space.xl,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
  },
  bubbleText: {
    fontSize: theme.font.body,
    color: theme.color.textPrimary,
    lineHeight: 21,
    padding: theme.space.md,
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.sm,
  },
  promptChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.glass.border,
    backgroundColor: theme.glass.fill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  promptChipText: {
    fontSize: theme.font.small,
    color: theme.color.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.lg,
    paddingTop: theme.space.xs,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
    backgroundColor: theme.glass.fill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
  },
  sendButton: {
    paddingBottom: theme.space.xs,
  },
});

export default ChatDrawer;
