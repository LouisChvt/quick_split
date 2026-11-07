// Actions de course déclenchées par l'interface.
import { deltaFromAnchor, estimateKm, snapToTrack } from '../core/position';
import { statusSpeech } from '../core/events';
import { getState, setSession } from '../state/store';
import type { RaceSession } from '../state/types';
import { onPosition, tick } from './announcer';
import { currentPosition, startGps, stopGps } from './location';
import { cancelAllNotifications, ensureNotificationPermission, scheduleRaceNotifications } from './notifications';
import { configureAudio, say } from './speech';

async function reschedule(s: RaceSession) {
  const { plan } = getState();
  if (!plan) return;
  const next = { ...s, scheduledDelta: deltaFromAnchor(plan, s.anchor), scheduledAt: Date.now() };
  const horizon = await scheduleRaceNotifications(plan, next).catch(() => null);
  await setSession({ ...next, scheduledHorizonT: horizon }, 'now');
}

/** Départ réel : toutes les alertes se calent sur cet instant. */
export async function startRace(now = Date.now()) {
  const { plan, prefs } = getState();
  if (!plan) return;
  await configureAudio();
  await ensureNotificationPermission().catch(() => false);
  const session: RaceSession = { startMs: now, anchor: null, done: [], gpsOn: prefs.gpsByDefault };
  await setSession(session, 'now');
  await reschedule(session);
  if (session.gpsOn) {
    const perm = await startGps().catch(() => 'denied' as const);
    if (perm === 'denied') await setSession({ ...getState().session!, gpsOn: false });
  }
  await tick(now);
}

/** Corrige l'heure de départ (appui en retard ou en avance sur « Départ »). */
export async function shiftStart(seconds: number) {
  const s = getState().session;
  if (!s) return;
  // les annonces déjà faites le restent (pas de répétition)
  const next = { ...s, startMs: s.startMs - seconds * 1000 };
  // les recalages restent valables en position, mais leur temps de course change
  if (next.anchor) next.anchor = { ...next.anchor, t: next.anchor.t + seconds };
  await reschedule(next);
}

export async function finishRace() {
  const s = getState().session;
  if (!s) return;
  await stopGps();
  await cancelAllNotifications().catch(() => {});
  await setSession({ ...s, finishedAt: Date.now(), gpsOn: false });
  say('Bravo ! Course terminée.');
}

export async function cancelRace() {
  await stopGps();
  await cancelAllNotifications().catch(() => {});
  await setSession(null);
}

/** Recalage manuel : km lu sur la montre (converti en km de trace) ou repère touché. */
export async function recalibrate(km: number, source: 'manual' | 'landmark', now = Date.now()) {
  const { plan, session } = getState();
  if (!plan || !session) return;
  const elapsed = (now - session.startMs) / 1000;
  const totalKm = plan.course.totalM / 1000;
  const anchor = { t: elapsed, km: Math.max(0, Math.min(totalKm, km)), source, at: now };
  await reschedule({ ...session, anchor });
  const delta = deltaFromAnchor(plan, anchor);
  say(`Recalé. ${statusSpeech(plan, anchor.km, delta, session.startMs)}`);
}

/** Recalage ponctuel par le GPS (sans suivi continu). */
export async function recalibrateFromGps(): Promise<string> {
  const { plan, session } = getState();
  if (!plan || !session) return 'Aucune course en cours.';
  const pos = await currentPosition();
  if (!pos) return 'Localisation refusée.';
  const elapsed = (pos.timestamp - session.startMs) / 1000;
  const est = estimateKm(plan, elapsed, session.anchor);
  const res = snapToTrack(plan.course.snap, pos.coords.latitude, pos.coords.longitude, est);
  if (!res) return 'Tu sembles à plus de 250 m de la trace : recalage ignoré.';
  await recalibrate(res.km, 'manual', pos.timestamp);
  return `Recalé au km ${res.km.toFixed(2)} (à ${Math.round(res.distM)} m de la trace).`;
}

export async function setGps(on: boolean): Promise<string | null> {
  const s = getState().session;
  if (!s) return null;
  if (on) {
    const perm = await startGps().catch(() => 'denied' as const);
    if (perm === 'denied') return 'Localisation refusée : active-la dans les réglages du téléphone.';
    await setSession({ ...getState().session!, gpsOn: true });
    return perm === 'foreground'
      ? 'GPS actif seulement app ouverte : autorise « Toujours » pour l’écran verrouillé.'
      : null;
  }
  await stopGps();
  await setSession({ ...getState().session!, gpsOn: false });
  return null;
}

/** Point de situation immédiat. */
export function announceNow(now = Date.now()) {
  const { plan, session } = getState();
  if (!plan || !session) return;
  const elapsed = (now - session.startMs) / 1000;
  say(statusSpeech(plan, estimateKm(plan, elapsed, session.anchor), deltaFromAnchor(plan, session.anchor), session.startMs), true);
}

/** Relance après redémarrage de l'app : GPS et alertes. */
export async function resumeIfRunning() {
  const { plan, session } = getState();
  if (!plan || !session || session.finishedAt) return;
  await configureAudio();
  if (session.gpsOn) await startGps().catch(() => {});
  await reschedule(session);
}

export { onPosition };
