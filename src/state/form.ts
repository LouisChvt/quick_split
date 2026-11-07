// Passage du formulaire de préparation aux entrées du générateur de plan.
import { num, parseDuration, parsePace, plannedStartMs } from '../core/format';
import { looksLikeAidStation } from '../core/gpx';
import { DEFAULT_MODEL } from '../core/model';
import type { BuildInput } from '../core/plan';
import type { AidStation, Course } from '../core/types';
import type { AidRow, SetupForm } from './types';

export function formToInput(course: Course | null, f: SetupForm): { input?: BuildInput; errors: string[] } {
  const errors: string[] = [];
  if (!course) errors.push('Importe un GPX (ou charge le parcours démo).');
  const targetSec = parseDuration(f.target);
  if (!targetSec || targetSec < 600) errors.push('Objectif : saisis un temps comme « 3h20 ».');
  if (!plannedStartMs(f.date, f.startTime)) errors.push('Date (AAAA-MM-JJ) et heure de départ (HH:MM) obligatoires.');
  const hrMax = num(f.hrMax);
  const hrRest = num(f.hrRest);
  if (hrMax != null && (hrMax < 120 || hrMax > 230)) errors.push('FC max : valeur entre 120 et 230.');
  if (hrRest != null && hrMax != null && hrRest >= hrMax) errors.push('FC repos doit être inférieure à la FC max.');
  let hrZones: number[] | undefined;
  if (f.hrZones.trim()) {
    const z = f.hrZones.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (z.length !== 5 || z.some((x, i) => !isFinite(x) || (i > 0 && x <= z[i - 1]))) {
      errors.push('Zones FC : 5 bornes hautes croissantes (Z1 à Z5), ex. « 137, 158, 173, 179, 189 ».');
    } else hrZones = z;
  }
  const flatPace = f.flatPace.trim() ? parsePace(f.flatPace) : undefined;
  if (f.flatPace.trim() && !flatPace) errors.push("Allure plat : format « 5'20 ».");
  const aids: AidStation[] = f.aidStations
    .map((a) => ({ name: a.name.trim() || 'Ravito', km: num(a.km) ?? NaN, stopSec: num(a.stopSec) ?? 0 }))
    .filter((a) => isFinite(a.km) && a.km > 0);
  if (course && aids.some((a) => a.km >= course.totalM / 1000)) errors.push('Un ravito est au-delà de l’arrivée.');
  if (errors.length || !course || !targetSec) return { errors };

  const model = {
    ...DEFAULT_MODEL,
    walkGradePct: num(f.walkGradePct) ?? DEFAULT_MODEL.walkGradePct,
    walkVamMh: num(f.walkVamMh) ?? DEFAULT_MODEL.walkVamMh,
    descentSkill: num(f.descentSkill) ?? DEFAULT_MODEL.descentSkill,
    calibrationF: num(f.calibrationF) ?? DEFAULT_MODEL.calibrationF,
    startDelaySec: num(f.startDelaySec) ?? DEFAULT_MODEL.startDelaySec,
  };
  return {
    errors,
    input: {
      course,
      race: {
        name: f.raceName.trim() || course.name,
        date: f.date,
        startTime: f.startTime.replace('h', ':'),
        targetSec,
        windowPct: num(f.windowPct) ?? 1,
        gelIntervalMin: num(f.gelIntervalMin) ?? 30,
        gel0MinBefore: num(f.gel0MinBefore) ?? 15,
        drinkIntervalMin: num(f.drinkIntervalMin) ?? 0,
        watchFactor: num(f.watchFactor) ?? 1,
      },
      athlete: { hrMax, hrRest, hrZones, flatPaceSecPerKm: flatPace ?? undefined, wattsPerMps: num(f.wattsPerMps) },
      model,
      aidStations: aids,
    },
  };
}

/** Ravitos proposés à partir des waypoints du GPX. */
export function aidStationsFromCourse(course: Course): AidRow[] {
  return course.waypoints
    .filter((w) => w.offTrackM < 300 && looksLikeAidStation(w.name))
    .map((w) => ({ name: w.name, km: (Math.round(w.km * 100) / 100).toFixed(2).replace('.', ','), stopSec: '45' }));
}
