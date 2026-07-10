import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Background } from '@/components/Background';
import { useStore } from '@/store/useStore';
import { theme } from '@/theme/theme';

// Phase 7 builds the real note detail / transcript view here.
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const selectedBackgroundId = useStore((s) => s.selectedBackgroundId);

  return (
    <Background backgroundId={selectedBackgroundId}>
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Note {id}</Text>
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
});
