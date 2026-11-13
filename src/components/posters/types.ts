import type { ComponentRef, Ref } from 'react';
import type { View } from 'react-native';

/** What every SKIP poster shows (9:16, drawn on a 360-wide canvas scaled by `width`). */
export type PosterProps = {
  width: number;
  pseudo: string;
  line: string;
  teamName: string;
  teamKg: number;
  skips: number;
  inviteLabel: string;
  weekLabel: string;
  /** Entrance animation. Off for the off-screen capture. */
  animated?: boolean;
  ref?: Ref<ComponentRef<typeof View>>;
};

export const posterHeight = (width: number) => Math.round((width * 16) / 9);
/** Design unit: posters are drawn for a 360-wide canvas. */
export const unit = (width: number) => width / 360;
