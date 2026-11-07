// Lecture d'un GPX sans DOM (React Native n'a pas de DOMParser) et construction du parcours.
import { haversine, localXY } from './geo';
import type { Course, TrackPoint, Waypoint } from './types';

export interface RawGpx {
  name?: string;
  points: { lat: number; lon: number; ele: number | null }[];
  waypoints: Waypoint[];
  warnings: string[];
}

const attr = (tag: string, name: string): number | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`));
  return m ? parseFloat(m[1]) : null;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .trim();

type RawPt = { lat: number; lon: number; ele: number | null; name?: string };

/** Points d'un type de balise (trkpt, rtept, wpt), avec ou sans préfixe d'espace de noms. */
function parsePointTags(xml: string, tagName: string): RawPt[] {
  const out: RawPt[] = [];
  const re = new RegExp(`<(?:[\\w-]+:)?${tagName}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${tagName}>)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = attr(m[1], 'lat');
    const lon = attr(m[1], 'lon');
    if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const inner = m[2] || '';
    const e = inner.match(/<(?:[\w-]+:)?ele>\s*([-\d.eE+]+)\s*<\//);
    const n = inner.match(/<(?:[\w-]+:)?name>([\s\S]*?)<\//);
    const ele = e ? parseFloat(e[1]) : null;
    out.push({ lat, lon, ele: ele != null && isFinite(ele) ? ele : null, name: n ? decode(n[1]) : undefined });
  }
  return out;
}

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

const lengthOf = (pts: RawPt[]) => {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
  return d;
};

export function parseGpx(xml: string): RawGpx {
  if (!/<(?:[\w-]+:)?gpx[\s>]/i.test(xml)) throw new Error("Ce fichier n'est pas un GPX.");
  const warnings: string[] = [];
  // Un GPX peut contenir plusieurs tracés : tronçons à enchaîner, ou variantes (parcours de repli…).
  const tracks = blocks(xml, 'trk')
    .map((b) => parsePointTags(b, 'trkpt'))
    .filter((t) => t.length >= 2);
  let points: RawPt[] = [];
  if (tracks.length === 1) points = tracks[0];
  else if (tracks.length > 1) {
    const joins = tracks.slice(1).map((t, i) => {
      const prev = tracks[i][tracks[i].length - 1];
      return haversine(prev.lat, prev.lon, t[0].lat, t[0].lon);
    });
    if (joins.every((j) => j < 500)) {
      points = tracks.flat();
      warnings.push(`${tracks.length} tracés bout à bout ont été enchaînés.`);
    } else {
      const longest = tracks.reduce((a, b) => (lengthOf(b) > lengthOf(a) ? b : a));
      points = longest;
      warnings.push(
        `${tracks.length} tracés distincts (variantes ?) : le plus long (${(lengthOf(longest) / 1000).toFixed(1)} km) a été retenu.`,
      );
    }
  }
  if (points.length < 2) {
    const routes = blocks(xml, 'rte')
      .map((b) => parsePointTags(b, 'rtept'))
      .filter((t) => t.length >= 2);
    if (routes.length) points = routes.reduce((a, b) => (lengthOf(b) > lengthOf(a) ? b : a));
  }
  if (points.length < 2) throw new Error('Aucune trace (trkpt / rtept) dans ce GPX.');
  const wpts = parsePointTags(xml, 'wpt').map((w, i) => ({
    name: w.name || `Point ${i + 1}`,
    lat: w.lat,
    lon: w.lon,
  }));
  const nameMatch = xml.match(/<(?:[\w-]+:)?(?:trk|metadata)>[\s\S]*?<(?:[\w-]+:)?name>([\s\S]*?)<\//);
  return {
    name: nameMatch ? decode(nameMatch[1]) : undefined,
    points: points.map(({ lat, lon, ele }) => ({ lat, lon, ele })),
    waypoints: wpts,
    warnings,
  };
}

/** Rééchantillonne tous les `step` mètres, lisse l'altitude sur `smoothM` mètres. */
export function buildCourse(raw: RawGpx, name?: string, step = 10, smoothM = 50): Course {
  // 1) distances cumulées, en retirant les doublons
  const pts: { d: number; lat: number; lon: number; ele: number }[] = [];
  const hasElevation = raw.points.some((p) => p.ele != null);
  const warnings = [...(raw.warnings ?? [])];
  if (!hasElevation) warnings.push("Pas d'altitude dans ce GPX : le profil sera plat et le plan moins fiable. Exporte la trace depuis un outil qui ajoute l'altitude (Visorando, Strava, OpenRunner…).");
  let lastEle = raw.points.find((p) => p.ele != null)?.ele ?? 0;
  let d = 0;
  for (let i = 0; i < raw.points.length; i++) {
    const p = raw.points[i];
    const ele = p.ele ?? lastEle;
    lastEle = ele;
    if (i > 0) {
      const q = raw.points[i - 1];
      const ds = haversine(q.lat, q.lon, p.lat, p.lon);
      if (ds < 0.01) continue;
      d += ds;
    }
    pts.push({ d, lat: p.lat, lon: p.lon, ele });
  }
  const totalM = d;
  if (totalM < 100) throw new Error('Trace trop courte.');

  // D+ brut (avant lissage), pour info
  let rawGain = 0;
  for (let i = 1; i < pts.length; i++) rawGain += Math.max(0, pts[i].ele - pts[i - 1].ele);

  // 2) rééchantillonnage
  const res: TrackPoint[] = [];
  let j = 0;
  for (let s = 0; s <= totalM + 1e-6; s += step) {
    const target = Math.min(s, totalM);
    while (j < pts.length - 2 && pts[j + 1].d < target) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const f = b.d > a.d ? (target - a.d) / (b.d - a.d) : 0;
    res.push({
      d: target,
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      ele: a.ele + (b.ele - a.ele) * f,
    });
  }
  if (res[res.length - 1].d < totalM - 0.5) {
    const last = pts[pts.length - 1];
    res.push({ d: totalM, lat: last.lat, lon: last.lon, ele: last.ele });
  }

  // 3) lissage de l'altitude (moyenne glissante centrée)
  const half = Math.max(1, Math.round(smoothM / step / 2));
  const eles = res.map((p) => p.ele);
  for (let i = 0; i < res.length; i++) {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(res.length - 1, i + half); k++) {
      sum += eles[k];
      n++;
    }
    res[i].ele = sum / n;
  }

  let gain = 0;
  let loss = 0;
  for (let i = 1; i < res.length; i++) {
    const de = res[i].ele - res[i - 1].ele;
    if (de > 0) gain += de;
    else loss -= de;
  }

  // 4) projection des waypoints sur la trace
  const waypoints = raw.waypoints.map((w) => {
    const p = nearestOnTrack(res, w.lat, w.lon);
    return { ...w, km: p.d / 1000, offTrackM: p.dist };
  });

  return {
    name: name || raw.name || 'Ma course',
    points: res,
    totalM,
    gainM: gain,
    lossM: loss,
    rawGainM: rawGain,
    hasElevation,
    waypoints,
    warnings,
  };
}

