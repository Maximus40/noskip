import { Redirect } from 'expo-router';

import Welcome from './(onboarding)/welcome';

/** Development only: the welcome pages outside the onboarding gate, for visual QA (?page=n). */
export default function DevWelcome() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Welcome />;
}
