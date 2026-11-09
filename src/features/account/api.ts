import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { syncGeofences } from '@/features/checkin/tasks';
import { resetRevenueCat } from '@/features/subscriptions/revenuecat';
import { functionErrorCode } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { db } from '@/lib/supabase';

/** Everything NoSkip keeps on the phone (visit times, gym ids, flags): all under "noskip.". */
export async function wipeDevice(): Promise<void> {
  if (Platform.OS !== 'web') await syncGeofences([]).catch(() => undefined);
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('noskip.'));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  queryClient.clear();
}

/**
 * Deletes the account on the server (all data, cascades), then everything on this phone.
 * The store subscription is the player's to cancel: the screen says so before.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await db().functions.invoke('delete-account', {
        body: { confirm: 'SUPPRIMER' },
      });
      if (error) throw new Error((await functionErrorCode(error)) ?? 'delete_failed');
      await resetRevenueCat();
      await wipeDevice();
      await db().auth.signOut({ scope: 'local' });
    },
  });
}
