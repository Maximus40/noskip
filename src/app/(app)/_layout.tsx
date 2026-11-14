import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCheckinLifecycle } from '@/features/checkin/useCheckin';
import {
  useNotificationRouting,
  usePushRegistration,
} from '@/features/notifications/useNotifications';
import { colors } from '@/theme/tokens';

/** The tabs need a session: after a sign-out, go back to the gate instead of rendering. */
export default function AppTabsLayout() {
  const { session } = useAuth();
  if (!session) return <Redirect href="/" />;
  return <SignedInTabs />;
}

function SignedInTabs() {
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
      <Tabs.Screen name="boutique" />
      <Tabs.Screen name="lifter" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
