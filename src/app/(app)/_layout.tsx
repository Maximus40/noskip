import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/tokens';

export default function AppTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="team" />
      <Tabs.Screen name="teams" />
      <Tabs.Screen name="lifter" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
