import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function GoalStep() {
  return (
    <ScreenShell
      label="Étape 4 / 10"
      title="Combien de séances par semaine ?"
      phase={3}
      footer={<Button label="Continuer" onPress={() => router.push('/lifter-card')} />}
    />
  );
}
