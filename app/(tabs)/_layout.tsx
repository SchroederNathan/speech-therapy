import { AudioLinesIcon, Chart02Icon, Home07Icon } from '@hugeicons-pro/core-solid-rounded';
import { useRouter } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIntroRevealStyle } from '@/components/splash';

import {
  GlassTabBar,
  GlassTabButton,
  ProgressiveBlur,
  TabBarMinimizeProvider,
  renderFadingTabScreen,
  type GlassTabItem,
} from '@/components/glass-tabs';

const ITEMS: (GlassTabItem & { href: string })[] = [
  { name: 'index', href: '/', label: 'Home', icon: Home07Icon },
  { name: 'practice', href: '/practice', label: 'Practice', icon: AudioLinesIcon },
  { name: 'analytics', href: '/analytics', label: 'Analytics', icon: Chart02Icon },
];

/** Progressive blur over the status bar: strongest at the device's top edge,
 * fading out exactly at the top of the safe area. */
function StatusBarBlur() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  return (
    <ProgressiveBlur
      direction="top"
      tint={scheme === 'dark' ? 'dark' : 'light'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top }}
    />
  );
}

export default function TabsLayout() {
  const router = useRouter();
  // Transform-only (fade: false): the liquid-glass pill breaks under animated
  // opacity, so the bar slides up from fully below the screen instead.
  const entranceStyle = useIntroRevealStyle(0, 130, false);
  return (
    <TabBarMinimizeProvider>
      <Tabs>
        <TabSlot style={{ height: '100%' }} renderFn={renderFadingTabScreen} />
        <StatusBarBlur />
        {/* TabList must stay a direct child of Tabs (the trigger parser skips
            wrapper components), so the intro entrance is passed in as a style:
            the bar rises in at slot 0 with the home header. */}
        <TabList asChild>
          <GlassTabBar
            entranceStyle={entranceStyle}
            onIndexSelected={(i) => router.navigate(ITEMS[i].href as never)}>
            {ITEMS.map(({ href, ...item }, index) => (
              <TabTrigger key={item.name} name={item.name} href={href as never} asChild>
                <GlassTabButton item={item} index={index} />
              </TabTrigger>
            ))}
          </GlassTabBar>
        </TabList>
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
