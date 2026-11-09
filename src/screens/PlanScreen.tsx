// Vue d'ensemble du plan : faisabilité, profil, phases détaillées, nutrition, montées, zones.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { chrono, clock, durHM, km as fkm, pace, plannedStartMs } from '../core/format';
import { hrZones } from '../core/plan';
import { sunEventsBetween } from '../core/sun';
import { useAppState } from '../state/store';
import { Badge, Banner, Bullets, Card, GroupTitle, Label, P, Row, Screen, Section, Stat, TileGrid } from '../ui/components';
import { ElevationProfile } from '../ui/ElevationProfile';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';

const FORMAT = { court: 'Court', standard: 'Standard', ultra: 'Ultra' } as const;

export function PlanScreen() {
  const t = useTheme();
  const { plan, session } = useAppState();
  const [open, setOpen] = useState<number | null>(0);
  if (!plan) return null;
  const base = session?.startMs ?? plannedStartMs(plan.race.date, plan.race.startTime) ?? Date.now();
  const f = plan.feasibility;
  const tone = f.verdict === 'confortable' || f.verdict === 'réaliste' ? 'good' : f.verdict === 'ambitieux' ? 'warn' : f.verdict === 'inconnu' ? 'info' : 'bad';
  const zones = hrZones(plan.athlete);
  const planned = plannedStartMs(plan.race.date, plan.race.startTime) ?? base;
  const first = plan.course.snap[0];
  const sun = first ? sunEventsBetween(base, base + plan.scenarios.slow.totalSec * 1000, first.lat, first.lon) : [];

  return (
    <Screen title={plan.race.name} subtitle={`${plan.race.date} · départ ${plan.race.startTime}`}>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <Stat label="Distance" value={`${fkm(plan.course.totalM / 1000)} km`} size={20} />
          <Stat label="D+" value={`${Math.round(plan.course.gainM)} m`} size={20} />
          <Stat label="Objectif" value={durHM(plan.scenarios.target.totalSec)} size={20} />
          <Stat label="Format" value={FORMAT[plan.format ?? 'standard']} size={20} align="right" />
        </Row>
        <ElevationProfile plan={plan} />
        <Row style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <Badge text={`Fenêtre ${chrono(plan.scenarios.fast.totalSec)} – ${chrono(plan.scenarios.slow.totalSec)}`} />
          {sun.map((x, i) => (
            <Badge key={i} text={`${x.kind === 'sunset' ? 'Nuit' : 'Jour'} à ${clock(x.at)}`} color={x.kind === 'sunset' ? t.info : t.warn} />
          ))}
        </Row>
      </Card>

      <Banner tone={tone} icon={tone === 'good' ? 'check' : tone === 'info' ? 'info' : 'alert'}>
        <Label color={t[tone]} style={{ marginBottom: 2 }}>
          Faisabilité · {f.verdict}
        </Label>
        <P style={{ fontSize: 14, lineHeight: 20 }}>{f.message}</P>
      </Banner>
      {sun.some((x) => x.kind === 'sunset') ? (
        <Banner tone="info" icon="moon">
          Course de nuit : frontale obligatoire, l'app te prévient 20 min avant le coucher du soleil.
        </Banner>
      ) : null}

      <GroupTitle>Phases</GroupTitle>
      {plan.phases.map((p) => {
        const c = t.phase[p.index % t.phase.length];
        return (
          <Section
            key={p.index}
            icon="flag"
            color={c}
            title={`${p.index + 1}. ${p.name}`}
            summary={`km ${fkm(p.fromKm)} → ${fkm(p.toKm)} · ${clock(base + p.tStart * 1000)} → ${clock(base + p.tEnd * 1000)}`}
            open={open === p.index}
            onToggle={() => setOpen((o) => (o === p.index ? null : p.index))}
          >
            <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
              km {fkm(p.fromKm)} → {fkm(p.toKm)} · {clock(base + p.tStart * 1000)} → {clock(base + p.tEnd * 1000)}
            </Text>
            <P>{p.objective}</P>
            <TileGrid tiles={p.tiles} />
            <Row style={{ gap: 6, marginTop: 16, marginBottom: 8 }}>
              <Icon name="alert" size={14} color={t.warn} />
              <Label color={t.warn} style={{ marginBottom: 0 }}>
                À surveiller
              </Label>
            </Row>
            <Bullets items={p.watch} color={t.warn} />
            <Label style={{ marginTop: 16, marginBottom: 8 }}>Consignes</Label>
            <Bullets items={p.tips} color={c} />
          </Section>
        );
      })}

      <GroupTitle>Nutrition et ravitos</GroupTitle>
      <Card>
        {[
          ...plan.fuel.map((g) => ({
            key: g.id,
            at: g.tSec,
            left: clock(base + g.tSec * 1000),
            text: g.label,
            sub: g.tSec > 0 ? `km ${fkm(g.km)} · ${durHM(g.tSec)}` : 'avant le départ',
            color: t.warn,
            icon: 'food' as const,
          })),
          ...plan.aidStations.map((a, i) => ({
            key: `aid${i}`,
            at: Number.POSITIVE_INFINITY,
            left: `km ${fkm(a.km)}`,
            text: a.name,
            sub: `arrêt ${a.stopSec >= 120 ? durHM(a.stopSec) : `${a.stopSec} s`}${a.cutoffSec != null ? ` · barrière ${clock(planned + a.cutoffSec * 1000)}` : ''}`,
            color: t.info,
            icon: 'drop' as const,
          })),
        ].map((r, i, arr) => (
          <Row key={r.key} style={{ gap: 12, paddingVertical: 8, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
            <Icon name={r.icon} size={16} color={r.color} />
            <Text style={{ color: t.text, width: 62, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{r.left}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{r.text}</Text>
              <Text style={{ color: t.sub, fontSize: 13 }}>{r.sub}</Text>
            </View>
          </Row>
        ))}
      </Card>

      {plan.climbs.length ? (
        <>
          <GroupTitle>Montées notables</GroupTitle>
          <Card>
            {plan.climbs.map((c, i) => (
              <Row key={i} style={{ gap: 12, paddingVertical: 8, borderBottomWidth: i < plan.climbs.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
                <Icon name="mountain" size={16} color={t.warn} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>
                    km {fkm(c.fromKm)} → {fkm(c.toKm)}
                  </Text>
                  <Text style={{ color: t.sub, fontSize: 13 }}>
                    {Math.round(c.avgGradePct)} % de moyenne · max {Math.round(c.maxGradePct)} %
                  </Text>
                </View>
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 17, fontVariant: ['tabular-nums'] }}>+{Math.round(c.gainM)} m</Text>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {zones ? (
        <>
          <GroupTitle>Zones de FC</GroupTitle>
          <Card>
            {[...zones, null].map((z, i) => {
              const color = ['#94A3B8', t.info, t.good, t.warn, '#FB923C', t.bad][i];
              const range = i === 0 ? `< ${z}` : z == null ? `> ${zones[4]}` : `${zones[i - 1] + 1} – ${z}`;
              return (
                <Row key={i} style={{ gap: 12, marginBottom: i < 5 ? 8 : 0 }}>
                  <View style={{ width: 32, height: 22, borderRadius: 6, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#0B0E12', fontWeight: '800', fontSize: 12 }}>Z{i + 1}</Text>
                  </View>
                  <Text style={{ color: t.text, fontWeight: '600', fontSize: 15, fontVariant: ['tabular-nums'] }}>{range} bpm</Text>
                </Row>
              );
            })}
            {!plan.athlete.hrZones ? (
              <P sub style={{ marginTop: 10, fontSize: 13 }}>
                Calculées par la FC de réserve. Saisis tes propres zones si tu en as.
              </P>
            ) : null}
          </Card>
        </>
      ) : null}

      <GroupTitle>Modèle</GroupTitle>
      <Card>
        <P sub style={{ fontSize: 14, lineHeight: 20 }}>
          Effort constant modulé par la pente (montée : 1 + {plan.model.upA}·g − {plan.model.upB}·g²), marche au-delà de{' '}
          {plan.model.walkGradePct} % à {plan.model.walkVamMh} m/h, descente ×{plan.model.descentSkill}, calibration ×
          {plan.model.calibrationF}, fatigue progressive, intensité par phase, {plan.model.startDelaySec} s de bouchon au
          départ. Allure plat équivalente demandée : {pace(f.requiredFlatPace)}/km.
        </P>
      </Card>
    </Screen>
  );
}
