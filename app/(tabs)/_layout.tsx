import { AudioLinesIcon, Chart02Icon, Home07Icon } from '@hugeicons-pro/core-solid-rounded';
import { useRouter } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';

import {
  GlassTabBar,
  GlassTabButton,
  TabBarMinimizeProvider,
  renderFadingTabScreen,
  type GlassTabItem,
} from '@/components/glass-tabs';

const ITEMS: (GlassTabItem & { href: string })[] = [
  { name: 'index', href: '/', label: 'Home', icon: Home07Icon },
  { name: 'practice', href: '/practice', label: 'Practice', icon: AudioLinesIcon },
  { name: 'analytics', href: '/analytics', label: 'Analytics', icon: Chart02Icon },
];

export default function TabsLayout() {
  const router = useRouter();
  return (
    <TabBarMinimizeProvider>
      <Tabs>
        <TabSlot style={{ height: '100%' }} renderFn={renderFadingTabScreen} />
        <TabList asChild>
          <GlassTabBar onIndexSelected={(i) => router.navigate(ITEMS[i].href as never)}>
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
