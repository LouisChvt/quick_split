// Génération du plan de course complet à partir d'un parcours, d'un objectif et d'un profil coureur.
import { clock, durHM, km as fkm, pace, plannedStartMs } from './format';
import { interp } from './geo';
import { DEFAULT_MODEL, fatigueAt, prepareSegments, solveEffort, timeProfile } from './model';
import type {
  AidStation,
  Athlete,
  Climb,
  Course,
  Feasibility,
  FuelItem,
  Landmark,
  ModelParams,
  Phase,
  Plan,
  RaceSettings,
  Scenario,
  Tile,
} from './types';

interface PhaseTemplate {
  name: string;
  toFrac: number;
  intensity: number;
  /** Fourchette en % de FC de réserve. */
  hrr: [number, number];
  rpe: string;
  objective: string;
  tips: string[];
  watch: string[];
}

export const PHASE_TEMPLATES_STANDARD: PhaseTemplate[] = [
  {
    name: 'Départ maîtrisé',
    toFrac: 0.12,
    intensity: 0.96,
    hrr: [0.6, 0.74],
    rpe: '4–5',
    objective: 'Partir en dedans : te placer, laisser filer, respirer facilement.',
    tips: [
      'Laisse partir les autres, tu les reverras.',
      'Si ça bouchonne, marche : ne relance pas pour doubler.',
      'Tu dois pouvoir parler en phrases complètes.',
    ],
    watch: ["FC qui s'envole avec l'adrénaline du départ", 'Allure plus rapide que prévu sur le plat'],
  },
  {
    name: 'Installation',
    toFrac: 0.4,
    intensity: 1.0,
    hrr: [0.66, 0.8],
    rpe: '5–6',
    objective: "Trouver ton rythme de croisière et t'alimenter à l'heure.",
    tips: ['Premier gel à l’heure, même sans faim.', 'Marche franchement dans les raidards, relance en haut.'],
    watch: ['Quelques gorgées toutes les 10 à 15 min', 'Ne pas suivre un groupe plus rapide'],
  },
  {
    name: 'Cœur de course',
    toFrac: 0.7,
    intensity: 1.0,
    hrr: [0.7, 0.83],
    rpe: '6',
    objective: 'Rester régulier, économiser dans les descentes, ravito rapide.',
    tips: ['Descentes : pas courts, regard loin, bras relâchés.', 'Au ravito : remplir, manger, repartir. Pas de chaise.'],
    watch: ['Baisse de lucidité = manque de sucre : gel', 'Crampes : baisse l’allure, eau et sel'],
  },
  {
    name: 'Tenir',
    toFrac: 0.9,
    intensity: 1.02,
    hrr: [0.74, 0.86],
    rpe: '7',
    objective: 'La course se joue ici : tenir l’allure malgré la fatigue.',
    tips: ['Découpe : vise seulement le prochain repère.', 'Épaules relâchées, cadence courte et rapide.'],
    watch: ['Allure qui s’effrite sur le plat', 'Dernier gel à ne pas oublier'],
  },
  {
    name: 'Final',
    toFrac: 1.0,
    intensity: 1.06,
    hrr: [0.8, 0.95],
    rpe: '8–9',
    objective: 'Tout donner proprement : accélère par paliers jusqu’à l’arrivée.',
    tips: ['Accélère à 3 km, puis encore à 1 km.', 'Regarde loin, bras actifs.'],
    watch: ['Chute en descente par fatigue', 'Ne pas exploser trop tôt'],
  },
];


