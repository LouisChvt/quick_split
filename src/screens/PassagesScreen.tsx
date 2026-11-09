// Repères de passage avec fenêtres d'horaires, en frise. Toucher un repère en course = recalage.
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { chrono, clock, clockRel, km as fkm, plannedStartMs } from '../core/format';
import { estimateKm } from '../core/position';
import type { LandmarkKind } from '../core/types';
import { recalibrate } from '../services/controller';
import { useAppState } from '../state/store';
import { Badge, Screen } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { alpha, useTheme } from '../ui/theme';

const ICON: Record<LandmarkKind, IconName> = {
  start: 'flag',
  finish: 'goal',
  aid: 'drop',
  summit: 'mountain',
  low: 'low',
  km: 'pin',
  waypoint: 'pin',
};

export function PassagesScreen({ now }: { now: number }) {
  const t = useTheme();
  const { plan, session } = useAppState();
  if (!plan) return null;
  const running = !!session && !session.finishedAt;
  const base = running ? session!.startMs : plannedStartMs(plan.race.date, plan.race.startTime) ?? now;
  const kmNow = running ? estimateKm(plan, (now - session!.startMs) / 1000, session!.anchor) : -1;
  const planned = plannedStartMs(plan.race.date, plan.race.startTime) ?? base;
  const cutoffOf = (km: number) => plan.aidStations.find((a) => Math.abs(a.km - km) < 0.05)?.cutoffSec;
  const nextIdx = running ? plan.landmarks.findIndex((l) => l.km > kmNow + 0.02) : -1;
  const kindColor = (k: LandmarkKind) =>
    k === 'aid' ? t.info : k === 'summit' ? t.warn : k === 'start' || k === 'finish' ? (t.dark ? t.accent : t.accentInk) : t.sub;

  return (
    <Screen
      title="Passages"
      subtitle={
        running
          ? 'Calés sur ton départ réel. Touche un repère quand tu y passes pour recaler.'
          : `Pour un départ à ${clock(base)} · fenêtre ${chrono(plan.scenarios.fast.totalSec)} – ${chrono(plan.scenarios.slow.totalSec)}`
      }
    >
      <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, paddingVertical: 6 }}>
        {plan.landmarks.map((l, i) => {
          const passed = running && kmNow >= l.km - 0.02;
          const isNext = i === nextIdx;
          const c = kindColor(l.kind);
          const cut = cutoffOf(l.km);
          const last = i === plan.landmarks.length - 1;
          return (
            <Pressable
              key={l.id}
              disabled={!running}
              onPress={() =>
                Alert.alert('Recaler ici ?', `${l.name} — km ${fkm(l.km)}`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Je suis ici', onPress: () => recalibrate(l.km, 'landmark') },
                ])
              }
              style={({ pressed }) => [{ opacity: passed ? 0.4 : pressed ? 0.7 : 1 }, isNext && { backgroundColor: alpha(t.accent, t.dark ? 0.07 : 0.18) }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 14 }}>
                {/* frise */}
                <View style={{ width: 36, alignItems: 'center' }}>
                  <View style={{ width: 2, height: 12, backgroundColor: i ? t.line : 'transparent' }} />
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(c, 0.15) }}>
                    <Icon name={passed ? 'check' : ICON[l.kind]} size={16} color={c} />
                  </View>
                  <View style={{ flex: 1, width: 2, backgroundColor: last ? 'transparent' : t.line }} />
                </View>
                <View style={{ flex: 1, paddingVertical: 12, paddingLeft: 10 }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <Text style={{ color: t.sub, fontSize: 13, marginTop: 1, fontVariant: ['tabular-nums'] }}>
                    km {fkm(l.km)} · {Math.round(l.ele)} m
                  </Text>
                  {cut != null || isNext ? (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {isNext ? <Badge text="Prochain" color={t.dark ? t.accent : t.accentInk} /> : null}
                      {cut != null ? (
                        <Badge
                          text={`Barrière ${clockRel(planned + cut * 1000, planned)}`}
                          color={cut < l.tSlow + (base - planned) / 1000 ? t.bad : t.warn}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', paddingVertical: 12, paddingLeft: 8 }}>
                  <Text style={{ color: t.text, fontWeight: '800', fontSize: 20, fontVariant: ['tabular-nums'], letterSpacing: -0.4 }}>
                    {clockRel(base + l.tTarget * 1000, base)}
                  </Text>
                  <Text style={{ color: t.sub, fontSize: 12, fontVariant: ['tabular-nums'], marginTop: 1 }}>
                    {clock(base + l.tFast * 1000)}–{clock(base + l.tSlow * 1000)}
                  </Text>
                  <Text style={{ color: t.faint, fontSize: 12, fontVariant: ['tabular-nums'] }}>{chrono(l.tTarget)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
