// Validation minimale d'un plan importé (JSON exporté par l'app ou produit par un outil externe).
import type { Plan } from './types';

export function validatePlan(obj: unknown): Plan {
  const p = obj as Plan;
  const fail = (msg: string): never => {
    throw new Error(`Plan invalide : ${msg}`);
  };
  if (!p || typeof p !== 'object') fail('ce n’est pas un objet JSON');
  if (p.version !== 1) fail('version non prise en charge');
  if (!p.course || !(p.course.totalM > 0)) fail('parcours manquant');
  if (!Array.isArray(p.course.snap) || p.course.snap.length < 2) fail('trace manquante');
  if (!(p.stepM > 0)) fail('stepM manquant');
  for (const k of ['fast', 'target', 'slow'] as const) {
    const sc = p.scenarios?.[k];
    if (!sc || !Array.isArray(sc.times) || sc.times.length < 2) fail(`scénario ${k} manquant`);
    for (let i = 1; i < sc.times.length; i++) if (!(sc.times[i] >= sc.times[i - 1])) fail(`temps non croissants (${k})`);
  }
  if (!Array.isArray(p.phases) || !p.phases.length) fail('phases manquantes');
  if (!Array.isArray(p.landmarks)) fail('repères manquants');
  if (!p.race?.date || !p.race?.startTime) fail('date ou heure de départ manquante');
  p.fuel ??= [];
  p.aidStations ??= [];
  p.climbs ??= [];
  p.morning ??= [];
  p.checklist ??= [];
  p.recovery ??= [];
  return p;
}
