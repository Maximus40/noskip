import type { MapStyleElement } from 'react-native-maps';

/** Google Maps style: black streets, grey labels, no POIs, no colour except ours. */
export const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#16171a' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6c6d72' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#16171a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0b0c0e' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#0e0f11' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#101114' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a5b60' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1013' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#16171a' }] },
];
