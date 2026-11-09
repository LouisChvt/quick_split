// Icônes vectorielles (trait 2 px, grille 24), dessinées avec react-native-svg : aucune police ni dépendance.
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type Shape = string | [number, number, number];

const ICONS = {
  timer: ['M10 2h4', 'M12 14l3-3', [12, 14, 8]],
  pin: ['M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0', [12, 10, 3]],
  map: [
    'M14.1 5.55a2 2 0 0 0 1.8 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.56 2.27a2 2 0 0 1-1.78 0l-4.22-2.1a2 2 0 0 0-1.78 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.56-2.27a2 2 0 0 1 1.78 0z',
    'M15 5.76v15',
    'M9 3.24v15',
  ],
  sliders: ['M21 4h-7', 'M10 4H3', 'M21 12h-9', 'M8 12H3', 'M21 20h-5', 'M12 20H3', 'M14 2v4', 'M8 10v4', 'M16 18v4'],
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  goal: ['M12 13V2l8 4-8 4', 'M20.56 10.22a9 9 0 1 1-12.55-5.29', 'M8 10a5 5 0 1 0 8.9 2.02'],
  mountain: ['M8 3l4 8 5-5 5 15H2L8 3z'],
  low: ['M12 3v12', 'M6 9l6 6 6-6', 'M5 21h14'],
  drop: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  chevronRight: ['M9 18l6-6-6-6'],
  plus: ['M5 12h14', 'M12 5v14'],
  minus: ['M5 12h14'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  play: ['M6 3l14 9-14 9z'],
  volume: ['M11 5L6 9H2v6h4l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  gps: [[12, 12, 7], [12, 12, 2.5], 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3'],
  heart: ['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  alert: ['M21.7 18l-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z', 'M12 9v4', 'M12 17h.01'],
  check: ['M20 6L9 17l-5-5'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
  sun: [[12, 12, 4], 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M6.3 17.7l-1.4 1.4', 'M19.1 4.9l-1.4 1.4'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', [12, 12, 3]],
  clock: [[12, 12, 10], 'M12 6v6l4 2'],
  route: [[6, 19, 3], 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15', [18, 5, 3]],
  user: [[12, 7, 4], 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'],
  food: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7'],
  gauge: ['M12 14l4-4', 'M3.34 19a10 10 0 1 1 17.32 0'],
  recal: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
  info: [[12, 12, 10], 'M12 16v-4', 'M12 8h.01'],
  phone: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color, stroke = 2 }: { name: IconName; size?: number; color: string; stroke?: number }) {
  const fill = name === 'play' ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(ICONS[name] as Shape[]).map((sh, i) =>
        typeof sh === 'string' ? (
          <Path key={i} d={sh} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
        ) : (
          <Circle key={i} cx={sh[0]} cy={sh[1]} r={sh[2]} stroke={color} strokeWidth={stroke} fill="none" />
        ),
      )}
    </Svg>
  );
}
