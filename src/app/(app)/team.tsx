import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function TeamScreen() {
  return (
    <ScreenShell label="Ma team" title="La barre de la team." phase={6}>
      <Button label="Séance en cours" onPress={() => router.push('/session')} />
      {__DEV__ ? (
        <Button
          label="Mode démo"
          variant="ghost"
          withArrow={false}
          onPress={() => router.push('/dev')}
        />
      ) : null}
    </ScreenShell>
  );
}
