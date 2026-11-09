import { useColorScheme } from 'react-native';
import { useAppState } from '../state/store';

/**
 * Charte TrailPacer : fond « nuit de montagne », accent citron vert très lisible en plein soleil
 * comme de nuit, chiffres en gras tabulaires façon montre de sport.
 */
export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  card2: string;
  text: string;
  sub: string;
  faint: string;
  line: string;
  /** Remplissage des boutons et indicateurs principaux. */
  accent: string;
  /** Texte posé sur `accent`. */
  accentText: string;
  /** Accent utilisé comme couleur de texte sur le fond. */
  accentInk: string;
  good: string;
  warn: string;
  bad: string;
  info: string;
  phase: string[];
}

const dark: Theme = {
  dark: true,
  bg: '#0B0E12',
  card: '#151A21',
  card2: '#1F252E',
  text: '#F2F4F7',
  sub: '#8D97A5',
  faint: '#5B6573',
  line: '#262D37',
  accent: '#C8F03C',
  accentText: '#0B0E12',
  accentInk: '#C8F03C',
  good: '#4ADE80',
  warn: '#FBBF24',
  bad: '#F87171',
  info: '#60A5FA',
  phase: ['#60A5FA', '#4ADE80', '#C084FC', '#FBBF24', '#F87171'],
};

const light: Theme = {
  dark: false,
  bg: '#F3F4EF',
  card: '#FFFFFF',
  card2: '#ECEEE7',
  text: '#12161C',
  sub: '#5E6772',
  faint: '#98A0A9',
  line: '#E1E4DB',
  accent: '#C8F03C',
  accentText: '#12161C',
  accentInk: '#4D7C0F',
  good: '#15803D',
  warn: '#B45309',
  bad: '#DC2626',
  info: '#2563EB',
  phase: ['#2563EB', '#15803D', '#9333EA', '#B45309', '#DC2626'],
};

/** Couleur hexadécimale #RRGGBB avec une opacité (0 à 1). */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? hex + v : hex;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const { prefs } = useAppState();
  const mode = prefs.theme === 'auto' ? (scheme === 'light' ? 'light' : 'dark') : prefs.theme;
  return mode === 'light' ? light : dark;
}
