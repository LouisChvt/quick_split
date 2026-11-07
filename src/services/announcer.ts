// Annonceur : décide quoi dire et quand. Appelé chaque seconde au premier plan,
// et à chaque position GPS en arrière-plan (seul moment où le JS tourne écran verrouillé).
import { dueEvents, nextCutoff, statusSpeech } from '../core/events';
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
    // longues courses : iOS ne garde que 64 notifications, on complète avant épuisement
    if (session.scheduledHorizonT != null && elapsed > session.scheduledHorizonT - 1800) {
      const next = { ...session, scheduledAt: now };
      const horizon = await scheduleRaceNotifications(plan, next, now).catch(() => null);
      await setSession({ ...next, scheduledHorizonT: horizon }, 'now');
      return;
    }
    const kmNow = estimateKm(plan, elapsed, session.anchor);
    const cut = fresh ? nextCutoff(plan, kmNow, delta, session.startMs) : null;
    const cutTxt = cut
      ? cut.marginSec < 0
        ? ` Attention : au rythme actuel, la barrière de ${cut.aid.name} est dépassée de ${durSpeech(-cut.marginSec)}.`
        : cut.marginSec < 90 * 60
          ? ` Marge sur la barrière de ${cut.aid.name} : ${durSpeech(cut.marginSec)}.`
          : ''
      : '';
    // alerte unique si une barrière devient serrée (< 20 min)
    if (cut && cut.marginSec < 20 * 60) {
      const id = `cutoffwarn-${cut.aid.name}-${cut.aid.km}`;
      if (!done.has(id)) {
        say(`Barrière horaire ${cut.aid.name} à ${clockSpeech(cut.cutoffMs)}.${cutTxt}`);
        done.add(id);
        await setSession({ ...session, done: [...done] }, 'now');
        return;
      }
    }
    const { due, stale } = dueEvents(raceEvents(plan, session.startMs), elapsed, delta, done);
    if (!due.length && !stale.length) {
      // point de situation périodique
      const every = prefs.statusEveryMin * 60;
      if (every > 0 && fresh && elapsed - (session.lastStatusT ?? 0) >= every) {
        say(statusSpeech(plan, kmNow, delta, session.startMs) + cutTxt);
        await setSession({ ...session, lastStatusT: elapsed }, 'soon');
      }
      return;
    }
    const parts: string[] = [];
    for (const e of due) {
      let txt = e.speech;
      if (e.kind === 'landmark' || e.kind === 'aid') {
        txt += fresh
          ? ` ${deltaSpeech(delta)}. Arrivée projetée ${durSpeech(projectedFinish(plan, delta))}.${cutTxt}`
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
    // après un long trou sans position, l'estimation a pu dériver : on la pondère moins
    const lastAt = session.anchor?.at ?? session.startMs;
    const penalty = ts - lastAt > 20 * 60 * 1000 ? 10 : 40;
    const res = snapToTrack(plan.course.snap, lat, lon, est, penalty);
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
      const horizon = await scheduleRaceNotifications(plan, next, ts).catch(() => null);
      next = { ...next, scheduledHorizonT: horizon };
      await setSession(next, 'now');
    } else {
      await setSession(next, 'soon');
    }
  }).then(() => tick(ts));
}
