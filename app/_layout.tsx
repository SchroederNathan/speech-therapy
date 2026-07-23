import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { palette } from '@/constants/colors';
import { fontAssets, fonts } from '@/constants/fonts';

// Single source of truth for the native route background. The navigator paints
// every screen's container with the navigation theme's `background`, so setting
// it here themes all nested navigators at once and paints the screen container
// before JS content mounts — the surface behind the tab-switch fade always
// matches the screen color, so no flash.
function NavThemeProvider({ children }: { children: ReactNode }) {
  const dark = useColorScheme() === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  const colors = dark ? palette.dark : palette.light;

  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.foreground,
    },
    // Navigator-rendered text (headers, back labels) uses SF Pro Rounded too.
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' },
      medium: { fontFamily: fonts.medium, fontWeight: '500' },
      bold: { fontFamily: fonts.semibold, fontWeight: '600' },
      heavy: { fontFamily: fonts.bold, fontWeight: '700' },
    },
  } as const;

  // Keep the native root view / window (behind the routes: launch, overscroll
  // bounce, transparent sheets) in sync with the theme too.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return <ThemeProvider value={navTheme}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  // Expo Go can't embed fonts at build time, so load them here. The root view
  // stays on the themed background color (via expo-system-ui) until ready,
  // so the brief wait reads as launch, not a flash.
  const [fontsReady, fontError] = useFonts(fontAssets);
  if (!fontsReady && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavThemeProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="session"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
        </Stack>
        <StatusBar style="auto" />
      </NavThemeProvider>
    </GestureHandlerRootView>
  );
}