/** Ultra (> 6 h) : intensité basse, patience, alimentation, nuit. */
export const PHASE_TEMPLATES_ULTRA: PhaseTemplate[] = [
  {
    name: 'Mise en jambes',
    toFrac: 0.1,
    intensity: 0.97,
    hrr: [0.5, 0.65],
    rpe: '3–4',
    objective: 'Partir très en dedans : sur un ultra, chaque minute gagnée ici se paie triple plus tard.',
    tips: ['Marche toutes les montées, même faciles.', 'Tu dois pouvoir discuter sans effort.'],
    watch: ["Euphorie du départ : FC trop haute", 'Bouchons dans les singles : patience'],
  },
  {
    name: 'Installation',
    toFrac: 0.35,
    intensity: 1.0,
    hrr: [0.52, 0.68],
    rpe: '4',
    objective: 'Trouver un rythme que tu pourrais tenir toute la journée, manger dès maintenant.',
    tips: ['Mange avant d’avoir faim : toutes les 30 à 45 min.', 'Bâtons : rythme régulier dans les montées.'],
    watch: ['Hydratation et sel, surtout s’il fait chaud', 'Frottements et échauffements : traite-les tôt'],
  },
  {
    name: 'Cœur de course',
    toFrac: 0.65,
    intensity: 1.0,
    hrr: [0.52, 0.7],
    rpe: '4–5',
    objective: 'Avancer, manger, boire. Ravitos efficaces : une liste en tête avant d’arriver.',
    tips: ['Au ravito : remplis, mange assis 2 min max si besoin, repars.', 'Descentes souples : préserve tes quadriceps.'],
    watch: ['Coup de moins bien = souvent manque de sucre : mange', 'Nausées : ralentis, eau, aliment salé'],
  },
  {
    name: 'Gestion de la fatigue',
    toFrac: 0.88,
    intensity: 1.0,
    hrr: [0.5, 0.7],
    rpe: '5–6',
    objective: 'Tenir le cap malgré la fatigue : la course se gagne en ne s’arrêtant pas.',
    tips: ['Découpe : vise seulement le prochain ravito.', 'Marche active plutôt que course molle en côte.'],
    watch: ['Somnolence de nuit : caféine, conversation, mange', 'Lucidité sur le balisage'],
  },
  {
    name: 'Final',
    toFrac: 1.0,
    intensity: 1.03,
    hrr: [0.55, 0.78],
    rpe: '6–8',
    objective: 'Lâcher ce qu’il reste quand l’arrivée devient sûre.',
    tips: ['Relance sur le plat et les descentes roulantes.', 'Savoure : tu y es presque.'],
    watch: ['Chute par fatigue dans les descentes', 'Dernière prise de sucre 45 min avant la fin'],
  },
];

/** Course courte (< 2 h 30) : plus intense. */
export const PHASE_TEMPLATES_SHORT: PhaseTemplate[] = PHASE_TEMPLATES_STANDARD.map((t) => ({
  ...t,
  hrr: [Math.min(0.92, t.hrr[0] + 0.05), Math.min(0.97, t.hrr[1] + 0.04)] as [number, number],
}));

export type RaceFormat = 'court' | 'standard' | 'ultra';

export function raceFormat(targetSec: number): RaceFormat {
  if (targetSec < 2.5 * 3600) return 'court';
  if (targetSec <= 6 * 3600) return 'standard';
  return 'ultra';
}

export function phaseTemplates(targetSec: number): PhaseTemplate[] {
  const f = raceFormat(targetSec);
  return f === 'ultra' ? PHASE_TEMPLATES_ULTRA : f === 'court' ? PHASE_TEMPLATES_SHORT : PHASE_TEMPLATES_STANDARD;
}

/** Bornes hautes Z1..Z5 par défaut, en % de FC de réserve. */
export const DEFAULT_ZONE_HRR = [0.6, 0.75, 0.85, 0.9, 0.95];

export function hrZones(a: Athlete): number[] | null {
  if (a.hrZones && a.hrZones.length === 5) return a.hrZones;
  if (!a.hrMax) return null;
  const rest = a.hrRest ?? 60;
  return DEFAULT_ZONE_HRR.map((p) => Math.round(rest + p * (a.hrMax! - rest)));
}

function zoneOf(hr: number, zones: number[]): number {
  for (let i = 0; i < zones.length; i++) if (hr <= zones[i]) return i + 1;
  return 6;
}

