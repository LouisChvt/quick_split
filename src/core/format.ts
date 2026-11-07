// Formats d'affichage (français) et de synthèse vocale.

const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** Heure d'horloge locale au format « 11h03 ». */
export function clock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours()}h${pad(d.getMinutes())}`;
}

/** Heure lisible par la synthèse vocale : « 11 heures 03 ». */
export function clockSpeech(epochMs: number): string {
  const d = new Date(epochMs);
  const m = d.getMinutes();
  return `${d.getHours()} heures${m ? ' ' + pad(m) : ''}`;
}

/** Durée courte : « 3h20 », « 42 min ». */
export function durHM(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h${pad(m)}`;
}

/** Chrono : « 1:12:34 » ou « 12:34 ». */
export function chrono(sec: number): string {
  const neg = sec < 0;
  const s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const body = h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
  return (neg ? '-' : '') + body;
}

/** Écart signé : « +1:20 » (retard) ou « −0:40 » (avance). */
export function deltaStr(sec: number): string {
  const s = Math.round(sec);
  if (Math.abs(s) < 5) return '±0:00';
  const sign = s > 0 ? '+' : '−';
  const a = Math.abs(s);
  return `${sign}${Math.floor(a / 60)}:${pad(a % 60)}`;
}

/** Écart pour la voix : « 1 minute 20 de retard ». */
export function deltaSpeech(sec: number): string {
  const s = Math.round(Math.abs(sec) / 10) * 10;
  if (s < 10) return "pile dans l'objectif";
  const m = Math.floor(s / 60);
  const r = s % 60;
  let txt = '';
  if (m > 0) txt += `${m} minute${m > 1 ? 's' : ''}`;
  if (r > 0) txt += (m > 0 ? ` ${r}` : `${r} secondes`);
  return `${txt} ${sec > 0 ? 'de retard' : "d'avance"}`;
}

/** Durée pour la voix : « 3 heures 21 », « 42 minutes ». */
export function durSpeech(sec: number): string {
  const s = Math.max(0, Math.round(sec / 60) * 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} minutes`;
  return `${h} heure${h > 1 ? 's' : ''}${m ? ' ' + pad(m) : ''}`;
}

/** Allure : « 5'20/km ». */
export function pace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '–';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}'${pad(s % 60)}`;
}

/** Kilomètres : « 14,6 ». */
export function km(x: number, digits = 1): string {
  return x.toFixed(digits).replace('.', ',');
}

/** Lecture tolérante d'un temps « 3h20 », « 3:20 », « 3:20:30 », « 200 » (minutes). */
export function parseDuration(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  let m = t.match(/^(\d+)h(\d{1,2})?(?:[:'m](\d{1,2}))?$/);
  if (m) return +m[1] * 3600 + (m[2] ? +m[2] * 60 : 0) + (m[3] ? +m[3] : 0);
  m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0);
  m = t.match(/^(\d+)$/);
  if (m) return +m[1] * 60;
  return null;
}

/** Lecture d'une allure « 5'20 », « 5:20 ». */
export function parsePace(input: string): number | null {
  const m = input.trim().match(/^(\d+)\s*['’:m]\s*(\d{1,2})?/);
  if (!m) return null;
  return +m[1] * 60 + (m[2] ? +m[2] : 0);
}

/** Nombre décimal acceptant la virgule. */
export function num(input: string | undefined): number | undefined {
  if (input == null) return undefined;
  const v = parseFloat(String(input).replace(',', '.'));
  return isFinite(v) ? v : undefined;
}

/** Epoch ms du départ prévu à partir de « AAAA-MM-JJ » et « HH:MM » (heure locale). */
export function plannedStartMs(date: string, time: string): number | null {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.match(/^(\d{1,2})[:hH](\d{2})$/);
  if (!d || !t) return null;
  return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], 0, 0).getTime();
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « samedi 7 novembre » (sans dépendre d'Intl). */
export function dayLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Compte à rebours lisible : « J-3 », « dans 2h15 », « dans 12 min ». */
export function countdown(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s >= 36 * 3600) return `J-${Math.ceil(s / 86400)}`;
  if (s >= 3600) return `dans ${durHM(s)}`;
  if (s >= 60) return `dans ${Math.ceil(s / 60)} min`;
  return `dans ${Math.max(0, s)} s`;
}
