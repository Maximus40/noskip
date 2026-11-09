import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useCheckinLifecycle } from '@/features/checkin/useCheckin';
import {
  useNotificationRouting,
  usePushRegistration,
} from '@/features/notifications/useNotifications';
import { colors } from '@/theme/tokens';

export default function AppTabsLayout() {
  useCheckinLifecycle();
  usePushRegistration();
  useNotificationRouting();
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