/** Point de la trace le plus proche (sans contrainte de km). */
export function nearestOnTrack(points: { d: number; lat: number; lon: number }[], lat: number, lon: number) {
  let best = { d: 0, dist: Infinity };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const [bx, by] = localXY(b.lat, b.lon, a.lat, a.lon);
    const [px, py] = localXY(lat, lon, a.lat, a.lon);
    const len2 = bx * bx + by * by;
    const f = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const dx = px - f * bx;
    const dy = py - f * by;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < best.dist) best = { d: a.d + f * (b.d - a.d), dist };
  }
  return best;
}

const AID_RE =
  /ravit|ravito|ravitaillement|base de vie|\bbdv\b|refuge|\baid\b|aid station|feed|water|\beau\b|refresh|drop ?bag|life ?base|^r\d+\b|\bcp\d*\b|checkpoint|verpflegung|avituallamiento/i;

/** Arrêt par défaut selon le type de ravito. */
export function defaultStopSec(name: string): number {
  return /base de vie|\bbdv\b|life ?base|drop ?bag/i.test(name) ? 600 : 45;
}

export function looksLikeAidStation(name: string): boolean {
  return AID_RE.test(name);
}

/** Format compact pour le stockage (une trace de 300 km tient en moins d'1 Mo). */
export interface PackedCourse {
  v: 1;
  name: string;
  step: number;
  totalM: number;
  gainM: number;
  lossM: number;
  rawGainM: number;
  hasElevation: boolean;
  warnings: string[];
  waypoints: Course['waypoints'];
  lat: number[];
  lon: number[];
  ele: number[];
}

export function packCourse(c: Course): PackedCourse {
  const step = c.points.length > 1 ? c.points[1].d - c.points[0].d : 10;
  return {
    v: 1,
    name: c.name,
    step,
    totalM: c.totalM,
    gainM: c.gainM,
    lossM: c.lossM,
    rawGainM: c.rawGainM,
    hasElevation: c.hasElevation,
    warnings: c.warnings,
    waypoints: c.waypoints,
    lat: c.points.map((p) => Math.round(p.lat * 1e6) / 1e6),
    lon: c.points.map((p) => Math.round(p.lon * 1e6) / 1e6),
    ele: c.points.map((p) => Math.round(p.ele * 10) / 10),
  };
}

export function unpackCourse(p: PackedCourse): Course {
  const n = p.lat.length;
  const points: TrackPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    points[i] = { d: i === n - 1 ? p.totalM : Math.min(i * p.step, p.totalM), lat: p.lat[i], lon: p.lon[i], ele: p.ele[i] };
  }
  const { lat: _a, lon: _b, ele: _c, v: _v, step: _s, ...rest } = p;
  return { ...rest, points };
}
