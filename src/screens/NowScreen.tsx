// Écran « Course » : un seul écran qui change selon le moment (veille, matin, course, après).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { chrono, clock, countdown, dayLabel, deltaStr, durHM, km as fkm, plannedStartMs } from '../core/format';
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
import {
  Badge,
  Banner,
  Big,
  Btn,
  Bullets,
  Card,
  ConfirmBtn,
  Divider,
  GroupTitle,
  H,
  Label,
  P,
  Row,
  Screen,
  Stat,
  TileGrid,
} from '../ui/components';
import { ElevationProfile } from '../ui/ElevationProfile';
import { Icon, type IconName } from '../ui/Icon';
import { alpha, useTheme } from '../ui/theme';

export function NowScreen({ now, goTo }: { now: number; goTo: (tab: 'setup' | 'passages' | 'plan') => void }) {
  const { plan, session } = useAppState();
  const [preview, setPreview] = useState<number | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<Anchor | null>(null);

  if (!plan) return <NoPlan goTo={goTo} />;
  const planned = plannedStartMs(plan.race.date, plan.race.startTime) ?? now;
  const running = !!session && !session.finishedAt;
  const changePreview = (v: number | null) => {
    setPreview(v);
    if (v == null) setPreviewAnchor(null);
  };

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
    <Screen>
      {preview != null ? <PreviewBar value={preview} total={plan.scenarios.target.totalSec} onChange={changePreview} /> : null}
      {body}
      {!running && preview == null ? (
        <Btn kind="ghost" icon="eye" title="Aperçu : simuler la course" onPress={() => changePreview(0)} style={{ marginTop: 4 }} />
      ) : null}
    </Screen>
  );
}

