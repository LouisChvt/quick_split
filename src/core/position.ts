// Position estimée, écart à l'objectif et projection GPS sur la trace.
import { interp, localXY } from './geo';
import type { Anchor, Plan, Scenario } from './types';

export function gridKm(plan: Plan): number[] {
  const n = plan.scenarios.target.times.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = Math.min((i * plan.stepM) / 1000, plan.course.totalM / 1000);
  return out;
}

const gridCache = new WeakMap<Plan, number[]>();
function grid(plan: Plan) {
  let g = gridCache.get(plan);
  if (!g) {
    g = gridKm(plan);
    gridCache.set(plan, g);
  }
  return g;
}

/** Temps de course (s) prévu au km donné, pour un scénario. */
export function tAtKm(plan: Plan, km: number, sc: Scenario = plan.scenarios.target): number {
  return interp(grid(plan), sc.times, km);
}

/** Km prévu au temps de course t (s), pour un scénario. */
export function kmAt(plan: Plan, t: number, sc: Scenario = plan.scenarios.target): number {
  return interp(sc.times, grid(plan), t);
}

/** Km estimé : au rythme du plan depuis le dernier recalage (ou depuis le départ). */
export function estimateKm(plan: Plan, elapsed: number, anchor?: Anchor | null): number {
  const totalKm = plan.course.totalM / 1000;
  if (!anchor) return Math.min(totalKm, kmAt(plan, elapsed));
  const tPlanAtAnchor = tAtKm(plan, anchor.km);
  return Math.min(totalKm, kmAt(plan, tPlanAtAnchor + (elapsed - anchor.t)));
}

/** Écart à l'objectif (s). Positif = retard. */
export function deltaFromAnchor(plan: Plan, anchor?: Anchor | null): number {
  if (!anchor) return 0;
  return anchor.t - tAtKm(plan, anchor.km);
}

export function projectedFinish(plan: Plan, delta: number): number {
  return plan.scenarios.target.totalSec + delta;
}

/** Statut par rapport à la fenêtre rapide / lente au km donné. */
export function windowStatus(plan: Plan, km: number, t: number): 'ahead' | 'in' | 'behind' {
  const f = tAtKm(plan, km, plan.scenarios.fast);
  const s = tAtKm(plan, km, plan.scenarios.slow);
  if (t < f) return 'ahead';
  if (t > s) return 'behind';
  return 'in';
}

export interface SnapResult {
  km: number;
  distM: number;
}

/**
 * Projette une position GPS sur la trace.
 * Score = distance à la trace + `penaltyPerKm` × |km candidat − km estimé|,
 * pour lever l'ambiguïté des boucles et des allers-retours.
 * Rejet si la trace est à plus de `maxOffM`.
 */
export function snapToTrack(
  snap: { d: number; lat: number; lon: number }[],
  lat: number,
  lon: number,
  estKm: number | null,
  penaltyPerKm = 40,
  maxOffM = 250,
): SnapResult | null {
  let best: { score: number; d: number; dist: number } | null = null;
  for (let i = 0; i < snap.length - 1; i++) {
    const a = snap[i];
    const b = snap[i + 1];
    const [bx, by] = localXY(b.lat, b.lon, a.lat, a.lon);
    const [px, py] = localXY(lat, lon, a.lat, a.lon);
    // élimination rapide : trop loin du segment
    if (Math.abs(px) > maxOffM + 200 && Math.abs(px - bx) > maxOffM + 200) continue;
    if (Math.abs(py) > maxOffM + 200 && Math.abs(py - by) > maxOffM + 200) continue;
    const len2 = bx * bx + by * by;
    const f = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const dx = px - f * bx;
    const dy = py - f * by;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxOffM) continue;
    const d = a.d + f * (b.d - a.d);
    const score = dist + (estKm == null ? 0 : penaltyPerKm * Math.abs(d / 1000 - estKm));
    if (!best || score < best.score) best = { score, d, dist };
  }
  return best ? { km: best.d / 1000, distM: best.dist } : null;
}
