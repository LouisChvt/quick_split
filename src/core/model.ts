// Modèle d'allure : effort constant modulé par la pente, la fatigue et l'intensité de phase.
//
// Vitesse plat du moment : vf = e × intensité / (F × fatigue)
//   - montée (g > 0)       : v = vf / (1 + a·g − b·g²)        (coût type Minetti)
//   - descente (g < 0)      : v = vf × facteurDescente(g)
//   - pente > seuil marche  : v = min(v, VAM / pente)           (marche active)
import type { AidStation, FatigueStep, ModelParams, TrackPoint } from './types';

export const DEFAULT_FATIGUE: FatigueStep[] = [
  { toFrac: 0.1, f: 0.97 },
  { toFrac: 0.8, f: 1.0 },
  { toFrac: 0.88, f: 1.02 },
  { toFrac: 0.96, f: 1.05 },
  { toFrac: 1.0, f: 1.08 },
];

export const DEFAULT_MODEL: ModelParams = {
  upA: 0.062,
  upB: 0.0005,
  walkGradePct: 12,
  walkVamMh: 850,
  descentSkill: 1,
  calibrationF: 1.0,
  fatigue: DEFAULT_FATIGUE,
  startDelaySec: 20,
};

export function upCost(g: number, m: ModelParams): number {
  return Math.max(1, 1 + m.upA * g - m.upB * g * g);
}

/** Facteur de vitesse en descente (g < 0, en %). Gain jusqu'à −8 %, puis freinage. */
export function descentFactor(g: number, skill = 1): number {
  const a = Math.abs(g);
  let base: number;
  if (a <= 5) base = 1 + 0.025 * a; // −5 % → ×1,125
  else if (a <= 10) base = 1.125 + 0.005 * (a - 5); // −10 % → ×1,15
  else if (a <= 20) base = 1.15 - 0.025 * (a - 10); // −20 % → ×0,90
  else base = Math.max(0.45, 0.9 - 0.02 * (a - 20));
  const w = Math.min(1, a / 10);
  return base * (1 + (skill - 1) * w);
}

export function fatigueAt(frac: number, steps: FatigueStep[]): number {
  for (const s of steps) if (frac <= s.toFrac + 1e-9) return s.f;
  return steps.length ? steps[steps.length - 1].f : 1;
}

export function speedAt(g: number, vf: number, fatigue: number, m: ModelParams): number {
  let v = g >= 0 ? vf / upCost(g, m) : vf * descentFactor(g, m.descentSkill);
  if (g > m.walkGradePct) {
    const walk = m.walkVamMh / 3600 / (g / 100) / fatigue;
    v = Math.min(v, walk);
  }
  return Math.max(0.2, v);
}

export interface TimeProfile {
  /** Temps cumulé (s) à chaque point de la trace. */
  t: number[];
  total: number;
}

/**
 * Temps cumulé sur la trace pour un effort `e` (m/s équivalent plat).
 * `intensityAt(d)` renvoie le multiplicateur d'intensité de la phase au mètre d.
 */
export function timeProfile(
  pts: TrackPoint[],
  e: number,
  m: ModelParams,
  aids: AidStation[],
  intensityAt: (d: number) => number,
): TimeProfile {
  const total = pts[pts.length - 1].d;
  const t = new Array<number>(pts.length);
  t[0] = 0;
  const delayLen = Math.min(1000, total / 4);
  const sortedAids = [...aids].sort((a, b) => a.km - b.km);
  let aidIdx = 0;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const ds = pts[i].d - pts[i - 1].d;
    if (ds <= 0) {
      t[i] = acc;
      continue;
    }
    const mid = (pts[i].d + pts[i - 1].d) / 2;
    const frac = mid / total;
    const g = Math.max(-45, Math.min(45, ((pts[i].ele - pts[i - 1].ele) / ds) * 100));
    const fat = fatigueAt(frac, m.fatigue);
    const vf = (e * intensityAt(mid)) / (m.calibrationF * fat);
    acc += ds / speedAt(g, vf, fat, m);
    // bouchon de départ réparti sur le premier kilomètre
    if (pts[i - 1].d < delayLen) {
      acc += (m.startDelaySec * (Math.min(pts[i].d, delayLen) - pts[i - 1].d)) / delayLen;
    }
    // arrêts aux ravitos
    while (aidIdx < sortedAids.length && sortedAids[aidIdx].km * 1000 <= pts[i].d) {
      acc += sortedAids[aidIdx].stopSec;
      aidIdx++;
    }
    t[i] = acc;
  }
  return { t, total: acc };
}

/** Cherche l'effort e qui donne le temps total visé (bissection, total décroissant en e). */
export function solveEffort(
  pts: TrackPoint[],
  targetSec: number,
  m: ModelParams,
  aids: AidStation[],
  intensityAt: (d: number) => number,
): { e: number; reachable: boolean } {
  let lo = 0.3;
  let hi = 12;
  const tot = (e: number) => timeProfile(pts, e, m, aids, intensityAt).total;
  if (tot(hi) > targetSec) return { e: hi, reachable: false };
  if (tot(lo) < targetSec) return { e: lo, reachable: true };
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (tot(mid) > targetSec) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-5) break;
  }
  return { e: (lo + hi) / 2, reachable: true };
}
