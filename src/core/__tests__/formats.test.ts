// Robustesse « n'importe quel GPX, n'importe quelle course » : ultra de montagne, nuit,
// barrières horaires, aller-retour, GPX multi-tracés, espaces de noms, stockage compact.
import { describe, expect, it } from 'vitest';
import { buildEvents, nextCutoff } from '../events';
import { buildCourse, packCourse, parseGpx, unpackCourse } from '../gpx';
import { fatigueForDuration } from '../model';
import { buildPlan, DEFAULT_RACE, raceFormat } from '../plan';
import { snapToTrack, tAtKm } from '../position';
import { sunTimes } from '../sun';
import { DEFAULT_MODEL } from '../model';

/** Ultra synthétique : ~110 km, aller vers le nord puis retour par le même chemin sur 20 km, gros D+. */
function ultraGpx(prefix = '') {
  const pts: string[] = [];
  const n = 11000;
  const lat0 = 45.9;
  const lon0 = 6.86;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // 0 → 0,8 : boucle large ; 0,8 → 0,9 : aller ; 0,9 → 1 : retour sur l'aller (aller-retour)
    let lat: number;
    let lon: number;
    if (u < 0.8) {
      const a = (u / 0.8) * 2 * Math.PI;
      lat = lat0 + 0.12 * Math.sin(a);
      lon = lon0 + 0.17 * (1 - Math.cos(a));
    } else {
      const v = u < 0.9 ? (u - 0.8) / 0.1 : 1 - (u - 0.9) / 0.1;
      lat = lat0 - 0.09 * v;
      lon = lon0;
    }
    const ele = 1000 + 900 * Math.sin(9 * Math.PI * u) ** 2 + 300 * Math.sin(2 * Math.PI * u);
    pts.push(`<${prefix}trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><${prefix}ele>${ele.toFixed(1)}</${prefix}ele></${prefix}trkpt>`);
  }
  return `<?xml version="1.0"?><${prefix}gpx version="1.1"><${prefix}trk><${prefix}name>Ultra test</${prefix}name><${prefix}trkseg>${pts.join('')}</${prefix}trkseg></${prefix}trk></${prefix}gpx>`;
}

describe('ultra de montagne', () => {
  const t0 = Date.now();
  const course = buildCourse(parseGpx(ultraGpx()));
  const parseMs = Date.now() - t0;
  const target = 22 * 3600;
  const aids = [
    { name: 'Base de vie', km: 50, stopSec: 900, cutoffClock: '23:30' },
    { name: 'Ravito col', km: 80, stopSec: 300, cutoffClock: '06:00' },
  ];
  const t1 = Date.now();
  const plan = buildPlan({
    course,
    race: { ...DEFAULT_RACE, name: 'Ultra', date: '2026-06-26', startTime: '05:00', targetSec: target, gelIntervalMin: 40, fuelLabel: 'Prise' },
    athlete: { hrMax: 185, hrRest: 50 },
    model: { ...DEFAULT_MODEL, fatigue: fatigueForDuration(target) },
    aidStations: aids,
  });
  const buildMs = Date.now() - t1;

  it('lit et planifie un ultra rapidement', () => {
    expect(course.totalM).toBeGreaterThan(90000);
    expect(course.gainM).toBeGreaterThan(5000);
    expect(parseMs + buildMs).toBeLessThan(15000);
    expect(plan.scenarios.target.totalSec).toBeCloseTo(target, -1);
  });

  it('adapte le format, les phases et la checklist', () => {
    expect(raceFormat(target)).toBe('ultra');
    expect(plan.format).toBe('ultra');
    expect(plan.phases[0].name).toBe('Mise en jambes');
    expect(plan.phases[2].hr![1]).toBeLessThan(160);
    expect(plan.checklist.some((c) => c.includes('Frontale'))).toBe(true);
    expect(plan.fuel[1].label).toBe('Prise 1');
  });

  it('résout les barrières horaires au bon jour', () => {
    const base = aids.map((a) => plan.aidStations.find((x) => x.name === a.name)!);
    // 23h30 le jour même (18h30 après le départ), 6h00 le lendemain (25h après)
    expect(base[0].cutoffSec).toBe(18.5 * 3600);
    expect(base[1].cutoffSec).toBe(25 * 3600);
    const start = new Date(2026, 5, 26, 5, 0).getTime();
    const c = nextCutoff(plan, 10, 0, start)!;
    expect(c.aid.name).toBe('Base de vie');
    expect(c.marginSec).toBeCloseTo(base[0].cutoffSec! - tAtKm(plan, 50), 0);
    expect(plan.feasibility.message).toMatch(/[Bb]arrière/);
  });

  it('annonce la nuit et le lever du jour', () => {
    // départ 2 h avant le coucher du soleil (indépendant du fuseau de la machine de test)
    const p0 = plan.course.snap[0];
    const sun = sunTimes(Date.UTC(2026, 5, 26, 12), p0.lat, p0.lon)!;
    const start = sun.sunset - 2 * 3600 * 1000;
    const ev = buildEvents(plan, start);
    const night = ev.find((e) => e.kind === 'night')!;
    expect(night.tSec).toBeCloseTo(2 * 3600 - 20 * 60, -1);
    expect(ev.some((e) => e.kind === 'day')).toBe(true);
    expect(ev.length).toBeGreaterThan(60); // au-delà de la limite iOS : complété au fil de la course
  });

  it('distingue l’aller et le retour d’un aller-retour', () => {
    const snap = plan.course.snap;
    // demi-tour = point le plus au sud de la fin de parcours
    const tail = snap.filter((p) => p.d > plan.course.totalM * 0.75);
    const turn = tail.reduce((a, b) => (b.lat < a.lat ? b : a)).d / 1000;
    const kmOut = turn - 3;
    const pOut = snap.find((p) => p.d / 1000 >= kmOut)!;
    const out = snapToTrack(snap, pOut.lat, pOut.lon, kmOut + 0.5)!;
    const back = snapToTrack(snap, pOut.lat, pOut.lon, turn + 2.5)!;
    expect(out.km).toBeCloseTo(kmOut, 1);
    expect(back.km).toBeGreaterThan(turn);
    expect(Math.abs(back.km - (2 * turn - kmOut))).toBeLessThan(0.3);
  });

  it('stocke la trace de façon compacte et sans perte utile', () => {
    const packed = packCourse(course);
    const json = JSON.stringify(packed);
    expect(json.length).toBeLessThan(JSON.stringify(course).length * 0.6);
    const back = unpackCourse(JSON.parse(json));
    expect(back.points.length).toBe(course.points.length);
    expect(back.points[5000].d).toBeCloseTo(course.points[5000].d, 3);
    expect(back.points[5000].ele).toBeCloseTo(course.points[5000].ele, 0);
  });
});

