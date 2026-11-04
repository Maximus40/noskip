import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Renders the poster to a 1080×1920 PNG and opens the native share sheet
 * (Instagram / Snapchat stories, messages…). Returns false if sharing is unavailable.
 */
export async function shareSkipPoster(
  poster: RefObject<ComponentRef<typeof View> | null>,
): Promise<boolean> {
  if (!poster.current || !(await Sharing.isAvailableAsync())) return false;
  const uri = await captureRef(poster, {
    format: 'png',
    quality: 1,
    width: 1080,
    height: 1920,
    result: 'tmpfile',
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Partager la carte SKIP',
  });
  return true;
}
