import { Redirect } from 'expo-router';

import { ScreenShell } from '@/components/ui/ScreenShell';

/** Developer demo mode: only reachable in development builds. */
export default function DevScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ScreenShell label="Mode démo" title="Simuler une entrée / sortie de salle." phase={5} />;
}
