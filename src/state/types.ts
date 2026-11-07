import type { Anchor, Course } from '../core/types';

/** Ligne de ravito telle que saisie (texte). */
export interface AidRow {
  name: string;
  km: string;
  stopSec: string;
}

/** État d'une course en cours (persisté : survit à un redémarrage de l'app). */
export interface RaceSession {
  /** Epoch ms du départ réel. */
  startMs: number;
  anchor: Anchor | null;
  /** Identifiants d'événements déjà annoncés (ou manqués). */
  done: string[];
  gpsOn: boolean;
  lastGps?: { at: number; km: number | null; distM: number | null; accuracy: number | null };
  /** Temps de course (s) du dernier point de situation vocal. */
  lastStatusT?: number;
  /** Écart utilisé lors de la dernière programmation des notifications. */
  scheduledDelta?: number;
  scheduledAt?: number;
  finishedAt?: number;
}

export interface Prefs {
  voice: boolean;
  voiceRate: number;
  /** Point de situation vocal toutes les N minutes quand la position est connue (0 = jamais). */
  statusEveryMin: number;
  gpsByDefault: boolean;
  gpsPowerSave: boolean;
  keepAwake: boolean;
  theme: 'auto' | 'dark' | 'light';
}

export const DEFAULT_PREFS: Prefs = {
  voice: true,
  voiceRate: 1.0,
  statusEveryMin: 15,
  gpsByDefault: true,
  gpsPowerSave: false,
  keepAwake: false,
  theme: 'auto',
};

/** Formulaire de préparation (valeurs saisies telles quelles). */
export interface SetupForm {
  raceName: string;
  date: string;
  startTime: string;
  target: string;
  windowPct: string;
  startDelaySec: string;
  hrMax: string;
  hrRest: string;
  hrZones: string;
  wattsPerMps: string;
  flatPace: string;
  gelIntervalMin: string;
  gel0MinBefore: string;
  drinkIntervalMin: string;
  walkGradePct: string;
  walkVamMh: string;
  descentSkill: string;
  calibrationF: string;
  watchFactor: string;
  aidStations: AidRow[];
}

export interface Draft {
  course: Course | null;
  form: SetupForm;
}

export const DEFAULT_FORM: SetupForm = {
  raceName: '',
  date: '',
  startTime: '09:00',
  target: '',
  windowPct: '1',
  startDelaySec: '20',
  hrMax: '',
  hrRest: '',
  hrZones: '',
  wattsPerMps: '',
  flatPace: '',
  gelIntervalMin: '30',
  gel0MinBefore: '15',
  drinkIntervalMin: '0',
  walkGradePct: '12',
  walkVamMh: '850',
  descentSkill: '1',
  calibrationF: '1',
  watchFactor: '1',
  aidStations: [],
};
