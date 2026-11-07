// Notifications locales programmées : elles partent même écran verrouillé, sans réseau,
// et sont relayées sur la montre si celle-ci affiche les notifications du téléphone.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { dueAt } from '../core/events';
import { plannedStartMs } from '../core/format';
import { deltaFromAnchor } from '../core/position';
import type { Plan } from '../core/types';
import { getState, raceEvents } from '../state/store';
import type { RaceSession } from '../state/types';

const CHANNEL = 'race';
/** iOS garde au plus 64 notifications locales en attente. */
const MAX_PENDING = 60;

export function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      // App au premier plan : la voix annonce déjà, on affiche sans son.
      const voice = getState().prefs.voice;
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: !voice, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Course',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
    }).catch(() => {});
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function schedule(title: string, body: string, at: number, id: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: 'default', data: { id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
  });
}

/** (Re)programme toutes les alertes à venir à partir du départ réel et de l'écart actuel. */
/**
 * Renvoie l'horizon (temps de course du dernier événement programmé) s'il reste des événements
 * au-delà de la limite iOS, sinon null.
 */
export async function scheduleRaceNotifications(plan: Plan, session: RaceSession, now = Date.now()): Promise<number | null> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (session.finishedAt) return null;
  const delta = deltaFromAnchor(plan, session.anchor);
  const elapsed = (now - session.startMs) / 1000;
  const done = new Set(session.done);
  const upcoming = raceEvents(plan, session.startMs)
    .filter((e) => !done.has(e.id))
    .map((e) => ({ e, at: dueAt(e, delta) }))
    .filter((x) => x.at > elapsed + 2)
    .sort((a, b) => a.at - b.at);
  const batch = upcoming.slice(0, MAX_PENDING);
  for (const { e, at } of batch) {
    await schedule(e.title, e.body, session.startMs + at * 1000, e.id).catch(() => {});
  }
  return upcoming.length > MAX_PENDING ? batch[batch.length - 1].at : null;
}

/** Rappels de la veille et du matin, relatifs à l'heure de départ prévue. */
export async function scheduleMorningReminders(plan: Plan, now = Date.now()): Promise<number> {
  const start = plannedStartMs(plan.race.date, plan.race.startTime);
  if (!start) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  let n = 0;
  const items = [
    { at: start - 14 * 3600 * 1000, title: 'Demain : ' + plan.race.name, body: 'Prépare ton sac : ouvre la checklist dans l’app.' },
    ...plan.morning.map((m) => ({ at: start - m.minBefore * 60000, title: `Départ dans ${m.minBefore} min`, body: m.text })),
  ];
  for (const [i, it] of items.entries()) {
    if (it.at <= now + 5000) continue;
    await schedule(it.title, it.body, it.at, `morning${i}`).catch(() => {});
    n++;
  }
  return n;
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function testNotification(delaySec = 10) {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Test TrailPacer', body: 'Si tu lis ceci écran verrouillé, les alertes marchent.', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySec, channelId: CHANNEL },
  });
}