export const DEFAULT_RACE: RaceSettings = {
  name: 'Ma course',
  date: '',
  startTime: '09:00',
  targetSec: 3 * 3600,
  windowPct: 1,
  gelIntervalMin: 30,
  gel0MinBefore: 15,
  drinkIntervalMin: 0,
  watchFactor: 1,
};

export interface BuildInput {
  course: Course;
  race: RaceSettings;
  athlete: Athlete;
  model?: ModelParams;
  aidStations: AidStation[];
}

export function buildPlan(input: BuildInput): Plan {
  const { course, race, athlete } = input;
  const model = input.model ?? DEFAULT_MODEL;
  const pts = course.points;
  const totalM = course.totalM;
  const totalKm = totalM / 1000;
  const aids = input.aidStations
    .filter((a) => a.km > 0 && a.km < totalKm)
    .sort((a, b) => a.km - b.km);

  // 1) phases : bornes par fraction, recalées sur un ravito proche
  const PHASE_TEMPLATES = phaseTemplates(race.targetSec);
  const format = raceFormat(race.targetSec);
  const bounds: number[] = [];
  let prev = 0;
  PHASE_TEMPLATES.forEach((tpl, i) => {
    let b = tpl.toFrac * totalKm;
    if (i < PHASE_TEMPLATES.length - 1) {
      const near = aids.find((a) => Math.abs(a.km - b) <= 0.04 * totalKm);
      if (near) b = near.km;
      b = Math.max(b, prev + 0.05 * totalKm);
    } else b = totalKm;
    bounds.push(b);
    prev = b;
  });
  const phaseIdxAt = (dM: number) => {
    const k = dM / 1000;
    for (let i = 0; i < bounds.length; i++) if (k <= bounds[i] + 1e-9) return i;
    return bounds.length - 1;
  };
  const intensityAt = (dM: number) => PHASE_TEMPLATES[phaseIdxAt(dM)].intensity;

  // 2) scénarios
  const step = 100;
  const nGrid = Math.floor(totalM / step) + 1 + (totalM % step > 0 ? 1 : 0);
  const gridM = Array.from({ length: nGrid }, (_, i) => Math.min(i * step, totalM));
  const ds = pts.map((p) => p.d);
  const seg = prepareSegments(pts, model, aids, intensityAt);
  const mkScenario = (key: Scenario['key'], target: number) => {
    const { e, reachable } = solveEffort(pts, target, model, aids, intensityAt, seg);
    const prof = timeProfile(pts, e, model, aids, intensityAt, seg);
    const times = gridM.map((d) => interp(ds, prof.t, d));
    times[times.length - 1] = prof.total;
    return { sc: { key, totalSec: prof.total, effort: e, times } as Scenario, reachable, t: prof.t };
  };
  const w = race.windowPct / 100;
  const tgt = mkScenario('target', race.targetSec);
  const fast = mkScenario('fast', race.targetSec * (1 - w));
  const slow = mkScenario('slow', race.targetSec * (1 + w));
  const e = tgt.sc.effort;
  const tAt = (kmv: number) => interp(gridM, tgt.sc.times, kmv * 1000);
  const tAtSc = (sc: Scenario, kmv: number) => interp(gridM, sc.times, kmv * 1000);
  const kmAtT = (t: number) => interp(tgt.sc.times, gridM, t) / 1000;

  // barrières horaires : l'heure saisie est rattachée au jour le plus proche du passage prévu
  const startMs = plannedStartMs(race.date, race.startTime);
  const resolvedAids: AidStation[] = aids.map((a) => {
    const m = a.cutoffClock?.trim().match(/^(\d{1,2})[:hH](\d{2})$/);
    if (!m || startMs == null) return { ...a, cutoffSec: undefined };
    const passage = startMs + tAt(a.km) * 1000;
    const d = new Date(passage);
    d.setHours(+m[1], +m[2], 0, 0);
    const cands = [-1, 0, 1].map((k) => d.getTime() + k * 86400000);
    const best = cands.reduce((x, y) => (Math.abs(y - passage) < Math.abs(x - passage) ? y : x));
    return { ...a, cutoffSec: (best - startMs) / 1000 };
  });

  // 3) profil allégé + trace d'accroche GPS
  const profile: { d: number; ele: number }[] = [];
  const eles = pts.map((p) => p.ele);
  for (let d = 0; d <= totalM; d += 100) profile.push({ d, ele: interp(ds, eles, d) });
  if (profile[profile.length - 1].d < totalM) profile.push({ d: totalM, ele: pts[pts.length - 1].ele });
  const snap: { d: number; lat: number; lon: number }[] = [];
  let nextD = 0;
  for (const p of pts) {
    if (p.d >= nextD) {
      snap.push({ d: Math.round(p.d * 10) / 10, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) });
      nextD = p.d + 25;
    }
  }
  const last = pts[pts.length - 1];
  if (snap[snap.length - 1].d < last.d) snap.push({ d: last.d, lat: last.lat, lon: last.lon });

  // 4) montées remarquables + points hauts / bas (zigzag)
  const { climbs, extremes } = analyseTerrain(profile, course.gainM, Math.max(6, Math.min(25, Math.round(totalKm / 8))));

  // 5) repères
  const profD = profile.map((p) => p.d);
  const profE = profile.map((p) => p.ele);
  const landmarks = buildLandmarks(course, aids, extremes, totalKm, (kmv) => ({
    tFast: tAtSc(fast.sc, kmv),
    tTarget: tAt(kmv),
    tSlow: tAtSc(slow.sc, kmv),
    ele: interp(profD, profE, kmv * 1000),
  }));

  // 6) nutrition
  const fuel: FuelItem[] = [];
  const fuelLabel = race.fuelLabel?.trim() || 'Gel';
  if (race.gel0MinBefore > 0) fuel.push({ id: 'gel0', tSec: -race.gel0MinBefore * 60, label: `${fuelLabel} 0 (avant le départ)`, km: 0 });
  if (race.gelIntervalMin > 0) {
    let k = 1;
    for (let t = race.gelIntervalMin * 60; t < tgt.sc.totalSec - 10 * 60; t += race.gelIntervalMin * 60) {
      fuel.push({ id: `gel${k}`, tSec: t, label: `${fuelLabel} ${k}`, km: kmAtT(t) });
      k++;
    }
  }
  const gelCount = fuel.length;

  // 7) phases détaillées
  const zones = hrZones(athlete);
  const rest = athlete.hrRest ?? 60;
  const phases: Phase[] = PHASE_TEMPLATES.map((tpl, i) => {
    const fromKm = i === 0 ? 0 : bounds[i - 1];
    const toKm = bounds[i];
    const tStart = tAt(fromKm);
    const tEnd = i === PHASE_TEMPLATES.length - 1 ? tgt.sc.totalSec : tAt(toKm);
    let gain = 0;
    let loss = 0;
    let vSum = 0;
    let n = 0;
    for (let j = 1; j < pts.length; j++) {
      const mid = (pts[j].d + pts[j - 1].d) / 2;
      if (mid < fromKm * 1000 || mid > toKm * 1000) continue;
      const de = pts[j].ele - pts[j - 1].ele;
      if (de > 0) gain += de;
      else loss -= de;
      const fat = fatigueAt(mid / totalM, model.fatigue);
      vSum += (e * tpl.intensity) / (model.calibrationF * fat);
      n++;
    }
    const flatV = n ? vSum / n : e;
    const flatPace = 1000 / flatV;
    const lenKm = Math.max(0.001, toKm - fromKm);
    const avgPace = (tEnd - tStart) / lenKm;
    let hr: [number, number] | undefined;
    let hrZoneLabel: string | undefined;
    if (athlete.hrMax) {
      hr = [
        Math.round(rest + tpl.hrr[0] * (athlete.hrMax - rest)),
        Math.round(rest + tpl.hrr[1] * (athlete.hrMax - rest)),
      ];
      if (zones) {
        const z1 = zoneOf(hr[0], zones);
        const z2 = zoneOf(hr[1], zones);
        hrZoneLabel = z1 === z2 ? `Z${z1}` : `Z${z1}–Z${z2}`;
      }
    }
    const watts = athlete.wattsPerMps ? Math.round((athlete.wattsPerMps * e * tpl.intensity) / 5) * 5 : undefined;

    const watch: string[] = [];
    // montée la plus marquée qui commence dans la phase (à défaut : qui la traverse)
    const byGain = (a: Climb, b: Climb) => b.gainM - a.gainM;
    const steep =
      climbs.filter((c) => c.fromKm >= fromKm - 0.2 && c.fromKm < toKm).sort(byGain)[0] ??
      climbs.filter((c) => c.fromKm < toKm && c.toKm > fromKm).sort(byGain)[0];
    if (steep) {
      watch.push(
        `Montée km ${fkm(steep.fromKm)}–${fkm(steep.toKm)} : +${Math.round(steep.gainM)} m à ${Math.round(steep.avgGradePct)} % (max ${Math.round(steep.maxGradePct)} %)` +
          (steep.maxGradePct > model.walkGradePct ? ` — marche au-delà de ${model.walkGradePct} %` : ''),
      );
    }
    resolvedAids
      .filter((a) => a.km > fromKm && a.km <= toKm)
      .forEach((a) =>
        watch.push(
          `${a.name} au km ${fkm(a.km)} : ${a.stopSec >= 120 ? durHM(a.stopSec) : `${a.stopSec} s`} d'arrêt max` +
            (a.cutoffSec != null && startMs != null ? ` · barrière ${clock(startMs + a.cutoffSec * 1000)}` : ''),
        ),
      );
    const gels = fuel.filter((f) => f.tSec >= tStart && f.tSec < tEnd);
    if (gels.length) watch.push(`${gels.map((g) => g.label).join(', ')} dans cette phase`);
    if (hr) watch.push(`FC > ${hr[1]} plus de 2 min : ralentis`);
    watch.push(...tpl.watch);

    const tiles: Tile[] = [
      hr
        ? { label: 'FC cible', value: `${hr[0]}–${hr[1]}`, sub: hrZoneLabel ?? 'bpm' }
        : { label: 'FC cible', value: '–', sub: 'FC max ?' },
      { label: 'Allure plat', value: pace(flatPace), sub: 'équivalent /km' },
      watts
        ? { label: 'Puissance', value: `${watts} W`, sub: 'équivalent plat' }
        : { label: 'Allure moy.', value: pace(avgPace), sub: 'réelle /km' },
      { label: 'Ressenti', value: tpl.rpe, sub: 'sur 10' },
      { label: 'Dénivelé', value: `+${Math.round(gain)}`, sub: `−${Math.round(loss)} m` },
      { label: 'Durée', value: durHM(tEnd - tStart), sub: `→ km ${fkm(toKm)}` },
    ];

    return {
      index: i,
      name: tpl.name,
      fromKm,
      toKm,
      objective: tpl.objective,
      intensity: tpl.intensity,
      hr,
      hrZoneLabel,
      hrAlert: hr?.[1],
      flatPaceSecPerKm: flatPace,
      avgPaceSecPerKm: avgPace,
      watts,
      rpe: tpl.rpe,
      gainM: gain,
      lossM: loss,
      tStart,
      tEnd,
      tiles,
      watch,
      tips: tpl.tips,
    };
  });

  // 8) faisabilité
  const feasibility = assessFeasibility(
    e,
    tgt.reachable,
    athlete,
    () => {
      if (!athlete.flatPaceSecPerKm) return undefined;
      const ePred = 1000 / athlete.flatPaceSecPerKm;
      return timeProfile(pts, ePred, model, aids, intensityAt, seg).total;
    },
    race.targetSec,
  );
  const withCutoff = resolvedAids.filter((a) => a.cutoffSec != null);
  if (withCutoff.length) {
    const margins = withCutoff.map((a) => ({ a, slow: a.cutoffSec! - tAtSc(slow.sc, a.km), tgt: a.cutoffSec! - tAt(a.km) }));
    const tight = margins.reduce((x, y) => (y.slow < x.slow ? y : x));
    if (tight.tgt < 0) {
      feasibility.verdict = 'très ambitieux';
      feasibility.message += ` ⚠️ Même à l'objectif, la barrière de ${tight.a.name} est dépassée de ${durHM(-tight.tgt)}.`;
    } else if (tight.slow < 0) {
      feasibility.message += ` ⚠️ Au rythme lent de la fenêtre, la barrière de ${tight.a.name} serait dépassée de ${durHM(-tight.slow)}.`;
    } else {
      feasibility.message += ` Barrière la plus serrée : ${tight.a.name}, marge ${durHM(tight.tgt)} à l'objectif.`;
    }
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    race,
    athlete,
    model,
    course: {
      name: course.name,
      totalM,
      gainM: course.gainM,
      lossM: course.lossM,
      profile: profile.map((p) => ({ d: Math.round(p.d), ele: Math.round(p.ele * 10) / 10 })),
      snap,
    },
    stepM: step,
    scenarios: { fast: fast.sc, target: tgt.sc, slow: slow.sc },
    phases,
    landmarks,
    aidStations: resolvedAids,
    climbs,
    format,
    fuel,
    morning: defaultMorning(race),
    checklist: defaultChecklist(gelCount, aids.length, format, fuelLabel),
    recovery: [
      'Marche 10 min, ne t’assois pas tout de suite.',
      'Bois 500 ml dans l’heure (eau + sel ou boisson de récup).',
      'Mange glucides + protéines dans les 2 h.',
      'Note tes sensations et ton temps réel : ils serviront à calibrer la prochaine course.',
      'Pas de course à pied pendant 3 à 5 jours si douleurs : marche, vélo léger.',
    ],
    feasibility,
  };
}

