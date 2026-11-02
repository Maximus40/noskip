import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function TeamSetupStep() {
  return (
    <ScreenShell
      label="Étape 6 / 10"
      title="Crée ta team ou rejoins tes potes."
      phase={4}
      footer={<Button label="Continuer" onPress={() => router.push('/location')} />}
    />
  );
}
