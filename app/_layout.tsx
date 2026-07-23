import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Speech Companion' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