function assessFeasibility(
  e: number,
  reachable: boolean,
  athlete: Athlete,
  predict: () => number | undefined,
  targetSec: number,
): Feasibility {
  const requiredFlatPace = 1000 / e;
  const requiredWatts = athlete.wattsPerMps ? Math.round(athlete.wattsPerMps * e) : undefined;
  const effortTxt = `Ton objectif demande une allure plat équivalente de ${pace(requiredFlatPace)}/km${
    requiredWatts ? ` (≈ ${requiredWatts} W)` : ''
  }.`;
  if (!reachable) {
    return {
      requiredFlatPace,
      requiredWatts,
      verdict: 'très ambitieux',
      message: 'Objectif hors de portée du modèle : la marche dans les fortes pentes et les arrêts suffisent à le dépasser.',
    };
  }
  const predictedSec = predict();
  if (!predictedSec || !athlete.flatPaceSecPerKm) {
    return {
      requiredFlatPace,
      requiredWatts,
      verdict: 'inconnu',
      message: `${effortTxt} Renseigne ton allure plat soutenable pour obtenir un avis de faisabilité.`,
    };
  }
  // effort demandé / effort déclaré : > 1 = l'objectif demande plus que ton allure plat
  const ratio = e / (1000 / athlete.flatPaceSecPerKm);
  const verdict: Feasibility['verdict'] =
    ratio <= 0.97 ? 'confortable' : ratio <= 1.01 ? 'réaliste' : ratio <= 1.04 ? 'ambitieux' : 'très ambitieux';
  const diff = predictedSec - targetSec;
  return {
    requiredFlatPace,
    requiredWatts,
    predictedSec,
    verdict,
    message: `${effortTxt} Avec ton allure plat déclarée (${pace(athlete.flatPaceSecPerKm)}/km), le modèle prédit ${durHM(predictedSec)} (${durHM(
      Math.abs(diff),
    )} ${diff > 0 ? 'de plus' : 'de moins'} que l'objectif) : objectif ${verdict}.`,
  };
}

