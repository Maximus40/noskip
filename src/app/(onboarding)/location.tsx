import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function LocationStep() {
  return (
    <ScreenShell
      label="Étape 7 / 10"
      title="On vérifie juste que t'es à la salle."
      phase={5}
      footer={<Button label="Continuer" onPress={() => router.push('/rules')} />}
    />
  );
}
