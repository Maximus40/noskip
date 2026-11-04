/** Web (dev previews only): no native map, the drawn neighbourhood stands in. */
import { StyleSheet, View } from 'react-native';

import { DrawnStreets, GymPulse, mapStyles } from './MapBackdropParts';

type Props = { center: { lat: number; lng: number } | null };

export function MapBackdrop({ center }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <DrawnStreets />
      <View style={[StyleSheet.absoluteFill, mapStyles.scrim]} />
      {center ? <GymPulse /> : null}
    </View>
  );
}
