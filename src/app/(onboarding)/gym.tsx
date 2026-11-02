import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function GymStep() {
  return (
    <ScreenShell
      label="Étape 3 / 10"
      title="Choisis ta salle."
      phase={3}
      footer={<Button label="Continuer" onPress={() => router.push('/goal')} />}
    />
  );
}