describe('GPX variés', () => {
  it('accepte les balises préfixées par un espace de noms', () => {
    const raw = parseGpx(ultraGpx('gpx:').slice(0, 200000) + '</gpx:trkseg></gpx:trk></gpx:gpx>');
    expect(raw.points.length).toBeGreaterThan(100);
    expect(raw.points[0].ele).not.toBeNull();
  });
  it('enchaîne des tracés bout à bout et garde le plus long parmi des variantes', () => {
    const seg = (lat0: number, n: number) =>
      `<trk><trkseg>${Array.from({ length: n }, (_, i) => `<trkpt lat="${lat0 + i * 0.001}" lon="4"><ele>100</ele></trkpt>`).join('')}</trkseg></trk>`;
    const chained = parseGpx(`<gpx>${seg(44, 50)}${seg(44.049, 50)}</gpx>`);
    expect(chained.points).toHaveLength(100);
    expect(chained.warnings[0]).toMatch(/enchaînés/);
    const variants = parseGpx(`<gpx>${seg(44, 50)}${seg(46, 80)}</gpx>`);
    expect(variants.points).toHaveLength(80);
    expect(variants.warnings[0]).toMatch(/plus long/);
  });
  it('accepte une route (rte) à défaut de trace', () => {
    const raw = parseGpx('<gpx><rte><rtept lat="44" lon="4"/><rtept lat="44.01" lon="4"/></rte></gpx>');
    expect(raw.points).toHaveLength(2);
  });
  it('gère une course courte', () => {
    const c = buildCourse(parseGpx(`<gpx><trk><trkseg>${Array.from({ length: 45 }, (_, i) => `<trkpt lat="${44 + i * 0.0009}" lon="4"><ele>${100 + (i % 20)}</ele></trkpt>`).join('')}</trkseg></trk></gpx>`));
    const plan = buildPlan({ course: c, race: { ...DEFAULT_RACE, date: '2026-05-01', startTime: '09:00', targetSec: 40 * 60 }, athlete: {}, aidStations: [] });
    expect(c.totalM).toBeLessThan(6000);
    expect(plan.format).toBe('court');
    expect(plan.phases).toHaveLength(5);
    expect(buildEvents(plan, Date.now()).some((e) => e.id === 'final5')).toBe(false);
  });
});

describe('soleil', () => {
  it('donne des heures plausibles (Chamonix, solstice d’été)', () => {
    const s = sunTimes(Date.UTC(2026, 5, 21, 12), 45.92, 6.87)!;
    const rise = new Date(s.sunrise).getUTCHours() + new Date(s.sunrise).getUTCMinutes() / 60;
    const set = new Date(s.sunset).getUTCHours() + new Date(s.sunset).getUTCMinutes() / 60;
    expect(rise).toBeGreaterThan(3.5); // ≈ 3h45 UTC (5h45 locale)
    expect(rise).toBeLessThan(4.2);
    expect(set).toBeGreaterThan(19.0); // ≈ 19h25 UTC (21h25 locale)
    expect(set).toBeLessThan(19.8);
  });
});
