import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function HookStep() {
  return (
    <ScreenShell
      label="Étape 1 / 10"
      title="Le mois dernier, tu avais prévu combien de séances ?"
      phase={3}
      footer={<Button label="Continuer" onPress={() => router.push('/sign-in')} />}
    />
  );
}
