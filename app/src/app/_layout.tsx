import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useStore } from '@/store/useStore';

SplashScreen.preventAutoHideAsync();

// Stack navigation: custom glass headers are rendered per-screen, so the
// native header is hidden here. The app opens straight to `index` (home).
export default function RootLayout() {
  // App-start hydration: apply the last background the user picked in
  // Settings (persisted via secure storage) before any screen renders, so
  // restarting the app doesn't flash the default background first.
  useEffect(() => {
    useStore.getState().loadSelectedBackground();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="folder/[id]" />
        <Stack.Screen name="note/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
    </GestureHandlerRootView>
  );
}
