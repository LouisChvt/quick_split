// Annonceur : décide quoi dire et quand. Appelé chaque seconde au premier plan,
// et à chaque position GPS en arrière-plan (seul moment où le JS tourne écran verrouillé).
import { dueEvents, statusSpeech } from '../core/events';
import { clockSpeech, deltaSpeech, durSpeech } from '../core/format';
import { deltaFromAnchor, estimateKm, projectedFinish, snapToTrack } from '../core/position';
import { ensureLoaded, getState, raceEvents, setSession } from '../state/store';
import { scheduleRaceNotifications } from './notifications';
import { say } from './speech';

/** Une position est « fraîche » si le dernier recalage date de moins de 3 min. */
const FRESH_MS = 3 * 60 * 1000;

let chain: Promise<void> = Promise.resolve();
/** Sérialise les appels (tick UI et tick GPS peuvent se croiser). */
function serial(fn: () => Promise<void>): Promise<void> {
  chain = chain.then(fn, fn).catch(() => {});
  return chain;
}

export function tick(now = Date.now()): Promise<void> {
  return serial(async () => {
    await ensureLoaded();
    const { plan, session, prefs } = getState();
    if (!plan || !session || session.finishedAt) return;
    const elapsed = (now - session.startMs) / 1000;
    if (elapsed < 0) return;
    const delta = deltaFromAnchor(plan, session.anchor);
    const fresh = !!session.anchor && now - session.anchor.at < FRESH_MS;
    const done = new Set(session.done);
    const { due, stale } = dueEvents(raceEvents(plan, session.startMs), elapsed, delta, done);
    if (!due.length && !stale.length) {
      // point de situation périodique
      const every = prefs.statusEveryMin * 60;
      if (every > 0 && fresh && elapsed - (session.lastStatusT ?? 0) >= every) {
        say(statusSpeech(plan, estimateKm(plan, elapsed, session.anchor), delta, session.startMs));
        await setSession({ ...session, lastStatusT: elapsed }, 'soon');
      }
      return;
    }
    const parts: string[] = [];
    for (const e of due) {
      let txt = e.speech;
      if (e.kind === 'landmark' || e.kind === 'aid') {
        txt += fresh
          ? ` ${deltaSpeech(delta)}. Arrivée projetée ${durSpeech(projectedFinish(plan, delta))}.`
          : ` Passage prévu à ${clockSpeech(session.startMs + e.tSec * 1000)}.`;
      }
      parts.push(txt);
    }
    if (parts.length) say(parts.join(' '));
    for (const e of [...due, ...stale]) done.add(e.id);
    await setSession(
      { ...session, done: [...done], lastStatusT: parts.length ? elapsed : session.lastStatusT },
      'now',
    );
  });
}

/** Nouvelle position GPS : projection sur la trace, recalage, éventuelle reprogrammation des alertes. */
export function onPosition(lat: number, lon: number, accuracy: number | null, ts: number): Promise<void> {
  return serial(async () => {
    await ensureLoaded();
    const { plan, session } = getState();
    if (!plan || !session || session.finishedAt || !session.gpsOn) return;
    const elapsed = (ts - session.startMs) / 1000;
    if (elapsed < 0) return;
    if (accuracy != null && accuracy > 60) {
      await setSession({ ...session, lastGps: { at: ts, km: null, distM: null, accuracy } }, 'soon');
      return;
    }
    const est = estimateKm(plan, elapsed, session.anchor);
    const res = snapToTrack(plan.course.snap, lat, lon, est);
    if (!res) {
      await setSession({ ...session, lastGps: { at: ts, km: null, distM: null, accuracy } }, 'soon');
      return;
    }
    const anchor = { t: elapsed, km: res.km, source: 'gps' as const, at: ts };
    let next = { ...session, anchor, lastGps: { at: ts, km: res.km, distM: res.distM, accuracy } };
    const delta = deltaFromAnchor(plan, anchor);
    const drift = Math.abs(delta - (session.scheduledDelta ?? 0));
    if (drift >= 30 && ts - (session.scheduledAt ?? 0) > 120000) {
      next = { ...next, scheduledDelta: delta, scheduledAt: ts };
      await setSession(next, 'now');
      await scheduleRaceNotifications(plan, next, ts).catch(() => {});
    } else {
      await setSession(next, 'soon');
    }
  }).then(() => tick(ts));
}
