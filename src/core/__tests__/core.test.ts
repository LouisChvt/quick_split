import { describe, expect, it } from 'vitest';
import { demoGpx } from '../demo';
import { buildEvents, dueAt, dueEvents } from '../events';
import { chrono, clock, deltaSpeech, deltaStr, durHM, parseDuration, parsePace, plannedStartMs } from '../format';
import { buildCourse, looksLikeAidStation, parseGpx } from '../gpx';
import { DEFAULT_MODEL, descentFactor, solveEffort, timeProfile, upCost } from '../model';
import { buildPlan, DEFAULT_RACE } from '../plan';
import { deltaFromAnchor, estimateKm, kmAt, snapToTrack, tAtKm } from '../position';
import { validatePlan } from '../validate';
import type { Course, Plan } from '../types';

const course: Course = buildCourse(parseGpx(demoGpx()));

function demoPlan(overrides: Partial<typeof DEFAULT_RACE> = {}): Plan {
  return buildPlan({
    course,
    race: { ...DEFAULT_RACE, name: 'Démo', date: '2026-11-07', startTime: '10:40', targetSec: 2 * 3600 + 15 * 60, ...overrides },
    athlete: { hrMax: 196, hrRest: 51, wattsPerMps: 88.5, flatPaceSecPerKm: 300 },
    aidStations: course.waypoints
      .filter((w) => looksLikeAidStation(w.name))
      .map((w) => ({ name: w.name, km: w.km, stopSec: 45 })),
  });
}

describe('format', () => {
  it('formate les heures en « 11h03 »', () => {
    expect(clock(new Date(2026, 10, 7, 11, 3).getTime())).toBe('11h03');
    expect(durHM(3 * 3600 + 20 * 60)).toBe('3h20');
    expect(durHM(42 * 60)).toBe('42 min');
    expect(chrono(3754)).toBe('1:02:34');
    expect(deltaStr(80)).toBe('+1:20');
    expect(deltaStr(-40)).toBe('−0:40');
    expect(deltaSpeech(80)).toBe('1 minute 20 de retard');
    expect(deltaSpeech(-40)).toBe("40 secondes d'avance");
  });
  it('lit les durées et allures saisies', () => {
    expect(parseDuration('3h20')).toBe(12000);
    expect(parseDuration('3:20')).toBe(12000);
    expect(parseDuration('3:20:30')).toBe(12030);
    expect(parseDuration('200')).toBe(12000);
    expect(parsePace("5'20")).toBe(320);
    expect(plannedStartMs('2026-11-07', '10:40')).toBe(new Date(2026, 10, 7, 10, 40).getTime());
  });
});

describe('gpx', () => {
  it('parse la trace, les waypoints et rééchantillonne à 10 m', () => {
    expect(course.points.length).toBeGreaterThan(1000);
    expect(course.points[1].d - course.points[0].d).toBeCloseTo(10, 5);
    expect(course.totalM).toBeGreaterThan(15000);
    expect(course.gainM).toBeGreaterThan(200);
    expect(course.gainM).toBeLessThan(course.rawGainM + 1);
    expect(course.waypoints).toHaveLength(2);
    expect(course.waypoints[0].offTrackM).toBeLessThan(30);
  });
  it('lit les attributs en simple quote et sans altitude', () => {
    const raw = parseGpx(
      "<gpx><trk><trkseg><trkpt lon='4.0' lat='44.0'/><trkpt lon='4.01' lat='44.0'/></trkseg></trk></gpx>",
    );
    expect(raw.points).toHaveLength(2);
    const c = buildCourse(raw);
    expect(c.hasElevation).toBe(false);
    expect(c.totalM).toBeGreaterThan(700);
  });
  it('reconnaît les ravitos', () => {
    expect(looksLikeAidStation('Ravito Argilliers')).toBe(true);
    expect(looksLikeAidStation('R2 Castillon')).toBe(true);
    expect(looksLikeAidStation('Belvédère')).toBe(false);
  });
});

describe('modèle', () => {
  it('coût en montée et facteur de descente', () => {
    expect(upCost(0, DEFAULT_MODEL)).toBe(1);
    expect(upCost(10, DEFAULT_MODEL)).toBeCloseTo(1.57, 2);
    expect(descentFactor(-5)).toBeCloseTo(1.125, 3);
    expect(descentFactor(-25)).toBeLessThan(1);
  });
  it('le solveur retrouve le temps visé', () => {
    const { e } = solveEffort(course.points, 7200, DEFAULT_MODEL, [], () => 1);
    expect(timeProfile(course.points, e, DEFAULT_MODEL, [], () => 1).total).toBeCloseTo(7200, 0);
  });
});

