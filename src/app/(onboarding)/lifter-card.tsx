import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function LifterCardStep() {
  return (
    <ScreenShell
      label="Étape 5 / 10"
      title="Ta carte de lifter."
      phase={3}
      footer={<Button label="Continuer" onPress={() => router.push('/team-setup')} />}
    />
  );
}
