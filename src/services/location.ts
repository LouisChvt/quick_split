// Suivi GPS en arrière-plan. La tâche DOIT être définie au chargement du module
// (index.ts l'importe avant d'enregistrer l'app), sinon iOS ne peut pas la relancer.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getState } from '../state/store';
import { onPosition } from './announcer';

export const LOCATION_TASK = 'trailpacer-location';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  // On ne garde que la position la plus récente du lot (iOS peut en livrer plusieurs).
  const loc = data.locations[data.locations.length - 1];
  await onPosition(loc.coords.latitude, loc.coords.longitude, loc.coords.accuracy ?? null, loc.timestamp);
});

export type GpsPermission = 'background' | 'foreground' | 'denied';

export async function requestGpsPermission(): Promise<GpsPermission> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.granted ? 'background' : 'foreground';
  } catch {
    return 'foreground';
  }
}

export async function startGps(): Promise<GpsPermission> {
  const perm = await requestGpsPermission();
  if (perm === 'denied') return perm;
  const eco = getState().prefs.gpsPowerSave;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: eco ? Location.Accuracy.Balanced : Location.Accuracy.High,
    distanceInterval: eco ? 50 : 20,
    timeInterval: eco ? 15000 : 5000,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TrailPacer',
      notificationBody: 'Suivi de course actif',
      killServiceOnDestroy: false,
    },
  });
  return perm;
}

export async function stopGps() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
}

/** Position ponctuelle (bouton « Me localiser »). */
export async function currentPosition() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return null;
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}
