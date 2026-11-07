import { useColorScheme } from 'react-native';
import { useAppState } from '../state/store';

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  card2: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  accentText: string;
  good: string;
  warn: string;
  bad: string;
  info: string;
  phase: string[];
}

const dark: Theme = {
  dark: true,
  bg: '#0A0E13',
  card: '#141A22',
  card2: '#1C2430',
  text: '#F3F6F9',
  sub: '#98A6B5',
  line: '#283240',
  accent: '#3DDC97',
  accentText: '#04150D',
  good: '#3DDC97',
  warn: '#FFB547',
  bad: '#FF6B6B',
  info: '#5AB2FF',
  phase: ['#5AB2FF', '#3DDC97', '#C792EA', '#FFB547', '#FF6B6B'],
};

const light: Theme = {
  dark: false,
  bg: '#F3F5F8',
  card: '#FFFFFF',
  card2: '#EDF1F5',
  text: '#0D131A',
  sub: '#566475',
  line: '#D9E0E7',
  accent: '#0B9B63',
  accentText: '#FFFFFF',
  good: '#0B9B63',
  warn: '#B86E00',
  bad: '#D63B3B',
  info: '#1F6FC5',
  phase: ['#1F6FC5', '#0B9B63', '#8E44C5', '#B86E00', '#D63B3B'],
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const { prefs } = useAppState();
  const mode = prefs.theme === 'auto' ? (scheme === 'light' ? 'light' : 'dark') : prefs.theme;
  return mode === 'light' ? light : dark;
}
