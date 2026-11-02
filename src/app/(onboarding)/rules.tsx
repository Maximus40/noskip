import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function RulesStep() {
  return (
    <ScreenShell
      label="Étape 8 / 10"
      title="Les règles de la team."
      phase={4}
      footer={<Button label="Continuer" onPress={() => router.push('/notifications')} />}
    />
  );
}