/** Montées notables et extrêmes d'altitude via un zigzag à seuil. */
export function analyseTerrain(profile: { d: number; ele: number }[], gainM: number, maxExtremes = 6) {
  const H = Math.max(20, Math.min(60, gainM / 15));
  type Ext = { i: number; type: 'high' | 'low' };
  const ext: Ext[] = [];
  let dir: 0 | 1 | -1 = 0;
  let candI = 0;
  let hiI = 0;
  let loI = 0;
  for (let i = 1; i < profile.length; i++) {
    const e = profile[i].ele;
    if (dir === 0) {
      if (e > profile[hiI].ele) hiI = i;
      if (e < profile[loI].ele) loI = i;
      if (profile[hiI].ele - profile[loI].ele >= H) {
        if (loI < hiI) {
          ext.push({ i: loI, type: 'low' });
          dir = 1;
          candI = hiI;
        } else {
          ext.push({ i: hiI, type: 'high' });
          dir = -1;
          candI = loI;
        }
      }
    } else if (dir === 1) {
      if (e > profile[candI].ele) candI = i;
      else if (profile[candI].ele - e >= H) {
        ext.push({ i: candI, type: 'high' });
        dir = -1;
        candI = i;
      }
    } else {
      if (e < profile[candI].ele) candI = i;
      else if (e - profile[candI].ele >= H) {
        ext.push({ i: candI, type: 'low' });
        dir = 1;
        candI = i;
      }
    }
  }
  if (dir !== 0) ext.push({ i: candI, type: dir === 1 ? 'high' : 'low' });

  const climbs: Climb[] = [];
  for (let k = 0; k < ext.length - 1; k++) {
    if (ext[k].type !== 'low' || ext[k + 1].type !== 'high') continue;
    const a = profile[ext[k].i];
    const b = profile[ext[k + 1].i];
    let maxG = 0;
    for (let j = ext[k].i + 1; j <= ext[k + 1].i; j++) {
      const g = ((profile[j].ele - profile[j - 1].ele) / Math.max(1, profile[j].d - profile[j - 1].d)) * 100;
      maxG = Math.max(maxG, g);
    }
    climbs.push({
      fromKm: a.d / 1000,
      toKm: b.d / 1000,
      gainM: b.ele - a.ele,
      avgGradePct: ((b.ele - a.ele) / Math.max(1, b.d - a.d)) * 100,
      maxGradePct: maxG,
    });
  }

  // extrêmes : point le plus haut et le plus bas + extrêmes de zigzag les plus marqués
  let topI = 0;
  let botI = 0;
  profile.forEach((p, i) => {
    if (p.ele > profile[topI].ele) topI = i;
    if (p.ele < profile[botI].ele) botI = i;
  });
  const extremes = new Map<number, 'high' | 'low'>();
  extremes.set(topI, 'high');
  extremes.set(botI, 'low');
  ext
    .map((x, k) => {
      const nb = [ext[k - 1], ext[k + 1]].filter(Boolean).map((y) => Math.abs(profile[y.i].ele - profile[x.i].ele));
      return { ...x, prom: nb.length ? Math.min(...nb) : 0 };
    })
    .sort((a, b) => b.prom - a.prom)
    .slice(0, maxExtremes)
    .forEach((x) => extremes.set(x.i, x.type));
  return {
    climbs,
    extremes: [...extremes.entries()].map(([i, type]) => ({ km: profile[i].d / 1000, ele: profile[i].ele, type })),
  };
}

