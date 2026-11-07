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

/** Ultra de montagne synthétique (≈ 72 km, ≈ 4 700 m D+, une base de vie, un aller-retour final). */
export function demoUltraGpx(): string {
  const lat0 = 45.9;
  const lon0 = 6.86;
  const pos = (u: number) => {
    if (u < 0.85) {
      const a = (u / 0.85) * 2 * Math.PI;
      return { lat: lat0 + 0.09 * Math.sin(a), lon: lon0 + 0.13 * (1 - Math.cos(a)) };
    }
    const v = u < 0.925 ? (u - 0.85) / 0.075 : 1 - (u - 0.925) / 0.075;
    return { lat: lat0 - 0.04 * v, lon: lon0 };
  };
  const pts: string[] = [];
  const n = 8000;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const { lat, lon } = pos(u);
    const ele = 1050 + 750 * Math.sin(6 * Math.PI * u) ** 2 + 250 * Math.sin(2 * Math.PI * u) + 60 * Math.sin(31 * Math.PI * u);
    pts.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${ele.toFixed(1)}</ele></trkpt>`);
  }
  const wpt = (u: number, name: string) => {
    const { lat, lon } = pos(u);
    return `<wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${name}</name></wpt>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailPacer demo" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>Ultra démo 72 km</name></metadata>
${wpt(0.2, 'Ravito Chalet')}
${wpt(0.45, 'Base de vie')}
${wpt(0.7, 'Ravito Col')}
${wpt(0.925, 'Demi-tour')}
<trk><name>Ultra démo 72 km</name><trkseg>
${pts.join('\n')}
</trkseg></trk></gpx>`;
}
