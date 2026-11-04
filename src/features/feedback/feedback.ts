/**
 * Sound + haptics for the big moments. Both respect the player's settings
 * (profiles.sound_enabled / haptics_enabled) and never throw.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const SOURCES = {
  clang: require('../../../assets/sounds/plate-clang.wav'),
  chalk: require('../../../assets/sounds/chalk-clap.wav'),
  snicker: require('../../../assets/sounds/canap-snicker.wav'),
} as const;

export type Sound = keyof typeof SOURCES;
export type FeedbackPrefs = { sound: boolean; haptics: boolean };

const players: Partial<Record<Sound, AudioPlayer>> = {};
let modeSet = false;

async function play(sound: Sound) {
  if (!modeSet) {
    // Short UI sounds: mix with the player's music, stay silent with the ringer switch off.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    modeSet = true;
  }
  const player = (players[sound] ??= createAudioPlayer(SOURCES[sound]));
  await player.seekTo(0);
  player.play();
}

export async function feedback(
  moment: 'plate_loaded' | 'skip' | 'team_pr' | 'tap',
  prefs: FeedbackPrefs,
): Promise<void> {
  try {
    if (prefs.haptics) {
      if (moment === 'plate_loaded' || moment === 'team_pr') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (moment === 'skip') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.selectionAsync();
      }
    }
    if (prefs.sound) {
      if (moment === 'plate_loaded') await play('clang');
      else if (moment === 'team_pr') await play('chalk');
      else if (moment === 'skip') await play('snicker');
    }
  } catch {
    // Feedback is decoration: never break a screen for it.
  }
}