describe('plan', () => {
  const plan = demoPlan();
  it('respecte objectif et fenêtre', () => {
    expect(plan.scenarios.target.totalSec).toBeCloseTo(8100, 0);
    expect(plan.scenarios.fast.totalSec).toBeCloseTo(8100 * 0.99, 0);
    expect(plan.scenarios.slow.totalSec).toBeCloseTo(8100 * 1.01, 0);
    const t = plan.scenarios.target.times;
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });
  it('produit 5 phases contiguës avec 6 repères chiffrés', () => {
    expect(plan.phases).toHaveLength(5);
    expect(plan.phases[0].fromKm).toBe(0);
    expect(plan.phases[4].toKm).toBeCloseTo(plan.course.totalM / 1000, 6);
    plan.phases.forEach((p, i) => {
      expect(p.tiles).toHaveLength(6);
      if (i > 0) expect(p.fromKm).toBeCloseTo(plan.phases[i - 1].toKm, 6);
      expect(p.hr![0]).toBeLessThan(p.hr![1]);
    });
    expect(plan.phases[0].watts).toBeLessThan(plan.phases[4].watts!);
  });
  it('a des repères triés, des ravitos et des gels', () => {
    expect(plan.landmarks[0].kind).toBe('start');
    expect(plan.landmarks[plan.landmarks.length - 1].kind).toBe('finish');
    expect(plan.landmarks.filter((l) => l.kind === 'aid')).toHaveLength(2);
    plan.landmarks.forEach((l) => {
      expect(l.tFast).toBeLessThanOrEqual(l.tTarget + 1e-6);
      expect(l.tTarget).toBeLessThanOrEqual(l.tSlow + 1e-6);
    });
    expect(plan.fuel.filter((f) => f.tSec > 0).length).toBe(Math.floor((8100 - 600) / 1800));
    expect(plan.feasibility.verdict).not.toBe('inconnu');
  });
  it('est sérialisable et ré-importable', () => {
    const back = validatePlan(JSON.parse(JSON.stringify(plan)));
    expect(back.scenarios.target.totalSec).toBe(plan.scenarios.target.totalSec);
    expect(() => validatePlan({ version: 2 })).toThrow();
  });
});

describe('position', () => {
  const plan = demoPlan();
  it('kmAt et tAtKm sont inverses', () => {
    for (const k of [0.5, 5, 10.3, 18]) expect(kmAt(plan, tAtKm(plan, k))).toBeCloseTo(k, 2);
  });
  it('estime la position et l’écart depuis un recalage', () => {
    const t10 = tAtKm(plan, 10);
    const anchor = { t: t10 + 80, km: 10, source: 'manual' as const, at: 0 };
    expect(deltaFromAnchor(plan, anchor)).toBeCloseTo(80, 3);
    // 10 min plus tard, on avance au rythme du plan depuis le km 10
    const k = estimateKm(plan, anchor.t + 600, anchor);
    expect(k).toBeCloseTo(kmAt(plan, t10 + 600), 3);
  });
  it('projette le GPS sur la trace et lève l’ambiguïté départ / arrivée de la boucle', () => {
    const start = plan.course.snap[0];
    // près du départ (= arrivée) : en début de course on doit trouver ~0 km
    const early = snapToTrack(plan.course.snap, start.lat, start.lon, 0.3);
    expect(early!.km).toBeLessThan(1);
    // même point en fin de course : on doit trouver la fin
    const total = plan.course.totalM / 1000;
    const late = snapToTrack(plan.course.snap, start.lat, start.lon, total - 0.4);
    expect(late!.km).toBeGreaterThan(total - 1);
    // trop loin de la trace : rejet
    expect(snapToTrack(plan.course.snap, start.lat, start.lon + 0.01, 0)).toBeNull();
  });
});

describe('événements', () => {
  const plan = demoPlan();
  const startMs = new Date(2026, 10, 7, 10, 40).getTime();
  const events = buildEvents(plan, startMs);
  it('couvre départ, phases, gels, ravitos, repères et final', () => {
    const kinds = new Set(events.map((e) => e.kind));
    for (const k of ['start', 'phase', 'gel', 'aidSoon', 'aid', 'final']) expect(kinds.has(k as never)).toBe(true);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
  it('décale les événements « km » selon l’écart, pas les gels', () => {
    const gel = events.find((e) => e.kind === 'gel')!;
    const ph = events.find((e) => e.kind === 'phase')!;
    expect(dueAt(gel, 120)).toBe(gel.tSec);
    expect(dueAt(ph, 120)).toBe(ph.tSec + 120);
  });
  it('sépare les événements dus et les événements manqués', () => {
    const done = new Set<string>();
    const gel = events.find((e) => e.kind === 'gel')!;
    const { due } = dueEvents(events, gel.tSec + 5, 0, done);
    expect(due.map((e) => e.id)).toContain(gel.id);
    const { stale } = dueEvents(events, gel.tSec + 1000, 0, done);
    expect(stale.map((e) => e.id)).toContain(gel.id);
  });
});
