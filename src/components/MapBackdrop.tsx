/**
 * Dark map of the gym's neighbourhood behind the game screens ("verre sur carte").
 * iOS: Apple Maps in dark mode. Android: Google Maps with a dark style when a key is configured,
 * otherwise a drawn backdrop. The player's own live position is never displayed.
 */
import Constants from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { DARK_MAP_STYLE } from './darkMapStyle';
import { DrawnStreets, GymPulse, mapStyles } from './MapBackdropParts';

type Props = { center: { lat: number; lng: number } | null };

const hasAndroidMaps = Boolean(
  (Constants.expoConfig?.extra as { hasAndroidMaps?: boolean } | undefined)?.hasAndroidMaps,
);

export function MapBackdrop({ center }: Props) {
  const canShowMap =
    center !== null && (Platform.OS === 'ios' || (Platform.OS === 'android' && hasAndroidMaps));
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      {canShowMap ? (
        <MapView
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          customMapStyle={DARK_MAP_STYLE}
          userInterfaceStyle="dark"
          initialRegion={{
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsCompass={false}
          toolbarEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        />
      ) : (
        <DrawnStreets />
      )}
      <View style={[StyleSheet.absoluteFill, mapStyles.scrim]} />
      {center ? <GymPulse /> : null}
    </View>
  );
}