function NoPlan({ goTo }: { goTo: (tab: 'setup') => void }) {
  const t = useTheme();
  const steps: { icon: IconName; title: string; text: string }[] = [
    { icon: 'route', title: 'Importe le GPX', text: "N'importe quelle course, du trail court à l'ultra." },
    { icon: 'flag', title: 'Fixe ton objectif', text: 'Allure par phase, passages, ravitos, barrières.' },
    { icon: 'play', title: 'Appuie sur DÉPART', text: 'Annonces à la voix, même écran verrouillé.' },
  ];
  return (
    <Screen>
      <View style={{ paddingTop: 24, paddingHorizontal: 4, marginBottom: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Icon name="mountain" size={28} color={t.accentText} stroke={2.4} />
        </View>
        <Text style={{ color: t.text, fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 38 }}>
          Ton plan de course,{'\n'}dans la poche{'\n'}et dans l'oreille.
        </Text>
      </View>
      <Card>
        {steps.map((s, i) => (
          <Row key={i} style={{ alignItems: 'flex-start', gap: 14, marginBottom: i < steps.length - 1 ? 16 : 0 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={18} color={t.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{s.title}</Text>
              <P sub style={{ fontSize: 14, lineHeight: 20 }}>{s.text}</P>
            </View>
          </Row>
        ))}
      </Card>
      <Btn kind="primary" icon="chevronRight" title="Préparer ma course" onPress={() => goTo('setup')} style={{ minHeight: 56 }} />
    </Screen>
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
      <View style={{ paddingHorizontal: 4, paddingTop: 8, marginBottom: 16 }}>
        <Label>
          {dayLabel(planned)} · départ {clock(planned)}
        </Label>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }} numberOfLines={2}>
          {plan.race.name}
        </Text>
        <Big size={56} color={t.dark ? t.accent : t.text}>
          {until > 0 ? countdown(until) : 'C’est l’heure'}
        </Big>
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat label="Objectif" value={durHM(plan.scenarios.target.totalSec)} size={22} />
          <Stat label="Fenêtre" value={`${durHM(plan.scenarios.fast.totalSec)}–${durHM(plan.scenarios.slow.totalSec)}`} size={16} align="center" />
          <Stat label="Arrivée" value={clock(finish)} size={22} align="right" />
        </Row>
      </Card>

      <ConfirmBtn big kind="primary" icon="play" title="DÉPART" confirmTitle="Appuie encore : GO !" onConfirm={() => startRace()} style={{ marginBottom: 8 }} />
      <Text style={{ color: t.faint, fontSize: 13, textAlign: 'center', marginBottom: 20, paddingHorizontal: 12 }}>
        Au coup de feu, double appui : toutes les alertes se calent sur ton départ réel.
      </Text>

      {morning && nextItem ? (
        <Banner tone="warn" icon="clock">
          <Label color={t.warn} style={{ marginBottom: 2 }}>
            Prochaine étape · {clock(planned - nextItem.minBefore * 60000)}
          </Label>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{nextItem.text}</Text>
        </Banner>
      ) : null}

      <GroupTitle>{morning ? 'Ce matin' : 'Le matin de la course'}</GroupTitle>
      <Card>
        {plan.morning.map((m, i) => {
          const at = planned - m.minBefore * 60000;
          const past = at < now;
          const last = i === plan.morning.length - 1;
          return (
            <Row key={i} style={{ alignItems: 'stretch', gap: 12, opacity: past ? 0.4 : 1 }}>
              <Text style={{ color: t.text, width: 48, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'], paddingTop: 1 }}>{clock(at)}</Text>
              <View style={{ alignItems: 'center', width: 12 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: last ? t.accentInk : t.card, borderWidth: 2, borderColor: last ? t.accentInk : t.faint }} />
                {!last ? <View style={{ flex: 1, width: 2, backgroundColor: t.line, marginTop: 2 }} /> : null}
              </View>
              <P style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>{m.text}</P>
            </Row>
          );
        })}
        <Divider />
        <Btn
          small
          icon="bell"
          title="Programmer ces rappels"
          onPress={async () => {
            const n = await scheduleMorningReminders(plan);
            setMsg(n ? `${n} rappels programmés.` : 'Aucun rappel à venir à programmer.');
          }}
        />
        {msg ? <P sub style={{ marginTop: 8, fontSize: 14, textAlign: 'center' }}>{msg}</P> : null}
      </Card>

      <GroupTitle>La veille</GroupTitle>
      <Card>
        <Bullets items={plan.checklist} color={t.accentInk} />
      </Card>

      <GroupTitle>Profil</GroupTitle>
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
  const phaseColor = t.phase[phase.index % t.phase.length];
  const phaseEndIn = tAtKm(plan, phase.toKm) + delta - elapsed;
  const nextLm = plan.landmarks.find((l) => l.km > kmNow + 0.05);
  const nextGel = plan.fuel.find((f) => f.tSec > elapsed);
  const status = anchor ? windowStatus(plan, anchor.km, anchor.t) : null;
  const deltaColor = !anchor ? t.sub : Math.abs(delta) < 15 ? t.good : delta > 0 ? t.bad : t.good;
  const ageS = anchor ? Math.round((now - anchor.at) / 1000) : null;
  const cut = nextCutoff(plan, kmNow, delta, startMs);
  const cutTone = !cut ? 'info' : cut.marginSec < 0 ? 'bad' : cut.marginSec < 30 * 60 ? 'warn' : 'good';
  const progress = Math.max(0, Math.min(1, kmNow / totalKm));

  return (
    <>
      {/* Tableau de bord */}
      <Card style={{ paddingTop: 18 }}>
        <Label style={{ textAlign: 'center' }}>Temps de course</Label>
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <Big size={64}>{chrono(elapsed)}</Big>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.card2, overflow: 'hidden', marginBottom: 14 }}>
          <View style={{ width: `${progress * 100}%`, height: 6, borderRadius: 3, backgroundColor: t.dark ? t.accent : t.accentInk }} />
        </View>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Stat label="Position" value={`${fkm(kmNow)} km`} sub={`reste ${fkm(Math.max(0, totalKm - kmNow))} km`} size={24} />
          {anchor ? (
            <>
              <Stat
                label="Écart"
                value={deltaStr(delta)}
                sub={delta > 5 ? 'de retard' : delta < -5 ? "d'avance" : 'dans le plan'}
                color={deltaColor}
                size={24}
                align="center"
              />
              <Stat label="Arrivée" value={chrono(proj)} sub={`vers ${clock(startMs + proj * 1000)}`} size={24} align="right" />
            </>
          ) : (
            <Stat
              label="Arrivée prévue"
              value={chrono(plan.scenarios.target.totalSec)}
              sub={`vers ${clock(startMs + plan.scenarios.target.totalSec * 1000)}`}
              size={24}
              align="right"
            />
          )}
        </Row>
        <Divider style={{ marginBottom: 10 }} />
        <Row style={{ gap: 6 }}>
          <Icon name={anchor?.source === 'gps' ? 'gps' : anchor ? 'recal' : 'clock'} size={14} color={t.faint} />
          <Text style={{ color: t.sub, fontSize: 13, flex: 1 }} numberOfLines={2}>
            {anchor
              ? `${anchor.source === 'gps' ? 'GPS' : anchor.source === 'landmark' ? 'Repère' : 'Recalage'} il y a ${
                  ageS! < 90 ? `${ageS} s` : `${Math.round(ageS! / 60)} min`
                }`
              : 'Position estimée au rythme du plan. Recale pour connaître ton écart.'}
          </Text>
          {status ? (
            <Badge
              text={status === 'in' ? 'Dans la fenêtre' : status === 'ahead' ? 'Trop vite' : 'Derrière'}
              color={status === 'in' ? t.good : status === 'ahead' ? t.warn : t.bad}
            />
          ) : null}
        </Row>
      </Card>

      {cut ? (
        <Banner tone={cutTone} icon="clock">
          <Label color={t[cutTone]} style={{ marginBottom: 2 }}>
            Barrière {cut.aid.name} · km {fkm(cut.aid.km)} · {clock(cut.cutoffMs)}
          </Label>
          <P style={{ fontSize: 15 }}>
            {cut.marginSec >= 0 ? (
              <>
                Marge <Text style={{ fontWeight: '800' }}>{durHM(cut.marginSec)}</Text> · arrivée prévue {clock(cut.arrivalMs)}
              </>
            ) : (
              <Text style={{ fontWeight: '800', color: t.bad }}>Dépassée de {durHM(-cut.marginSec)} au rythme actuel</Text>
            )}
            {anchor ? '' : ' · sans recalage'}
          </P>
        </Banner>
      ) : null}

      {/* Phase */}
      <Card accent={phaseColor}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Badge text={`Phase ${phase.index + 1}/${plan.phases.length}`} color={phaseColor} />
          <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600' }}>
            jusqu'au km {fkm(phase.toKm)}
            {phaseEndIn > 0 ? ` · ${durHM(phaseEndIn)}` : ''}
          </Text>
        </Row>
        <H style={{ fontSize: 24, marginTop: 10, marginBottom: 4 }}>{phase.name}</H>
        <P sub>{phase.objective}</P>
        <TileGrid tiles={phase.tiles} />
        {phase.watch.length ? (
          <View style={{ marginTop: 14 }}>
            <Row style={{ gap: 6, marginBottom: 8 }}>
              <Icon name="alert" size={14} color={t.warn} />
              <Label color={t.warn} style={{ marginBottom: 0 }}>
                À surveiller
              </Label>
            </Row>
            <Bullets items={phase.watch.slice(0, 4)} color={t.warn} />
          </View>
        ) : null}
      </Card>

      {/* À venir */}
      <Row style={{ alignItems: 'stretch', marginBottom: 12 }}>
        {nextLm ? (
          <NextCard
            icon="pin"
            label="Prochain repère"
            title={nextLm.name}
            big={clock(startMs + (nextLm.tTarget + delta) * 1000)}
            sub={`km ${fkm(nextLm.km)} · dans ${fkm(nextLm.km - kmNow)} km`}
            foot={`plan ${clock(startMs + nextLm.tFast * 1000)}–${clock(startMs + nextLm.tSlow * 1000)}`}
          />
        ) : null}
        {nextGel ? (
          <NextCard
            icon="food"
            label="Prochaine prise"
            title={nextGel.label}
            big={durHM(nextGel.tSec - elapsed)}
            sub={`à ${clock(startMs + nextGel.tSec * 1000)}`}
            color={t.warn}
          />
        ) : null}
      </Row>

      <Card>
        <ElevationProfile plan={plan} currentKm={kmNow} height={120} />
      </Card>

      <Recal plan={plan} kmNow={kmNow} onRecal={onRecal} session={session} preview={preview} />

      {!preview && session ? (
        <>
          <GroupTitle>Actions</GroupTitle>
          <Card>
            <Btn icon="volume" title="Annoncer la situation" onPress={() => announceNow()} style={{ marginBottom: 14 }} />
            <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Départ réel décalé ?</Text>
            <Row style={{ marginBottom: 14 }}>
              <Btn small title="Parti 30 s plus tôt" onPress={() => shiftStart(30)} style={{ flex: 1 }} />
              <Btn small title="Parti 30 s plus tard" onPress={() => shiftStart(-30)} style={{ flex: 1 }} />
            </Row>
            <ConfirmBtn icon="goal" title="Je suis arrivé" kind="primary" onConfirm={() => finishRace()} style={{ marginBottom: 8 }} />
            <ConfirmBtn icon="x" title="Annuler le départ" kind="ghost" onConfirm={() => cancelRace()} />
          </Card>
        </>
      ) : null}
    </>
  );
}

function NextCard({
  icon,
  label,
  title,
  big,
  sub,
  foot,
  color,
}: {
  icon: IconName;
  label: string;
  title: string;
  big: string;
  sub: string;
  foot?: string;
  color?: string;
}) {
  const t = useTheme();
  const c = color ?? t.info;
  return (
    <Card style={{ flex: 1, marginBottom: 0 }}>
      <Row style={{ gap: 6, marginBottom: 8 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: alpha(c, 0.15), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={14} color={c} />
        </View>
        <Label style={{ marginBottom: 0, flex: 1 }}>{label}</Label>
      </Row>
      <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
        {title}
      </Text>
      <Big size={26}>{big}</Big>
      <Text style={{ color: t.sub, fontSize: 13 }} numberOfLines={1}>
        {sub}
      </Text>
      {foot ? (
        <Text style={{ color: t.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {foot}
        </Text>
      ) : null}
    </Card>
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
    if (!g) return 'En attente de la première position…';
    const age = Math.round((Date.now() - g.at) / 1000);
    if (g.km == null) return `Position ignorée (${g.accuracy ? `précision ${Math.round(g.accuracy)} m` : 'hors trace'}), il y a ${age} s`;
    return `km ${fkm(g.km, 2)}, à ${Math.round(g.distM ?? 0)} m de la trace, il y a ${age} s`;
  })();
  const step = (title: string, d: number) => <Btn small title={title} onPress={() => bump(d)} style={{ flex: 1, paddingHorizontal: 4 }} />;
  return (
    <>
      <GroupTitle>Recaler ma position</GroupTitle>
      <Card>
        <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>Distance affichée par ta montre</Text>
        <View style={{ alignItems: 'center', marginVertical: 6 }}>
          <Big size={44}>{`${fkm(shown)} km`}</Big>
        </View>
        <Row style={{ marginBottom: 12, gap: 6 }}>
          {step('−1', -1)}
          {step('−0,1', -0.1)}
          {step('+0,1', 0.1)}
          {step('+1', 1)}
        </Row>
        <Btn
          kind="primary"
          icon="recal"
          title={`Recaler au km ${fkm(shown)}`}
          onPress={() => {
            onRecal(shown / wf);
            setWatchKm(null);
            setMsg(null);
          }}
        />
        {wf !== 1 ? (
          <P sub style={{ marginTop: 6, fontSize: 13, textAlign: 'center' }}>
            Facteur montre {wf} : km {fkm(shown)} montre = km {fkm(shown / wf, 2)} de trace.
          </P>
        ) : null}
        {!preview ? (
          <>
            <Divider />
            <Row>
              <Btn small icon="gps" title="Recaler par GPS" style={{ flex: 1 }} onPress={async () => setMsg(await recalibrateFromGps())} />
              <Btn
                small
                kind="ghost"
                title={session?.gpsOn ? 'Couper le suivi' : 'Activer le suivi'}
                style={{ flex: 1 }}
                onPress={async () => setMsg(await setGps(!session?.gpsOn))}
              />
            </Row>
            <Row style={{ gap: 6, marginTop: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: session?.gpsOn ? t.good : t.faint }} />
              <Text style={{ color: t.sub, fontSize: 13, flex: 1 }}>{gpsInfo}</Text>
            </Row>
            <Text style={{ color: t.faint, fontSize: 12, marginTop: 6 }}>Ou touche un repère dans l'onglet Passages.</Text>
          </>
        ) : null}
        {msg ? <P style={{ marginTop: 8, fontSize: 14 }}>{msg}</P> : null}
      </Card>
    </>
  );
}

function Finished({ plan, session }: { plan: Plan; session: RaceSession }) {
  const t = useTheme();
  const total = (session.finishedAt! - session.startMs) / 1000;
  const diff = total - plan.scenarios.target.totalSec;
  return (
    <>
      <View style={{ alignItems: 'center', paddingTop: 24, marginBottom: 20 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Icon name="goal" size={32} color={t.accentText} stroke={2.4} />
        </View>
        <Label>Course terminée · {plan.race.name}</Label>
        <Big size={64}>{chrono(total)}</Big>
        <Badge text={`${deltaStr(diff)} ${diff > 0 ? 'au-dessus' : 'en dessous'} de l'objectif ${chrono(plan.scenarios.target.totalSec)}`} color={diff > 0 ? t.warn : t.good} />
      </View>
      <GroupTitle>Récupération</GroupTitle>
      <Card>
        <Bullets items={plan.recovery} color={t.accentInk} />
      </Card>
      <ConfirmBtn kind="ghost" title="Nouvelle course" confirmTitle="Appuie encore pour effacer la session" onConfirm={() => cancelRace()} />
    </>
  );
}

function PreviewBar({ value, total, onChange }: { value: number; total: number; onChange: (v: number | null) => void }) {
  const t = useTheme();
  const set = (v: number) => onChange(Math.max(0, Math.min(total + 600, v)));
  return (
    <Card accent={t.info}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Row style={{ gap: 6 }}>
          <Icon name="eye" size={16} color={t.info} />
          <Label color={t.info} style={{ marginBottom: 0 }}>
            Aperçu · {chrono(value)}
          </Label>
        </Row>
        <Btn small kind="link" title="Quitter" onPress={() => onChange(null)} />
      </Row>
      <Row style={{ gap: 6 }}>
        {[
          ["−10'", -600],
          ["−1'", -60],
          ["+1'", 60],
          ["+10'", 600],
        ].map(([l, d]) => (
          <Btn key={l} small title={l as string} onPress={() => set(value + (d as number))} style={{ flex: 1, paddingHorizontal: 4 }} />
        ))}
      </Row>
      <Text style={{ color: t.sub, fontSize: 12, marginTop: 8 }}>Simulation : les recalages faits ici ne sont pas enregistrés.</Text>
    </Card>
  );
}
