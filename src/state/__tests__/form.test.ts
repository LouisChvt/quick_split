import { describe, expect, it } from 'vitest';
import { demoGpx } from '../../core/demo';
import { buildCourse, parseGpx } from '../../core/gpx';
import { buildPlan } from '../../core/plan';
import { aidStationsFromCourse, formToInput } from '../form';
import { DEFAULT_FORM } from '../types';

const course = buildCourse(parseGpx(demoGpx()));

describe('formulaire → plan', () => {
  it('signale les champs manquants', () => {
    const { input, errors } = formToInput(null, DEFAULT_FORM);
    expect(input).toBeUndefined();
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
  it('rejette des zones FC non croissantes', () => {
    const { errors } = formToInput(course, { ...DEFAULT_FORM, date: '2026-11-07', target: '2h15', hrZones: '150,140,160,170,180' });
    expect(errors.some((e) => e.startsWith('Zones FC'))).toBe(true);
  });
  it('construit un plan complet depuis des saisies à la française', () => {
    const { input, errors } = formToInput(course, {
      ...DEFAULT_FORM,
      raceName: 'Test',
      date: '2026-11-07',
      startTime: '10h40',
      target: '2h15',
      hrMax: '196',
      hrRest: '51',
      hrZones: '137, 158, 173, 179, 189',
      flatPace: "5'10",
      wattsPerMps: '88,5',
      aidStations: aidStationsFromCourse(course),
    });
    expect(errors).toEqual([]);
    const plan = buildPlan(input!);
    expect(plan.race.startTime).toBe('10:40');
    expect(plan.aidStations).toHaveLength(2);
    expect(plan.phases[0].hrZoneLabel).toMatch(/^Z\d/);
    expect(plan.feasibility.predictedSec).toBeGreaterThan(0);
  });
});
