// Repères de passage avec fenêtres d'horaires. Toucher un repère en course = recalage.
import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { chrono, clock, clockRel, km as fkm, plannedStartMs } from '../core/format';
import { estimateKm } from '../core/position';
import type { LandmarkKind } from '../core/types';
import { recalibrate } from '../services/controller';
import { useAppState } from '../state/store';
import { Card, H, Label, P } from '../ui/components';
import { useTheme } from '../ui/theme';

const ICON: Record<LandmarkKind, string> = {
  start: '🚩',
  finish: '🏁',
  aid: '🥤',
  summit: '⛰️',
  low: '⤵️',
  km: '📍',
  waypoint: '📌',
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

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card>
        <H>Passages</H>
        <P sub>
          Heures {running ? 'calées sur ton départ réel' : `prévues pour un départ à ${clock(base)}`}. Fenêtre :{' '}
          {chrono(plan.scenarios.fast.totalSec)} – {chrono(plan.scenarios.slow.totalSec)}.
          {running ? ' Touche un repère au moment où tu y passes pour recaler ta position.' : ''}
        </P>
      </Card>
      {plan.landmarks.map((l) => {
        const passed = running && kmNow >= l.km - 0.02;
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
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.card,
                borderColor: l.kind === 'aid' ? t.info : t.line,
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
                opacity: passed ? 0.45 : 1,
              }}
            >
              <Text style={{ fontSize: 22, width: 34 }}>{ICON[l.kind]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
                  {l.name}
                </Text>
                <Label style={{ marginBottom: 0 }}>
                  km {fkm(l.km)} · alt. {Math.round(l.ele)} m
                </Label>
                {cutoffOf(l.km) != null ? (
                  <Text
                    style={{
                      color: cutoffOf(l.km)! < l.tSlow + (base - planned) / 1000 ? t.bad : t.warn,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    Barrière {clockRel(planned + cutoffOf(l.km)! * 1000, planned)}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: t.text, fontWeight: '900', fontSize: 20, fontVariant: ['tabular-nums'] }}>
                  {clockRel(base + l.tTarget * 1000, base)}
                </Text>
                <Text style={{ color: t.sub, fontSize: 12, fontVariant: ['tabular-nums'] }}>
                  {clock(base + l.tFast * 1000)}–{clock(base + l.tSlow * 1000)} · {chrono(l.tTarget)}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