function buildLandmarks(
  course: Course,
  aids: AidStation[],
  extremes: { km: number; ele: number; type: 'high' | 'low' }[],
  totalKm: number,
  times: (km: number) => { tFast: number; tTarget: number; tSlow: number; ele: number },
): Landmark[] {
  type L = Omit<Landmark, 'tFast' | 'tTarget' | 'tSlow' | 'ele' | 'id'>;
  const strong: L[] = [
    { name: 'Départ', km: 0, kind: 'start' },
    { name: 'Arrivée', km: totalKm, kind: 'finish' },
    ...aids.map((a) => ({ name: a.name, km: a.km, kind: 'aid' as const })),
    ...course.waypoints
      .filter((w) => w.offTrackM < 200 && w.km > 0.2 && w.km < totalKm - 0.2)
      .filter((w) => !aids.some((a) => Math.abs(a.km - w.km) < 0.3))
      .map((w) => ({ name: w.name, km: w.km, kind: 'waypoint' as const })),
  ];
  const near = (list: L[], k: number, r: number) => list.some((l) => Math.abs(l.km - k) < r);
  const all: L[] = [...strong];
  extremes.forEach((x) => {
    if (x.km < 0.3 || x.km > totalKm - 0.3 || near(all, x.km, 0.4)) return;
    all.push({
      name: x.type === 'high' ? `Point haut (${Math.round(x.ele)} m)` : `Point bas (${Math.round(x.ele)} m)`,
      km: x.km,
      kind: x.type === 'high' ? 'summit' : 'low',
    });
  });
  const every = totalKm > 60 ? 10 : 5;
  for (let k = every; k < totalKm - 1; k += every) {
    if (!near(all, k, 1)) all.push({ name: `Km ${k}`, km: k, kind: 'km' });
  }
  return all
    .sort((a, b) => a.km - b.km)
    .map((l, i) => ({ ...l, id: `lm${i}`, ...times(l.km) }));
}

