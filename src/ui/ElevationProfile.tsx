import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { Course, Plan } from '../core/types';
import { useTheme } from './theme';

interface ProfileProps {
  profile: { d: number; ele: number }[];
  totalM: number;
  phases?: { fromKm: number; toKm: number }[];
  aidKm?: number[];
  currentKm?: number | null;
  height?: number;
}

function Profile({ profile, totalM, phases, aidKm = [], currentKm, height = 150 }: ProfileProps) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const eles = profile.map((p) => p.ele);
  const min = Math.min(...eles);
  const max = Math.max(...eles);
  const pad = Math.max(10, (max - min) * 0.12);
  const lo = min - pad;
  const hi = max + pad * 0.6;
  const top = 8;
  const band = phases?.length ? 5 : 0;
  const bottom = height - 18 - band;
  const x = (d: number) => (d / totalM) * w;
  const y = (e: number) => bottom - ((e - lo) / Math.max(1, hi - lo)) * (bottom - top);
  const line = profile.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ');
  const area = `${line} L${w.toFixed(1)},${bottom} L0,${bottom} Z`;
  const eleAt = (km: number) => profile[Math.min(profile.length - 1, Math.max(0, Math.round(((km * 1000) / totalM) * (profile.length - 1))))]?.ele ?? min;
  const stroke = t.dark ? t.accent : t.accentInk;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="tp-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={t.dark ? 0.35 : 0.3} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Line x1={0} x2={w} y1={y(max)} y2={y(max)} stroke={t.line} strokeDasharray="2,4" />
          <Line x1={0} x2={w} y1={y(min)} y2={y(min)} stroke={t.line} strokeDasharray="2,4" />
          <Path d={area} fill="url(#tp-fill)" />
          <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {phases?.map((p, i) => (
            <Rect
              key={i}
              x={x(p.fromKm * 1000) + (i ? 1 : 0)}
              y={bottom + 4}
              width={Math.max(0, x(p.toKm * 1000) - x(p.fromKm * 1000) - (i ? 1 : 0))}
              height={band}
              rx={2}
              fill={t.phase[i % t.phase.length]}
              opacity={0.85}
            />
          ))}
          {aidKm.map((k, i) => (
            <React.Fragment key={i}>
              <Line x1={x(k * 1000)} x2={x(k * 1000)} y1={y(eleAt(k))} y2={bottom} stroke={t.info} strokeWidth={1} strokeDasharray="3,3" />
              <Circle cx={x(k * 1000)} cy={y(eleAt(k))} r={3.5} fill={t.card} stroke={t.info} strokeWidth={2} />
            </React.Fragment>
          ))}
          {currentKm != null && (
            <>
              <Line x1={x(currentKm * 1000)} x2={x(currentKm * 1000)} y1={top} y2={bottom} stroke={t.text} strokeWidth={1.5} />
              <Circle cx={x(currentKm * 1000)} cy={y(eleAt(currentKm))} r={7} fill={t.text} opacity={0.2} />
              <Circle cx={x(currentKm * 1000)} cy={y(eleAt(currentKm))} r={4.5} fill={t.text} />
            </>
          )}
          <SvgText x={2} y={y(max) - 3} fill={t.sub} fontSize={10} fontWeight="600">
            {`${Math.round(max)} m`}
          </SvgText>
          <SvgText x={2} y={height - 3} fill={t.faint} fontSize={10}>
            0
          </SvgText>
          <SvgText x={w - 2} y={height - 3} fill={t.faint} fontSize={10} textAnchor="end">
            {`${(totalM / 1000).toFixed(1).replace('.', ',')} km`}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

/** Profil altimétrique d'un plan : phases en couleur, ravitos, position actuelle. */
export function ElevationProfile({ plan, currentKm, height }: { plan: Plan; currentKm?: number | null; height?: number }) {
  return (
    <Profile
      profile={plan.course.profile}
      totalM={plan.course.totalM}
      phases={plan.phases}
      aidKm={plan.aidStations.map((a) => a.km)}
      currentKm={currentKm}
      height={height}
    />
  );
}

/** Profil d'une trace importée (avant génération du plan). */
export function CourseProfile({ course, aidKm, height = 110 }: { course: Course; aidKm?: number[]; height?: number }) {
  const profile = useMemo(() => {
    const step = Math.max(1, Math.floor(course.points.length / 400));
    const out = course.points.filter((_, i) => i % step === 0);
    const last = course.points[course.points.length - 1];
    if (last && out[out.length - 1] !== last) out.push(last);
    return out;
  }, [course]);
  return <Profile profile={profile} totalM={course.totalM} aidKm={aidKm} height={height} />;
}
