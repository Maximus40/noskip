import { Redirect } from 'expo-router';

/** Entry point. Auth/onboarding gating is wired in phase 3. */
export default function Index() {
  return <Redirect href="/hook" />;
}
