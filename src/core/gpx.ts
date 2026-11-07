// Lecture d'un GPX sans DOM (React Native n'a pas de DOMParser) et construction du parcours.
import { haversine, localXY } from './geo';
import type { Course, TrackPoint, Waypoint } from './types';

export interface RawGpx {
  name?: string;
  points: { lat: number; lon: number; ele: number | null }[];
  waypoints: Waypoint[];
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

function parsePointTags(xml: string, tagName: string) {
  const out: { lat: number; lon: number; ele: number | null; name?: string }[] = [];
  const re = new RegExp(`<${tagName}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tagName}>)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = attr(m[1], 'lat');
    const lon = attr(m[1], 'lon');
    if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) continue;
    const inner = m[2] || '';
    const e = inner.match(/<ele>\s*([-\d.eE+]+)\s*<\/ele>/);
    const n = inner.match(/<name>([\s\S]*?)<\/name>/);
    out.push({ lat, lon, ele: e ? parseFloat(e[1]) : null, name: n ? decode(n[1]) : undefined });
  }
  return out;
}

export function parseGpx(xml: string): RawGpx {
  if (!/<gpx[\s>]/i.test(xml)) throw new Error("Ce fichier n'est pas un GPX.");
  let points = parsePointTags(xml, 'trkpt');
  if (points.length < 2) points = parsePointTags(xml, 'rtept');
  if (points.length < 2) throw new Error('Aucune trace (trkpt / rtept) dans ce GPX.');
  const wpts = parsePointTags(xml, 'wpt').map((w, i) => ({
    name: w.name || `Point ${i + 1}`,
    lat: w.lat,
    lon: w.lon,
  }));
  const nameMatch = xml.match(/<(?:trk|metadata)>[\s\S]*?<name>([\s\S]*?)<\/name>/);
  return {
    name: nameMatch ? decode(nameMatch[1]) : undefined,
    points: points.map(({ lat, lon, ele }) => ({ lat, lon, ele })),
    waypoints: wpts,
  };
}

/** Rééchantillonne tous les `step` mètres, lisse l'altitude sur `smoothM` mètres. */
export function buildCourse(raw: RawGpx, name?: string, step = 10, smoothM = 50): Course {
  // 1) distances cumulées, en retirant les doublons
  const pts: { d: number; lat: number; lon: number; ele: number }[] = [];
  const hasElevation = raw.points.some((p) => p.ele != null);
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

const AID_RE = /ravit|ravito|ravitaillement|\baid\b|feed|water|\beau\b|refresh|^r\d+\b|\bcp\d*\b|checkpoint/i;

export function looksLikeAidStation(name: string): boolean {
  return AID_RE.test(name);
}
