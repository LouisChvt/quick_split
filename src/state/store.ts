// Magasin global minimal, partagé entre l'interface et la tâche GPS d'arrière-plan
// (même runtime JS). Persisté dans AsyncStorage : tout marche hors réseau.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { buildEvents } from '../core/events';
import type { Plan, RaceEvent } from '../core/types';
import { validatePlan } from '../core/validate';
import { DEFAULT_FORM, DEFAULT_PREFS, type Draft, type Prefs, type RaceSession } from './types';

const K = { plan: 'tp.plan.v1', session: 'tp.session.v1', prefs: 'tp.prefs.v1', course: 'tp.course.v1', form: 'tp.form.v1' };

export interface AppState {
  loaded: boolean;
  plan: Plan | null;
  session: RaceSession | null;
  prefs: Prefs;
  draft: Draft;
}

let state: AppState = {
  loaded: false,
  plan: null,
  session: null,
  prefs: DEFAULT_PREFS,
  draft: { course: null, form: DEFAULT_FORM },
};
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

const emit = () => listeners.forEach((l) => l());

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const s = await AsyncStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, v: unknown) {
  if (v == null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, JSON.stringify(v));
}

export function ensureLoaded(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const [plan, session, prefs, course, form] = await Promise.all([
        readJSON<Plan>(K.plan),
        readJSON<RaceSession>(K.session),
        readJSON<Prefs>(K.prefs),
        readJSON<Draft['course']>(K.course),
        readJSON<Draft['form']>(K.form),
      ]);
      let validPlan: Plan | null = null;
      try {
        validPlan = plan ? validatePlan(plan) : null;
      } catch {
        validPlan = null;
      }
      state = {
        loaded: true,
        plan: validPlan,
        session,
        prefs: { ...DEFAULT_PREFS, ...(prefs ?? {}) },
        draft: { course: course ?? null, form: { ...DEFAULT_FORM, ...(form ?? {}) } },
      };
      emit();
    })();
  }
  return loading;
}

export const getState = () => state;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export async function setPlan(plan: Plan | null) {
  state = { ...state, plan };
  emit();
  await writeJSON(K.plan, plan);
}

let sessionWriteTimer: ReturnType<typeof setTimeout> | null = null;
/** Met à jour la session. `persist: 'now'` écrit immédiatement, 'soon' regroupe les écritures (GPS). */
export async function setSession(session: RaceSession | null, persist: 'now' | 'soon' = 'now') {
  state = { ...state, session };
  emit();
  if (persist === 'now') {
    if (sessionWriteTimer) clearTimeout(sessionWriteTimer);
    sessionWriteTimer = null;
    await writeJSON(K.session, session);
  } else if (!sessionWriteTimer) {
    sessionWriteTimer = setTimeout(() => {
      sessionWriteTimer = null;
      writeJSON(K.session, state.session).catch(() => {});
    }, 10000);
  }
}

export async function setPrefs(p: Partial<Prefs>) {
  state = { ...state, prefs: { ...state.prefs, ...p } };
  emit();
  await writeJSON(K.prefs, state.prefs);
}

export async function setDraft(d: Partial<Draft>) {
  state = { ...state, draft: { ...state.draft, ...d } };
  emit();
  // la trace (lourde) et le formulaire sont stockés à part
  if ('course' in d) await writeJSON(K.course, state.draft.course);
  if ('form' in d) await writeJSON(K.form, state.draft.form);
}

// Événements de course, recalculés seulement si le plan ou l'heure de départ changent.
let evCache: { plan: Plan; startMs: number; events: RaceEvent[] } | null = null;
export function raceEvents(plan: Plan, startMs: number): RaceEvent[] {
  if (!evCache || evCache.plan !== plan || evCache.startMs !== startMs) {
    evCache = { plan, startMs, events: buildEvents(plan, startMs) };
  }
  return evCache.events;
}