export function defaultMorning(race: RaceSettings): { minBefore: number; text: string }[] {
  const items = [
    { minBefore: 210, text: 'Dernier vrai repas : glucides, peu de fibres et de graisses' },
    { minBefore: 120, text: 'Dernier grand verre d’eau, puis petites gorgées' },
    { minBefore: 75, text: 'Arrivée sur place : dossard, consigne, toilettes' },
    { minBefore: 40, text: 'Échauffement léger 10 min + quelques accélérations' },
    { minBefore: 25, text: 'Check matériel : flasques, gels, frontale, sifflet…' },
    { minBefore: 10, text: 'Dans le sas. Montre en mode course, GPS accroché' },
    { minBefore: 0, text: 'Coup de feu : appuie sur DÉPART dans l’app' },
  ];
  if (race.gel0MinBefore > 0) items.push({ minBefore: race.gel0MinBefore, text: 'Gel 0 + quelques gorgées' });
  return items.sort((a, b) => b.minBefore - a.minBefore);
}

export function defaultChecklist(gels: number, aidCount: number, format: RaceFormat = 'standard', fuelLabel = 'Gel'): string[] {
  const ultra: string[] =
    format === 'ultra'
      ? [
          'Frontale + piles ou batterie de rechange',
          'Couche chaude et veste imperméable, même si la météo est bonne',
          'Batterie externe pour le téléphone (GPS sur plusieurs heures)',
          'Sacs d’allègement / affaires de rechange si l’organisation les transporte',
          'Crème anti-frottements, pansements ampoules',
        ]
      : [];
  return [
    ...ultra,
    'Dossard + épingles ou porte-dossard',
    'Montre chargée, trace GPX chargée, alerte FC haute réglée',
    'Téléphone chargé à 100 %, plan chargé dans l’app (fonctionne sans réseau)',
    `${fuelLabel}s : ${gels} prévus + 1 de secours`,
    `Flasques / gobelet${aidCount ? ` (${aidCount} ravito${aidCount > 1 ? 's' : ''})` : ''}`,
    'Matériel obligatoire du règlement (couverture de survie, sifflet, frontale…)',
    'Tenue adaptée à la météo, chaussures testées',
    'Réveil réglé, trajet et navette vérifiés',
    'Écouteurs si tu veux entendre les annonces vocales',
  ];
}
