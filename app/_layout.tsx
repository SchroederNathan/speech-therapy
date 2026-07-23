import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IntroRevealProvider, SplashOverlay } from '@/components/splash';
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
  // Expo Go can't embed fonts at build time, so load them here. The splash
  // overlay needs no fonts, so it plays over the wait — only the routes
  // beneath it hold for the font load.
  const [fontsReady, fontError] = useFonts(fontAssets);
  const dark = useColorScheme() === 'dark';
  // revealed flips when the splash logo ends (content starts staggering in
  // beneath the fade); splashDone flips when the fade completes (overlay unmounts).
  const [revealed, setRevealed] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <IntroRevealProvider value={revealed}>
        <NavThemeProvider>
          {fontsReady || fontError ? (
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="session"
                options={{ presentation: 'fullScreenModal', headerShown: false }}
              />
            </Stack>
          ) : null}
          {/* The splash backdrop inverts the scheme (light mode plays on
              black), so pin the status bar to stay legible until it's gone. */}
          <StatusBar style={splashDone ? 'auto' : dark ? 'dark' : 'light'} />
          {!splashDone ? (
            <SplashOverlay
              onReveal={() => setRevealed(true)}
              onDone={() => setSplashDone(true)}
            />
          ) : null}
        </NavThemeProvider>
      </IntroRevealProvider>
    </GestureHandlerRootView>
  );
}
