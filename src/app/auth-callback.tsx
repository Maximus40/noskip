import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { completeAuthCallback } from '@/features/auth/signIn';
import { toUserMessage } from '@/lib/errors';

/** Landing for the magic link: dipsorchips://auth-callback?code=… */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeAuthCallback(params)
      .then(() => router.replace('/'))
      .catch((err: unknown) => setError(toUserMessage(err)));
  }, [params]);

  return (
    <Screen>
      <Text variant="title">{error ? 'Lien refusé.' : 'On t’ouvre la porte…'}</Text>
      {error ? (
        <>
          <ErrorNote message={error} />
          <Button label="Recevoir un nouveau lien" onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <Skeleton height={64} />
      )}
    </Screen>
  );
}
