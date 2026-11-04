/**
 * Background tasks. Must be imported once at startup (root layout) so the OS can wake the JS
 * runtime and find the task definitions.
 */
import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { regionsFor, type GymPoint } from '@/domain/checkin';
import { isSupabaseConfigured } from '@/lib/supabase';

import { arrive, leave, resume } from './engine';
import { readGymCache, writeGymCache } from './gymCache';

export const GEOFENCE_TASK = 'noskip-geofence';
export const RESUME_TASK = 'noskip-resume';

type GeofenceEvent = { eventType: Location.GeofencingEventType; region: Location.LocationRegion };

TaskManager.defineTask<GeofenceEvent>(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data || !isSupabaseConfigured) return;
  const gymId = data.region.identifier;
  if (!gymId) return;
  try {
    if (data.eventType === Location.GeofencingEventType.Enter) {
      await arrive(gymId, Date.now(), 'geofence');
    } else if (data.eventType === Location.GeofencingEventType.Exit) {
      await leave(gymId, Date.now());
    }
  } catch {
    // Errors are recorded by the engine; a background task must never crash.
  }
});

TaskManager.defineTask(RESUME_TASK, async () => {
  if (!isSupabaseConfigured) return BackgroundTask.BackgroundTaskResult.Success;
  try {
    await resume(await readGymCache(), Date.now());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** (Re)registers geofences for the player's gyms. Requires "Always" location permission. */
export async function syncGeofences(
  gyms: GymPoint[],
): Promise<'active' | 'no_permission' | 'no_gym'> {
  await writeGymCache(gyms);
  const bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) return 'no_permission';
  if (gyms.length === 0) {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
    return 'no_gym';
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regionsFor(gyms));
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Available) {
    await BackgroundTask.registerTaskAsync(RESUME_TASK, { minimumInterval: 30 });
  }
  return 'active';
}
