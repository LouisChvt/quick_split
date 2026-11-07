import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Plan } from '../core/types';
import { useTheme } from './theme';

/** Profil altimétrique : phases en couleur, ravitos, position actuelle. */
export function ElevationProfile({ plan, currentKm, height = 150 }: { plan: Plan; currentKm?: number | null; height?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const prof = plan.course.profile;
  const totalM = plan.course.totalM;
  const eles = prof.map((p) => p.ele);
  const min = Math.min(...eles);
  const max = Math.max(...eles);
  const pad = Math.max(10, (max - min) * 0.1);
  const lo = min - pad;
  const hi = max + pad;
  const top = 6;
  const bottom = height - 18;
  const x = (d: number) => (d / totalM) * w;
  const y = (e: number) => bottom - ((e - lo) / Math.max(1, hi - lo)) * (bottom - top);
  const line = prof.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${bottom} L0,${bottom} Z`;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {plan.phases.map((p, i) => (
            <Rect
              key={i}
              x={x(p.fromKm * 1000)}
              y={top}
              width={Math.max(0, x(p.toKm * 1000) - x(p.fromKm * 1000))}
              height={bottom - top}
              fill={t.phase[i % t.phase.length]}
              opacity={0.1}
            />
          ))}
          <Path d={area} fill={t.accent} opacity={0.18} />
          <Path d={line} stroke={t.text} strokeWidth={1.6} fill="none" />
          {plan.aidStations.map((a, i) => (
            <Line key={i} x1={x(a.km * 1000)} x2={x(a.km * 1000)} y1={top} y2={bottom} stroke={t.info} strokeDasharray="4,3" />
          ))}
          {currentKm != null && (
            <>
              <Line x1={x(currentKm * 1000)} x2={x(currentKm * 1000)} y1={top} y2={bottom} stroke={t.warn} strokeWidth={2} />
              <Circle
                cx={x(currentKm * 1000)}
                cy={y(prof[Math.min(prof.length - 1, Math.round((currentKm * 1000) / 100))]?.ele ?? min)}
                r={5}
                fill={t.warn}
              />
            </>
          )}
          <SvgText x={2} y={height - 4} fill={t.sub} fontSize={10}>
            0
          </SvgText>
          <SvgText x={w - 2} y={height - 4} fill={t.sub} fontSize={10} textAnchor="end">
            {(totalM / 1000).toFixed(1)} km
          </SvgText>
          <SvgText x={2} y={top + 10} fill={t.sub} fontSize={10}>
            {Math.round(max)} m
          </SvgText>
        </Svg>
      )}
    </View>
  );
}
