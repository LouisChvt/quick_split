// Événements de course : ce qui doit être annoncé (voix) et notifié pendant la course.
// Deux natures :
//  - 'time' : déclenché à un temps de course fixe (gels, rappels boisson) ;
//  - 'km'   : déclenché au passage d'un km ; son heure suit l'écart réel (avance / retard).
import { clock, clockSpeech, deltaSpeech, durSpeech, km as fkm, pace, plannedStartMs } from './format';
import { tAtKm } from './position';
import { sunEventsBetween } from './sun';
import type { Plan, RaceEvent } from './types';

const paceSpeech = (s: number) => {
  const r = Math.round(s);
  const sec = r % 60;
  return `${Math.floor(r / 60)} minutes${sec ? ' ' + (sec < 10 ? '0' : '') + sec : ''} au kilo`;
};

function phaseSpeech(plan: Plan, i: number): string {
  const p = plan.phases[i];
  const parts = [`Phase ${i + 1} sur ${plan.phases.length} : ${p.name}.`, p.objective];
  if (p.hr) parts.push(`Fréquence cardiaque entre ${p.hr[0]} et ${p.hr[1]}.`);
  if (p.watts) parts.push(`Puissance ${p.watts} watts.`);
  else parts.push(`Allure plat ${paceSpeech(p.flatPaceSecPerKm)}.`);
  if (p.watch[0]) parts.push(`À surveiller : ${p.watch[0]}.`);
  return parts.join(' ');
}

function phaseBody(plan: Plan, i: number): string {
  const p = plan.phases[i];
  const bits = [
    p.hr ? `FC ${p.hr[0]}–${p.hr[1]}` : null,
    `plat ${pace(p.flatPaceSecPerKm)}/km`,
    p.watts ? `${p.watts} W` : null,
    `ressenti ${p.rpe}/10`,
  ].filter(Boolean);
  return `${bits.join(' · ')}. ${p.objective}`;
}

function cutoffNote(plan: Plan, km: number): string {
  const a = plan.aidStations.find((x) => Math.abs(x.km - km) < 0.05 && x.cutoffSec != null);
  const p = plannedStartMs(plan.race.date, plan.race.startTime);
  return a && p != null ? ` Barrière ${clock(p + a.cutoffSec! * 1000)}.` : '';
}

/** Prochaine barrière horaire après le km donné, avec sa marge projetée (s, négatif = dépassée). */
export function nextCutoff(plan: Plan, kmNow: number, delta: number, startMs: number) {
  const p = plannedStartMs(plan.race.date, plan.race.startTime);
  if (p == null) return null;
  const a = plan.aidStations.find((x) => x.cutoffSec != null && x.km > kmNow + 0.05);
  if (!a) return null;
  const cutoffMs = p + a.cutoffSec! * 1000;
  const arrivalMs = startMs + (tAtKm(plan, a.km) + delta) * 1000;
  return { aid: a, cutoffMs, arrivalMs, marginSec: (cutoffMs - arrivalMs) / 1000 };
}

