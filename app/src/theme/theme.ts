export const theme = {
  color: {
    textPrimary: 'rgba(255,255,255,0.96)',
    textSecondary: 'rgba(255,255,255,0.66)',
    textFaint: 'rgba(255,255,255,0.40)',
    record: '#FF5A5F',
    recordGlow: 'rgba(255,90,95,0.45)',
  },
  glass: {
    fill: 'rgba(255,255,255,0.03)',
    fillElevated: 'rgba(255,255,255,0.06)',
    fillPressed: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.45)',
    borderStrong: 'rgba(255,255,255,0.60)',
    blurIntensity: 30,
    // iOS vibrancy material: see-through + saturates what's behind it, unlike
    // the flat 'light' frost this replaces. Valid BlurTint in expo-blur ~15
    // (SDK 54) — confirmed against BlurView.types.d.ts.
    blurTint: 'systemThinMaterialLight' as const,
  },
  radius: { sm: 16, md: 24, lg: 28, xl: 32, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  font: { title: 28, heading: 20, body: 16, small: 13, weightSemi: '600' as const },
} as const;
export type Theme = typeof theme;
