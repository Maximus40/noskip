/** Rounds a coordinate to 2 decimals (≈1.1 km): the only precision that leaves the phone. */
export function coarse(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Great-circle distance in metres. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m", "1,2 km", "18 km" (French decimal comma). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(meters / 1000)} km`;
}
