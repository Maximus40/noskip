import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function NotificationsStep() {
  return (
    <ScreenShell
      label="Étape 9 / 10"
      title="Active les notifs."
      phase={9}
      footer={<Button label="Continuer" onPress={() => router.push('/paywall')} />}
    />
  );
}
