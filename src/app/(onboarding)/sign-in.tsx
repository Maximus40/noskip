import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function SignInStep() {
  return (
    <ScreenShell
      label="Étape 2 / 10"
      title="Connecte-toi."
      phase={3}
      footer={<Button label="Continuer" onPress={() => router.push('/gym')} />}
    />
  );
}
