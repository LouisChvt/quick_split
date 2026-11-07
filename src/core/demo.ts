// Parcours de démonstration synthétique (≈ 21 km, ≈ 600 m D+), pour essayer l'app sans GPX.
export function demoGpx(): string {
  const lat0 = 44.05;
  const lon0 = 4.3;
  const pts: string[] = [];
  const n = 900;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * 2 * Math.PI;
    // boucle déformée : rayon variable pour éviter un cercle parfait
    const r = 0.028 + 0.006 * Math.sin(3 * a) + 0.003 * Math.cos(5 * a);
    const lat = lat0 + r * Math.sin(a);
    const lon = lon0 + (r * Math.cos(a)) / Math.cos((lat0 * Math.PI) / 180) - 0.0362;
    const ele =
      120 +
      140 * Math.sin(Math.PI * u) ** 2 +
      45 * Math.sin(6 * Math.PI * u) +
      20 * Math.sin(17 * Math.PI * u) * Math.sin(Math.PI * u);
    pts.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${ele.toFixed(1)}</ele></trkpt>`);
  }
  const wpt = (u: number, name: string) => {
    const a = u * 2 * Math.PI;
    const r = 0.028 + 0.006 * Math.sin(3 * a) + 0.003 * Math.cos(5 * a);
    const lat = lat0 + r * Math.sin(a);
    const lon = lon0 + (r * Math.cos(a)) / Math.cos((lat0 * Math.PI) / 180) - 0.0362;
    return `<wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${name}</name></wpt>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailPacer demo" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>Trail démo 21 km</name></metadata>
${wpt(0.36, 'Ravito 1')}
${wpt(0.7, 'Ravito 2')}
<trk><name>Trail démo 21 km</name><trkseg>
${pts.join('\n')}
</trkseg></trk></gpx>`;
}
