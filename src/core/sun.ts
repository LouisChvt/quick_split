// Lever / coucher du soleil (algorithme NOAA simplifié, précision ≈ 1 à 2 min), sans réseau.
const rad = Math.PI / 180;

/**
 * Heures de lever et de coucher (epoch ms) pour le jour civil UTC contenant `dayMs`, au point lat/lon.
 * Renvoie null pour un jour polaire ou une nuit polaire.
 */
export function sunTimes(dayMs: number, lat: number, lon: number): { sunrise: number; sunset: number } | null {
  const d = new Date(dayMs);
  const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const jd = day0 / 86400000 + 2440587.5;
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  const cosH =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH) / rad;
  const toMs = (j: number) => (j - 2440587.5) * 86400000;
  return { sunrise: toMs(jTransit - H / 360), sunset: toMs(jTransit + H / 360) };
}

/** Couchers et levers de soleil qui tombent entre fromMs et toMs. */
export function sunEventsBetween(fromMs: number, toMs: number, lat: number, lon: number) {
  const out: { kind: 'sunset' | 'sunrise'; at: number }[] = [];
  for (let t = fromMs - 86400000; t <= toMs + 86400000; t += 86400000) {
    const s = sunTimes(t, lat, lon);
    if (!s) continue;
    if (s.sunrise > fromMs && s.sunrise < toMs) out.push({ kind: 'sunrise', at: s.sunrise });
    if (s.sunset > fromMs && s.sunset < toMs) out.push({ kind: 'sunset', at: s.sunset });
  }
  return out
    .sort((a, b) => a.at - b.at)
    .filter((e, i, arr) => i === 0 || Math.abs(e.at - arr[i - 1].at) > 3600000);
}
