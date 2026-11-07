// Écran « Maintenant » : une seule carte qui change selon le moment (veille, matin, course, après).
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  chrono,
  clock,
  countdown,
  dayLabel,
  deltaStr,
  durHM,
  km as fkm,
  plannedStartMs,
} from '../core/format';
import { nextCutoff } from '../core/events';
import { deltaFromAnchor, estimateKm, projectedFinish, tAtKm, windowStatus } from '../core/position';
import type { Anchor, Plan } from '../core/types';
import {
  announceNow,
  cancelRace,
  finishRace,
  recalibrate,
  recalibrateFromGps,
  setGps,
  shiftStart,
  startRace,
} from '../services/controller';
import { scheduleMorningReminders } from '../services/notifications';
import { useAppState } from '../state/store';
import type { RaceSession } from '../state/types';
import { Big, Btn, Bullets, Card, ConfirmBtn, H, Label, P, Row, TileGrid } from '../ui/components';
import { ElevationProfile } from '../ui/ElevationProfile';
import { useTheme } from '../ui/theme';

export function NowScreen({ now, goTo }: { now: number; goTo: (tab: 'setup' | 'passages' | 'plan') => void }) {
  const { plan, session } = useAppState();
  const [preview, setPreview] = useState<number | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<Anchor | null>(null);

  if (!plan) return <NoPlan goTo={goTo} />;
  const planned = plannedStartMs(plan.race.date, plan.race.startTime) ?? now;
  const running = !!session && !session.finishedAt;

  let body: React.ReactNode;
  if (preview != null) {
    body = (
      <RaceView
        plan={plan}
        now={planned + preview * 1000}
        startMs={planned}
        anchor={previewAnchor}
        preview
        onRecal={(kmv) => setPreviewAnchor({ t: preview, km: kmv, source: 'manual', at: planned + preview * 1000 })}
      />
    );
  } else if (running) {
    body = (
      <RaceView
        plan={plan}
        now={now}
        startMs={session!.startMs}
        anchor={session!.anchor}
        session={session!}
        onRecal={(kmv) => recalibrate(kmv, 'manual')}
      />
    );
  } else if (session?.finishedAt) {
    body = <Finished plan={plan} session={session} />;
  } else {
    body = <PreRace plan={plan} now={now} planned={planned} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {body}
      {!running && (
        <PreviewBar
          value={preview}
          total={plan.scenarios.target.totalSec}
          onChange={(v) => {
            setPreview(v);
            if (v == null) setPreviewAnchor(null);
          }}
        />
      )}
    </ScrollView>
  );
}

function NoPlan({ goTo }: { goTo: (tab: 'setup') => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card>
        <H>Bienvenue 👋</H>
        <P>
          TrailPacer transforme le GPX de n'importe quelle course (trail court, marathon nature, ultra de plusieurs jours) et ton
          objectif en plan de course : allure par phase, repères et barrières horaires, nutrition, nuit, et des annonces
          vocales pendant la course, même écran verrouillé.
        </P>
        <View style={{ height: 12 }} />
        <Btn kind="primary" title="Préparer ma course" onPress={() => goTo('setup')} />
      </Card>
    </ScrollView>
  );
}

