// Types partagés du cœur métier (aucune dépendance React Native ici :
// tout ce dossier est testable en Node).

/** Point de trace rééchantillonné. d = distance cumulée en mètres. */
export interface TrackPoint {
  d: number;
  lat: number;
  lon: number;
  ele: number;
}

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

/** Parcours traité à partir d'un GPX (rééchantillonné tous les 10 m, altitude lissée). */
export interface Course {
  name: string;
  points: TrackPoint[];
  totalM: number;
  gainM: number;
  lossM: number;
  rawGainM: number;
  hasElevation: boolean;
  waypoints: (Waypoint & { km: number; offTrackM: number })[];
}

export interface AidStation {
  name: string;
  km: number;
  /** Arrêt prévu, en secondes. */
  stopSec: number;
}

export interface FatigueStep {
  /** Fraction de la distance (0..1) jusqu'à laquelle s'applique ce facteur. */
  toFrac: number;
  /** Multiplicateur de temps (>1 = plus lent). */
  f: number;
}

export interface ModelParams {
  /** Coût en montée : 1 + a·g − b·g² (g en %). */
  upA: number;
  upB: number;
  /** Au-delà de cette pente (%), on marche. */
  walkGradePct: number;
  /** Vitesse verticale en marche (m/h). */
  walkVamMh: number;
  /** Aisance en descente (1 = moyenne, 1.1 = bon descendeur, 0.9 = prudent). */
  descentSkill: number;
  /** Facteur global de calibration (temps réel / temps modèle). */
  calibrationF: number;
  fatigue: FatigueStep[];
  /** Temps perdu au départ (bouchon), en secondes. */
  startDelaySec: number;
}

export interface Athlete {
  name?: string;
  hrMax?: number;
  hrRest?: number;
  /** Bornes hautes Z1..Z5 (5 valeurs croissantes). Z6 au-delà. */
  hrZones?: number[];
  /** Puissance sur le plat par m/s de vitesse (calibrée sur tes sorties). Optionnel. */
  wattsPerMps?: number;
  /** Allure plat soutenable sur ce type d'effort (s/km). Optionnel, sert à prédire. */
  flatPaceSecPerKm?: number;
}

export interface RaceSettings {
  name: string;
  /** AAAA-MM-JJ */
  date: string;
  /** HH:MM (heure locale du téléphone) */
  startTime: string;
  /** Objectif en secondes. */
  targetSec: number;
  /** Demi-largeur de la fenêtre d'objectif, en % (ex. 1 → ±1 %). */
  windowPct: number;
  gelIntervalMin: number;
  gel0MinBefore: number;
  /** Rappel « bois » toutes les N minutes (0 = désactivé). */
  drinkIntervalMin: number;
  /** La montre affiche X km quand la trace en fait 1 (ex. 0.98). */
  watchFactor: number;
}

export interface Scenario {
  key: 'fast' | 'target' | 'slow';
  totalSec: number;
  /** Effort équivalent (m/s sur le plat, avant fatigue et calibration). */
  effort: number;
  /** Temps de course cumulé à chaque pas de grille (stepM). */
  times: number[];
}

export interface Tile {
  label: string;
  value: string;
  sub?: string;
}

export interface Phase {
  index: number;
  name: string;
  fromKm: number;
  toKm: number;
  objective: string;
  /** Multiplicateur d'intensité appliqué à l'effort. */
  intensity: number;
  hr?: [number, number];
  hrZoneLabel?: string;
  /** Alerte FC haute conseillée pour cette phase. */
  hrAlert?: number;
  flatPaceSecPerKm: number;
  avgPaceSecPerKm: number;
  watts?: number;
  rpe: string;
  gainM: number;
  lossM: number;
  tStart: number;
  tEnd: number;
  tiles: Tile[];
  watch: string[];
  tips: string[];
}

export type LandmarkKind = 'start' | 'finish' | 'aid' | 'summit' | 'low' | 'km' | 'waypoint';

export interface Landmark {
  id: string;
  name: string;
  km: number;
  kind: LandmarkKind;
  ele: number;
  tFast: number;
  tTarget: number;
  tSlow: number;
}

export interface FuelItem {
  id: string;
  /** Temps de course (s). Négatif = avant le départ. */
  tSec: number;
  label: string;
  km: number;
}

export interface MorningItem {
  minBefore: number;
  text: string;
}

export interface Climb {
  fromKm: number;
  toKm: number;
  gainM: number;
  avgGradePct: number;
  maxGradePct: number;
}

export interface Plan {
  version: 1;
  createdAt: string;
  race: RaceSettings;
  athlete: Athlete;
  model: ModelParams;
  course: {
    name: string;
    totalM: number;
    gainM: number;
    lossM: number;
    /** Profil tous les 100 m pour l'affichage. */
    profile: { d: number; ele: number }[];
    /** Trace allégée (≈ 25 m) pour la projection GPS. */
    snap: { d: number; lat: number; lon: number }[];
  };
  stepM: number;
  scenarios: { fast: Scenario; target: Scenario; slow: Scenario };
  phases: Phase[];
  landmarks: Landmark[];
  aidStations: AidStation[];
  climbs: Climb[];
  fuel: FuelItem[];
  morning: MorningItem[];
  checklist: string[];
  recovery: string[];
  feasibility: Feasibility;
}

export interface Feasibility {
  /** Allure plat équivalente demandée par l'objectif (s/km). */
  requiredFlatPace: number;
  requiredWatts?: number;
  predictedSec?: number;
  verdict: 'confortable' | 'réaliste' | 'ambitieux' | 'très ambitieux' | 'inconnu';
  message: string;
}

/** Point de recalage : à t secondes de course, le coureur était au km `km`. */
export interface Anchor {
  t: number;
  km: number;
  source: 'gps' | 'manual' | 'landmark';
  /** Horodatage (epoch ms) du recalage. */
  at: number;
}

export interface RaceEvent {
  id: string;
  kind: 'start' | 'gel' | 'drink' | 'aidSoon' | 'aid' | 'phase' | 'landmark' | 'final';
  /** 'time' = déclenché au temps de course ; 'km' = au passage du km (décalé par l'écart). */
  basis: 'time' | 'km';
  tSec: number;
  km: number;
  title: string;
  body: string;
  speech: string;
}
