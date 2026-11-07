const R = 6371008.8;
const toRad = (x: number) => (x * Math.PI) / 180;

/** Distance haversine en mètres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Projection locale équirectangulaire (mètres) autour d'une latitude de référence. */
export function localXY(lat: number, lon: number, lat0: number, lon0: number): [number, number] {
  const x = toRad(lon - lon0) * R * Math.cos(toRad(lat0));
  const y = toRad(lat - lat0) * R;
  return [x, y];
}

/** Interpolation linéaire dans un tableau croissant xs → ys. */
export function interp(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (n === 0) return NaN;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  if (span === 0) return ys[lo];
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / span;
}