export function buildEvents(plan: Plan, startMs: number): RaceEvent[] {
  const ev: RaceEvent[] = [];
  const totalKm = plan.course.totalM / 1000;

  ev.push({
    id: 'start',
    kind: 'start',
    basis: 'time',
    tSec: 0,
    km: 0,
    title: `C'est parti ! ${plan.phases[0]?.name ?? ''}`,
    body: plan.phases[0] ? phaseBody(plan, 0) : '',
    speech: `C'est parti. ${plan.phases[0] ? phaseSpeech(plan, 0) : ''}`,
  });

  plan.phases.slice(1).forEach((p, k) => {
    const i = k + 1;
    ev.push({
      id: `phase${i}`,
      kind: 'phase',
      basis: 'km',
      tSec: tAtKm(plan, p.fromKm),
      km: p.fromKm,
      title: `Phase ${i + 1}/${plan.phases.length} · ${p.name}`,
      body: phaseBody(plan, i),
      speech: phaseSpeech(plan, i),
    });
  });

  plan.fuel
    .filter((f) => f.tSec > 0)
    .forEach((f) => {
      ev.push({
        id: `fuel-${f.id}`,
        kind: 'gel',
        basis: 'time',
        tSec: f.tSec,
        km: f.km,
        title: `${f.label} maintenant`,
        body: 'Prends ton gel avec quelques gorgées d’eau.',
        speech: `${f.label}. Prends-le maintenant, avec de l'eau.`,
      });
    });

  const drink = plan.race.drinkIntervalMin;
  if (drink > 0) {
    for (let t = drink * 60, k = 1; t < plan.scenarios.target.totalSec - 5 * 60; t += drink * 60, k++) {
      if (plan.fuel.some((f) => Math.abs(f.tSec - t) < 4 * 60)) continue;
      ev.push({
        id: `drink${k}`,
        kind: 'drink',
        basis: 'time',
        tSec: t,
        km: 0,
        title: 'Bois',
        body: 'Quelques gorgées.',
        speech: 'Pense à boire.',
      });
    }
  }

  plan.aidStations.forEach((a, i) => {
    if (a.km <= 0.6) return;
    const k = a.km - 0.5;
    ev.push({
      id: `aidSoon${i}`,
      kind: 'aidSoon',
      basis: 'km',
      tSec: tAtKm(plan, k),
      km: k,
      title: `${a.name} dans 500 m`,
      body: `${a.stopSec >= 120 ? `${Math.round(a.stopSec / 60)} min` : `${a.stopSec} s`} d'arrêt max : remplis, mange, repars.`,
      speech: `${a.name} dans 500 mètres. ${
        a.stopSec >= 120 ? `${Math.round(a.stopSec / 60)} minutes` : `${a.stopSec} secondes`
      } d'arrêt maximum : remplis, mange, repars.`,
    });
  });

  plan.landmarks
    .filter((l) => l.kind !== 'start' && l.kind !== 'finish')
    .forEach((l) => {
      ev.push({
        id: `lm-${l.id}`,
        kind: l.kind === 'aid' ? 'aid' : 'landmark',
        basis: 'km',
        tSec: l.tTarget,
        km: l.km,
        title: `${l.name} · km ${fkm(l.km)}`,
        body:
          `Passage prévu ${clock(startMs + l.tTarget * 1000)} (fenêtre ${clock(startMs + l.tFast * 1000)}–${clock(
            startMs + l.tSlow * 1000,
          )}).` + cutoffNote(plan, l.km),
        speech: `${l.name}, kilomètre ${fkm(l.km)}.`,
      });
    });

  // nuit et jour : frontale avant le coucher du soleil, rangement au lever
  const first = plan.course.snap[0];
  const total = plan.scenarios.slow.totalSec;
  if (first) {
    sunEventsBetween(startMs, startMs + total * 1000, first.lat, first.lon).forEach((s, i) => {
      const t = (s.at - startMs) / 1000;
      if (s.kind === 'sunset') {
        const at = Math.max(60, t - 20 * 60);
        ev.push({
          id: `night${i}`,
          kind: 'night',
          basis: 'time',
          tSec: at,
          km: 0,
          title: `Nuit à ${clock(s.at)}`,
          body: 'Sors ta frontale maintenant, avant de ne plus voir les appuis.',
          speech: `La nuit tombe dans ${Math.round((t - at) / 60)} minutes. Sors ta frontale maintenant et couvre-toi si besoin.`,
        });
      } else {
        ev.push({
          id: `day${i}`,
          kind: 'day',
          basis: 'time',
          tSec: t,
          km: 0,
          title: `Lever du soleil · ${clock(s.at)}`,
          body: 'Le jour se lève : le coup de fatigue de fin de nuit va passer. Mange quelque chose.',
          speech: 'Le jour se lève. Le coup de fatigue de fin de nuit va passer : mange quelque chose.',
        });
      }
    });
  }

  const finals: [number, string][] = [
    [5, 'Plus que 5 kilomètres. Commence à relancer.'],
    [3, "Plus que 3 kilomètres. Accélère d'un cran."],
    [2, 'Plus que 2 kilomètres. Tiens bon, cadence rapide.'],
    [1, 'Dernier kilomètre. Tout ce qui reste !'],
  ];
  finals.forEach(([r, txt]) => {
    if (totalKm <= r + 1) return;
    const k = totalKm - r;
    ev.push({
      id: `final${r}`,
      kind: 'final',
      basis: 'km',
      tSec: tAtKm(plan, k),
      km: k,
      title: `Plus que ${r} km`,
      body: txt,
      speech: txt,
    });
  });

  return ev.sort((a, b) => a.tSec - b.tSec);
}

/** Temps de course (s) auquel l'événement doit tomber, compte tenu de l'écart actuel. */
export function dueAt(e: RaceEvent, delta: number): number {
  return e.basis === 'km' ? e.tSec + delta : e.tSec;
}

/** Événements à annoncer maintenant ; ceux trop anciens (manqués) sont rendus à part. */
export function dueEvents(
  events: RaceEvent[],
  elapsed: number,
  delta: number,
  done: Set<string>,
  graceSec = 120,
): { due: RaceEvent[]; stale: RaceEvent[] } {
  const due: RaceEvent[] = [];
  const stale: RaceEvent[] = [];
  for (const e of events) {
    if (done.has(e.id)) continue;
    const at = dueAt(e, delta);
    if (at > elapsed) continue;
    if (at < elapsed - graceSec) stale.push(e);
    else due.push(e);
  }
  return { due, stale };
}

/** Phrase de point de situation : « Kilomètre 18,2. 40 secondes d'avance. Arrivée projetée 3 heures 19. » */
export function statusSpeech(plan: Plan, kmNow: number, delta: number, startMs: number): string {
  const proj = plan.scenarios.target.totalSec + delta;
  return `Kilomètre ${fkm(kmNow)}. ${deltaSpeech(delta)}. Arrivée projetée ${durSpeech(proj)}, vers ${clockSpeech(
    startMs + proj * 1000,
  )}.`;
}
