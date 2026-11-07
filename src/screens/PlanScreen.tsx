// Vue d'ensemble du plan : faisabilité, profil, phases détaillées, nutrition, montées, zones.
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { chrono, clock, durHM, km as fkm, pace, plannedStartMs } from '../core/format';
import { hrZones } from '../core/plan';
import { sunEventsBetween } from '../core/sun';
import { useAppState } from '../state/store';
import { Bullets, Card, H, Label, P, Row, TileGrid } from '../ui/components';
import { ElevationProfile } from '../ui/ElevationProfile';
import { useTheme } from '../ui/theme';

export function PlanScreen() {
  const t = useTheme();
  const { plan, session } = useAppState();
  if (!plan) return null;
  const base = session?.startMs ?? plannedStartMs(plan.race.date, plan.race.startTime) ?? Date.now();
  const f = plan.feasibility;
  const verdictColor =
    f.verdict === 'confortable' || f.verdict === 'réaliste' ? t.good : f.verdict === 'ambitieux' ? t.warn : f.verdict === 'inconnu' ? t.sub : t.bad;
  const zones = hrZones(plan.athlete);
  const planned = plannedStartMs(plan.race.date, plan.race.startTime) ?? base;
  const first = plan.course.snap[0];
  const sun = first ? sunEventsBetween(base, base + plan.scenarios.slow.totalSec * 1000, first.lat, first.lon) : [];
  const FORMAT = { court: 'Format court', standard: 'Format standard', ultra: 'Format ultra' } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card>
        <Label>{plan.race.date} · départ {plan.race.startTime}</Label>
        <H style={{ fontSize: 22 }}>{plan.race.name}</H>
        <P>
          {fkm(plan.course.totalM / 1000)} km · +{Math.round(plan.course.gainM)} m / −{Math.round(plan.course.lossM)} m ·{' '}
          {FORMAT[plan.format ?? 'standard']}
        </P>
        {sun.length ? (
          <P sub>
            {sun.map((x) => `${x.kind === 'sunset' ? '🌙 Nuit' : '🌅 Jour'} à ${clock(x.at)}`).join(' · ')} : frontale
            obligatoire de nuit.
          </P>
        ) : null}
        <P>
          Objectif <Text style={{ fontWeight: '800' }}>{chrono(plan.scenarios.target.totalSec)}</Text> · fenêtre{' '}
          {chrono(plan.scenarios.fast.totalSec)} – {chrono(plan.scenarios.slow.totalSec)}
        </P>
        <View style={{ height: 8 }} />
        <ElevationProfile plan={plan} />
      </Card>

      <Card accent={verdictColor}>
        <Label style={{ color: verdictColor }}>Faisabilité · {f.verdict}</Label>
        <P>{f.message}</P>
      </Card>

      {plan.phases.map((p) => (
        <Card key={p.index} accent={t.phase[p.index % t.phase.length]}>
          <Label>
            Phase {p.index + 1} · km {fkm(p.fromKm)} → {fkm(p.toKm)} · {clock(base + p.tStart * 1000)} → {clock(base + p.tEnd * 1000)}
          </Label>
          <H>{p.name}</H>
          <P>{p.objective}</P>
          <TileGrid tiles={p.tiles} />
          <View style={{ height: 10 }} />
          <Label style={{ color: t.warn }}>À surveiller</Label>
          <Bullets items={p.watch} color={t.warn} />
          <View style={{ height: 6 }} />
          <Label>Consignes</Label>
          <Bullets items={p.tips} />
        </Card>
      ))}

      <Card>
        <H>Nutrition et ravitos</H>
        {plan.fuel.map((g) => (
          <Row key={g.id} style={{ marginBottom: 4 }}>
            <Text style={{ color: t.accent, width: 60, fontWeight: '800' }}>{clock(base + g.tSec * 1000)}</Text>
            <P style={{ flex: 1 }}>
              {g.label}
              {g.tSec > 0 ? ` · km ${fkm(g.km)} · ${durHM(g.tSec)}` : ''}
            </P>
          </Row>
        ))}
        {plan.aidStations.map((a, i) => (
          <Row key={i} style={{ marginBottom: 4 }}>
            <Text style={{ color: t.info, width: 60, fontWeight: '800' }}>km {fkm(a.km)}</Text>
            <P style={{ flex: 1 }}>
              {a.name} · arrêt {a.stopSec >= 120 ? durHM(a.stopSec) : `${a.stopSec} s`}
              {a.cutoffSec != null ? ` · barrière ${clock(planned + a.cutoffSec * 1000)}` : ''}
            </P>
          </Row>
        ))}
      </Card>

      {plan.climbs.length ? (
        <Card>
          <H>Montées notables</H>
          {plan.climbs.map((c, i) => (
            <P key={i}>
              km {fkm(c.fromKm)} → {fkm(c.toKm)} : +{Math.round(c.gainM)} m, {Math.round(c.avgGradePct)} % de moyenne, max{' '}
              {Math.round(c.maxGradePct)} %
            </P>
          ))}
        </Card>
      ) : null}

      {zones ? (
        <Card>
          <H>Zones de FC</H>
          {zones.map((z, i) => (
            <P key={i}>
              Z{i + 1} : {i === 0 ? `< ${z}` : `${zones[i - 1] + 1} – ${z}`}
            </P>
          ))}
          <P>Z6 : &gt; {zones[4]}</P>
          {!plan.athlete.hrZones ? <P sub>Calculées par la FC de réserve. Saisis tes propres zones si tu en as.</P> : null}
        </Card>
      ) : null}

      <Card>
        <H>Modèle</H>
        <P sub>
          Effort constant modulé par la pente (montée : 1 + {plan.model.upA}·g − {plan.model.upB}·g²), marche au-delà de{' '}
          {plan.model.walkGradePct} % à {plan.model.walkVamMh} m/h, descente ×{plan.model.descentSkill}, calibration ×
          {plan.model.calibrationF}, fatigue progressive, intensité par phase, {plan.model.startDelaySec} s de bouchon au
          départ. Allure plat équivalente demandée : {pace(f.requiredFlatPace)}/km.
        </P>
      </Card>
    </ScrollView>
  );
}