function PreRace({ plan, now, planned }: { plan: Plan; now: number; planned: number }) {
  const t = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const until = planned - now;
  const finish = planned + plan.scenarios.target.totalSec * 1000;
  const morning = until <= 6 * 3600 * 1000;
  const nextItem = plan.morning.find((m) => planned - m.minBefore * 60000 > now);
  return (
    <>
      <Card>
        <Label>{dayLabel(planned)} · départ {clock(planned)}</Label>
        <H style={{ fontSize: 24 }}>{plan.race.name}</H>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Big size={40}>{until > 0 ? countdown(until) : 'C’est l’heure'}</Big>
        </Row>
        <P sub>
          Objectif {durHM(plan.scenarios.target.totalSec)} (fenêtre {durHM(plan.scenarios.fast.totalSec)}–
          {durHM(plan.scenarios.slow.totalSec)}) · arrivée vers {clock(finish)}
        </P>
      </Card>

      <ConfirmBtn
        big
        kind="primary"
        title="DÉPART"
        confirmTitle="Appuie encore : GO !"
        onConfirm={() => startRace()}
        style={{ marginBottom: 6 }}
      />
      <P sub style={{ marginBottom: 12, textAlign: 'center' }}>
        Appuie au coup de feu : toutes les alertes se calent sur ce départ réel. Oubli ? Tu pourras corriger de ±30 s.
      </P>

      {morning && nextItem ? (
        <Card accent={t.warn}>
          <Label>Prochaine étape · {clock(planned - nextItem.minBefore * 60000)}</Label>
          <H>{nextItem.text}</H>
        </Card>
      ) : null}

      <Card>
        <H>{morning ? 'Ce matin' : 'Le matin de la course'}</H>
        {plan.morning.map((m, i) => {
          const at = planned - m.minBefore * 60000;
          const past = at < now;
          return (
            <Row key={i} style={{ marginBottom: 6, opacity: past ? 0.45 : 1, alignItems: 'flex-start' }}>
              <Text style={{ color: t.accent, width: 56, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{clock(at)}</Text>
              <P style={{ flex: 1 }}>{m.text}</P>
            </Row>
          );
        })}
        <View style={{ height: 8 }} />
        <Btn
          title="Programmer ces rappels en notifications"
          onPress={async () => {
            const n = await scheduleMorningReminders(plan);
            setMsg(n ? `${n} rappels programmés.` : 'Aucun rappel à venir à programmer.');
          }}
        />
        {msg ? <P sub style={{ marginTop: 6 }}>{msg}</P> : null}
      </Card>

      <Card>
        <H>La veille</H>
        <Bullets items={plan.checklist} />
      </Card>
      <Card>
        <ElevationProfile plan={plan} />
      </Card>
    </>
  );
}

function RaceView({
  plan,
  now,
  startMs,
  anchor,
  session,
  preview,
  onRecal,
}: {
  plan: Plan;
  now: number;
  startMs: number;
  anchor: Anchor | null;
  session?: RaceSession;
  preview?: boolean;
  onRecal: (km: number) => void;
}) {
  const t = useTheme();
  const elapsed = (now - startMs) / 1000;
  const totalKm = plan.course.totalM / 1000;
  const kmNow = estimateKm(plan, elapsed, anchor);
  const delta = deltaFromAnchor(plan, anchor);
  const proj = projectedFinish(plan, delta);
  const phaseIdx = plan.phases.findIndex((p) => kmNow < p.toKm - 1e-6);
  const phase = plan.phases[phaseIdx === -1 ? plan.phases.length - 1 : phaseIdx];
  const phaseEndIn = tAtKm(plan, phase.toKm) + delta - elapsed;
  const nextLm = plan.landmarks.find((l) => l.km > kmNow + 0.05);
  const nextGel = plan.fuel.find((f) => f.tSec > elapsed);
  const status = anchor ? windowStatus(plan, anchor.km, anchor.t) : null;
  const deltaColor = !anchor ? t.sub : Math.abs(delta) < 15 ? t.good : delta > 0 ? t.bad : t.good;
  const ageS = anchor ? Math.round((now - anchor.at) / 1000) : null;
  const cut = nextCutoff(plan, kmNow, delta, startMs);
  const cutColor = !cut ? t.sub : cut.marginSec < 0 ? t.bad : cut.marginSec < 30 * 60 ? t.warn : t.good;

  return (
    <>
      {preview ? (
        <Card accent={t.info}>
          <P>Aperçu : simulation à {chrono(elapsed)} de course. Les recalages faits ici ne sont pas enregistrés.</P>
        </Card>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Label>Temps de course</Label>
            <Big size={46}>{chrono(elapsed)}</Big>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Label>Position</Label>
            <Big size={38}>km {fkm(kmNow)}</Big>
          </View>
        </Row>
        <P sub>
          {anchor
            ? `${anchor.source === 'gps' ? 'GPS' : anchor.source === 'landmark' ? 'Repère' : 'Recalage'} il y a ${
                ageS! < 90 ? `${ageS} s` : `${Math.round(ageS! / 60)} min`
              }, puis rythme du plan`
            : 'Estimée au rythme du plan (pas encore recalée)'}
          {` · reste ${fkm(Math.max(0, totalKm - kmNow))} km`}
        </P>
      </Card>

      <Card accent={deltaColor}>
        {anchor ? (
          <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Label>Écart / objectif</Label>
                <Big color={deltaColor} size={44}>
                  {deltaStr(delta)}
                </Big>
                <P sub>{delta > 5 ? 'de retard' : delta < -5 ? "d'avance" : 'dans le plan'}</P>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label>Arrivée projetée</Label>
                <Big size={32}>{chrono(proj)}</Big>
                <P sub>vers {clock(startMs + proj * 1000)}</P>
              </View>
            </Row>
            <P sub style={{ marginTop: 4 }}>
              {status === 'in'
                ? `Dans la fenêtre ${durHM(plan.scenarios.fast.totalSec)}–${durHM(plan.scenarios.slow.totalSec)}`
                : status === 'ahead'
                  ? 'Plus vite que la fenêtre : attention à ne pas te griller'
                  : 'Derrière la fenêtre : reste lucide, ne force pas tout de suite'}
            </P>
          </>
        ) : (
          <>
            <Label>Arrivée prévue</Label>
            <Big size={32}>{chrono(plan.scenarios.target.totalSec)}</Big>
            <P sub>Recale (km montre, repère ou GPS) pour connaître ton avance ou ton retard.</P>
          </>
        )}
      </Card>

      {cut ? (
        <Card accent={cutColor}>
          <Label style={{ color: cutColor }}>
            Barrière {cut.aid.name} · km {fkm(cut.aid.km)} · {clock(cut.cutoffMs)}
          </Label>
          <P>
            {cut.marginSec >= 0 ? (
              <>
                Marge <Text style={{ fontWeight: '800' }}>{durHM(cut.marginSec)}</Text> (arrivée prévue {clock(cut.arrivalMs)})
              </>
            ) : (
              <>
                <Text style={{ fontWeight: '800', color: t.bad }}>Dépassée de {durHM(-cut.marginSec)}</Text> au rythme actuel
              </>
            )}
            {anchor ? '' : ' · estimation sans recalage'}
          </P>
        </Card>
      ) : null}

      <Card accent={t.phase[phase.index % t.phase.length]}>
        <Label>
          Phase {phase.index + 1}/{plan.phases.length} · jusqu'au km {fkm(phase.toKm)}
          {phaseEndIn > 0 ? ` · dans ${durHM(phaseEndIn)}` : ''}
        </Label>
        <H style={{ fontSize: 22 }}>{phase.name}</H>
        <P>{phase.objective}</P>
        <TileGrid tiles={phase.tiles} />
      </Card>

      <Card accent={t.warn}>
        <Label style={{ color: t.warn }}>À surveiller</Label>
        <Bullets items={phase.watch.slice(0, 4)} color={t.warn} />
      </Card>

      <Row style={{ alignItems: 'stretch' }}>
        {nextLm ? (
          <Card style={{ flex: 1 }}>
            <Label>Prochain repère</Label>
            <P style={{ fontWeight: '800', fontSize: 17 }}>{nextLm.name}</P>
            <P sub>
              km {fkm(nextLm.km)} · dans {fkm(nextLm.km - kmNow)} km
            </P>
            <P>
              à ton rythme : <Text style={{ fontWeight: '800' }}>{clock(startMs + (nextLm.tTarget + delta) * 1000)}</Text>
            </P>
            <P sub>
              plan {clock(startMs + nextLm.tTarget * 1000)} ({clock(startMs + nextLm.tFast * 1000)}–
              {clock(startMs + nextLm.tSlow * 1000)})
            </P>
          </Card>
        ) : null}
        {nextGel ? (
          <Card style={{ flex: 1 }}>
            <Label>Prochaine prise</Label>
            <P style={{ fontWeight: '800', fontSize: 17 }}>{nextGel.label}</P>
            <P>
              dans <Text style={{ fontWeight: '800' }}>{durHM(nextGel.tSec - elapsed)}</Text>
            </P>
            <P sub>à {clock(startMs + nextGel.tSec * 1000)}</P>
          </Card>
        ) : null}
      </Row>

      <Recal plan={plan} kmNow={kmNow} onRecal={onRecal} session={session} preview={preview} />

      <Card>
        <ElevationProfile plan={plan} currentKm={kmNow} height={120} />
      </Card>

      {!preview && session ? (
        <Card>
          <H>Actions</H>
          <Btn title="🔊 Annoncer la situation" onPress={() => announceNow()} style={{ marginBottom: 8 }} />
          <Label>Départ réel décalé ?</Label>
          <Row style={{ marginBottom: 8 }}>
            <Btn title="Parti 30 s plus tôt" onPress={() => shiftStart(30)} style={{ flex: 1 }} />
            <Btn title="Parti 30 s plus tard" onPress={() => shiftStart(-30)} style={{ flex: 1 }} />
          </Row>
          <ConfirmBtn title="🏁 Je suis arrivé" kind="primary" onConfirm={() => finishRace()} style={{ marginBottom: 8 }} />
          <ConfirmBtn title="Annuler le départ" kind="ghost" onConfirm={() => cancelRace()} />
        </Card>
      ) : null}
    </>
  );
}

function Recal({
  plan,
  kmNow,
  onRecal,
  session,
  preview,
}: {
  plan: Plan;
  kmNow: number;
  onRecal: (km: number) => void;
  session?: RaceSession;
  preview?: boolean;
}) {
  const t = useTheme();
  const wf = plan.race.watchFactor || 1;
  const [watchKm, setWatchKm] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const shown = watchKm ?? Math.round(kmNow * wf * 10) / 10;
  const bump = (d: number) => setWatchKm(Math.max(0, Math.round((shown + d) * 10) / 10));
  const gpsInfo = (() => {
    const g = session?.lastGps;
    if (!session?.gpsOn) return 'Suivi GPS coupé';
    if (!g) return 'GPS : en attente de la première position…';
    const age = Math.round((Date.now() - g.at) / 1000);
    if (g.km == null) return `GPS : position ignorée (${g.accuracy ? `précision ${Math.round(g.accuracy)} m` : 'hors trace'}), il y a ${age} s`;
    return `GPS : km ${fkm(g.km, 2)}, à ${Math.round(g.distM ?? 0)} m de la trace, il y a ${age} s`;
  })();
  return (
    <Card>
      <H>Recaler ma position</H>
      <Label>Distance affichée par ta montre</Label>
      <Row style={{ marginBottom: 8 }}>
        <Btn title="−1" onPress={() => bump(-1)} style={{ flex: 1 }} />
        <Btn title="−0,1" onPress={() => bump(-0.1)} style={{ flex: 1 }} />
        <View style={{ flex: 1.6, alignItems: 'center' }}>
          <Big size={30}>{fkm(shown)}</Big>
        </View>
        <Btn title="+0,1" onPress={() => bump(0.1)} style={{ flex: 1 }} />
        <Btn title="+1" onPress={() => bump(1)} style={{ flex: 1 }} />
      </Row>
      <Btn
        kind="primary"
        title={`Recaler au km ${fkm(shown)} montre`}
        onPress={() => {
          onRecal(shown / wf);
          setWatchKm(null);
          setMsg(null);
        }}
      />
      {wf !== 1 ? <P sub style={{ marginTop: 4 }}>Facteur montre {wf} : km {fkm(shown)} montre = km {fkm(shown / wf, 2)} de trace.</P> : null}
      {!preview ? (
        <>
          <View style={{ height: 10 }} />
          <Row>
            <Btn
              title="📍 Recaler par GPS"
              style={{ flex: 1 }}
              onPress={async () => setMsg(await recalibrateFromGps())}
            />
            <Btn
              title={session?.gpsOn ? 'Couper le suivi GPS' : 'Activer le suivi GPS'}
              style={{ flex: 1 }}
              onPress={async () => setMsg(await setGps(!session?.gpsOn))}
            />
          </Row>
          <P sub style={{ marginTop: 6, color: session?.gpsOn ? t.good : t.sub }}>
            {gpsInfo}
          </P>
          <P sub>Ou touche un repère dans l'onglet Passages.</P>
        </>
      ) : null}
      {msg ? <P style={{ marginTop: 6 }}>{msg}</P> : null}
    </Card>
  );
}

function Finished({ plan, session }: { plan: Plan; session: RaceSession }) {
  const t = useTheme();
  const total = (session.finishedAt! - session.startMs) / 1000;
  const diff = total - plan.scenarios.target.totalSec;
  return (
    <>
      <Card accent={t.good}>
        <Label>Course terminée · {plan.race.name}</Label>
        <Big size={52}>{chrono(total)}</Big>
        <P sub>
          Objectif {chrono(plan.scenarios.target.totalSec)} · {deltaStr(diff)} {diff > 0 ? 'au-dessus' : 'en dessous'}
        </P>
      </Card>
      <Card>
        <H>Récupération</H>
        <Bullets items={plan.recovery} />
      </Card>
      <ConfirmBtn
        title="Nouvelle course (effacer cette session)"
        onConfirm={() => cancelRace()}
      />
    </>
  );
}

function PreviewBar({ value, total, onChange }: { value: number | null; total: number; onChange: (v: number | null) => void }) {
  const t = useTheme();
  if (value == null) {
    return <Btn kind="ghost" title="👁 Aperçu : simuler un moment de la course" onPress={() => onChange(0)} style={{ marginTop: 8 }} />;
  }
  const set = (v: number) => onChange(Math.max(0, Math.min(total + 600, v)));
  return (
    <Card style={{ marginTop: 8 }} accent={t.info}>
      <Label>Aperçu · {chrono(value)}</Label>
      <Row style={{ marginBottom: 8 }}>
        <Btn title="−10'" onPress={() => set(value - 600)} style={{ flex: 1 }} />
        <Btn title="−1'" onPress={() => set(value - 60)} style={{ flex: 1 }} />
        <Btn title="+1'" onPress={() => set(value + 60)} style={{ flex: 1 }} />
        <Btn title="+10'" onPress={() => set(value + 600)} style={{ flex: 1 }} />
      </Row>
      <Btn title="Quitter l'aperçu" onPress={() => onChange(null)} />
    </Card>
  );
}
