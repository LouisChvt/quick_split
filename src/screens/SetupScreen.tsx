// Préparation : parcours (GPX), course, ravitos, coureur, nutrition, modèle ; réglages de l'app, partage et tests.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { demoGpx, demoUltraGpx } from '../core/demo';
import { durHM, km as fkm, plannedStartMs } from '../core/format';
import { buildCourse, parseGpx } from '../core/gpx';
import { buildPlan } from '../core/plan';
import { validatePlan } from '../core/validate';
import { exportPlan, pickTextFile } from '../services/files';
import { ensureNotificationPermission, testNotification } from '../services/notifications';
import { configureAudio, say } from '../services/speech';
import { aidStationsFromCourse, formToInput } from '../state/form';
import { setDraft, setPlan, setPrefs, useAppState } from '../state/store';
import type { AidRow, SetupForm } from '../state/types';
import {
  Banner,
  Btn,
  Card,
  Field,
  GroupTitle,
  H,
  Label,
  P,
  Row,
  Screen,
  Section,
  Seg,
  Stat,
  Toggle,
} from '../ui/components';
import { CourseProfile } from '../ui/ElevationProfile';
import { Icon } from '../ui/Icon';
import { alpha, useTheme } from '../ui/theme';

function isoDate(d: Date) {
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type SectionKey = 'race' | 'aid' | 'me' | 'fuel' | 'model';

export function SetupScreen({ onPlanReady }: { onPlanReady: () => void }) {
  const t = useTheme();
  const { draft, plan, session } = useAppState();
  const [form, setForm] = useState<SetupForm>(draft.form);
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<'course' | 'app'>('course');
  const [open, setOpen] = useState<SectionKey | null>(draft.course ? 'race' : null);
  const [busy, setBusy] = useState(false);
  const course = draft.course;
  const running = !!session && !session.finishedAt;

  // sauvegarde différée du formulaire
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h = setTimeout(() => setDraft({ form }), 600);
    return () => clearTimeout(h);
  }, [form]);

  const up = (k: keyof SetupForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: SectionKey) => () => setOpen((o) => (o === k ? null : k));

  async function loadGpxText(text: string, fileName?: string) {
    try {
      const c = buildCourse(parseGpx(text), undefined);
      await setDraft({ course: c });
      const aids = aidStationsFromCourse(c);
      setForm((f) => ({
        ...f,
        raceName: f.raceName || c.name || (fileName ?? '').replace(/\.gpx$/i, ''),
        aidStations: aids.length ? aids : f.aidStations,
      }));
      setErrors([]);
      setInfo(
        `${c.waypoints.length} waypoint(s) lu(s)` +
          (aids.length ? `, ${aids.length} ravito(s) détecté(s). Vérifie-les dans « Ravitos et barrières ».` : '.'),
      );
      setOpen('race');
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  }

  async function generate() {
    if (running) {
      setErrors(['Une course est en cours : termine-la ou annule-la avant de régénérer le plan.']);
      return;
    }
    const { input, errors: errs } = formToInput(course, form);
    setErrors(errs);
    if (!input) return;
    setBusy(true);
    try {
      await setDraft({ form });
      const p = buildPlan(input);
      await setPlan(p);
      setInfo(null);
      onPlanReady();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  const demo = (ultra: boolean) => async () => {
    await loadGpxText(ultra ? demoUltraGpx() : demoGpx());
    setForm((f) => ({
      ...f,
      raceName: ultra ? 'Ultra démo 72 km' : 'Trail démo 21 km',
      date: f.date || isoDate(new Date(Date.now() + 86400000)),
      startTime: ultra ? '06:00' : '09:00',
      target: ultra ? '15h30' : '2h15',
      ...(ultra ? { gelIntervalMin: '40', fuelLabel: 'Prise' } : {}),
    }));
  };

  const importGpx = async () => {
    try {
      const f = await pickTextFile();
      if (f) await loadGpxText(f.text, f.name);
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };

  // résumés des sections repliées
  const aidCount = form.aidStations.length;
  const cutCount = form.aidStations.filter((a) => a.cutoff?.trim()).length;
  const raceDone = !!(form.date && form.startTime && form.target);
  const meBits = [form.hrMax && `FC max ${form.hrMax}`, form.flatPace && `allure ${form.flatPace}/km`, form.wattsPerMps && 'puissance'].filter(Boolean);
  const dateErr = form.date && form.startTime && !plannedStartMs(form.date, form.startTime);

  const footer =
    mode === 'course' && course ? (
      <View>
        {errors.length ? (
          <Banner tone="bad" style={{ marginBottom: 10 }}>
            <View style={{ gap: 2 }}>
              {errors.map((e, i) => (
                <P key={i} style={{ fontSize: 14, lineHeight: 20 }}>
                  {e}
                </P>
              ))}
            </View>
          </Banner>
        ) : null}
        <Btn
          kind="primary"
          icon="zap"
          title={busy ? 'Calcul…' : plan ? 'Régénérer le plan' : 'Générer le plan'}
          onPress={generate}
          disabled={busy || !course}
          style={{ minHeight: 56, borderRadius: 16 }}
        />
      </View>
    ) : undefined;

  return (
    <Screen title="Préparer" subtitle={mode === 'course' ? 'Ta course, ton objectif, ton plan.' : 'Annonces, GPS, partage et tests.'} footer={footer}>
      <Seg
        options={[
          { label: 'Ma course', value: 'course' as const },
          { label: 'Réglages', value: 'app' as const },
        ]}
        value={mode}
        onChange={setMode}
        style={{ marginBottom: 16 }}
      />

      {mode === 'course' ? (
        <>
          {/* 1. Parcours */}
          {course ? (
            <Card>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Label>Parcours</Label>
                  <H style={{ marginBottom: 0 }} >{course.name || 'Trace importée'}</H>
                </View>
                <Btn small kind="ghost" icon="upload" title="Changer" onPress={importGpx} />
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                <Stat label="Distance" value={`${fkm(course.totalM / 1000)} km`} size={20} />
                <Stat label="D+" value={`${Math.round(course.gainM)} m`} size={20} />
                <Stat label="D−" value={`${Math.round(course.lossM)} m`} size={20} />
                <Stat label="Ravitos" value={String(aidCount)} size={20} align="right" />
              </Row>
              <CourseProfile course={course} aidKm={form.aidStations.map((a) => parseFloat(a.km.replace(',', '.'))).filter((k) => isFinite(k))} />
              {course.warnings.map((w, i) => (
                <Banner key={i} tone="warn" style={{ marginTop: 10, marginBottom: 0 }}>
                  {w}
                </Banner>
              ))}
            </Card>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: alpha(t.accent, t.dark ? 0.15 : 0.4), alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Icon name="route" size={30} color={t.dark ? t.accent : t.text} />
              </View>
              <H style={{ textAlign: 'center' }}>Importe le tracé de ta course</H>
              <P sub style={{ textAlign: 'center', marginBottom: 18, paddingHorizontal: 8 }}>
                Le fichier GPX de l'organisation, de Visorando, Strava, Garmin… Du trail court à l'ultra.
              </P>
              <Btn kind="primary" icon="upload" title="Importer un GPX" onPress={importGpx} style={{ alignSelf: 'stretch' }} />
              <Text style={{ color: t.faint, fontSize: 13, marginTop: 16, marginBottom: 8 }}>ou essaie l'app avec</Text>
              <Row style={{ alignSelf: 'stretch' }}>
                <Btn small title="Démo 21 km" onPress={demo(false)} style={{ flex: 1 }} />
                <Btn small title="Démo ultra 72 km" onPress={demo(true)} style={{ flex: 1 }} />
              </Row>
            </Card>
          )}
          {info ? <Banner tone="good">{info}</Banner> : null}

          {course ? (
            <>
              <Section
                icon="flag"
                title="Course et objectif"
                summary={raceDone ? `${form.date} · ${form.startTime} · objectif ${form.target}` : 'Date, heure de départ, objectif'}
                done={raceDone && !dateErr}
                open={open === 'race'}
                onToggle={toggle('race')}
              >
                <Field label="Nom de la course" value={form.raceName} onChangeText={up('raceName')} placeholder="Trail de …" />
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Date" value={form.date} onChangeText={up('date')} placeholder="aaaa-mm-jj" keyboardType="numbers-and-punctuation" style={{ flex: 1.3 }} />
                  <Field label="Départ" value={form.startTime} onChangeText={up('startTime')} placeholder="hh:mm" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
                </Row>
                {dateErr ? <Banner tone="bad">Format attendu : 2026-11-07 et 10:40.</Banner> : null}
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Objectif" value={form.target} onChangeText={up('target')} placeholder="3h20" hint="Ex. 3h20, 26h" style={{ flex: 1.3 }} />
                  <Field label="Fenêtre" value={form.windowPct} onChangeText={up('windowPct')} keyboardType="decimal-pad" unit="± %" style={{ flex: 1 }} />
                </Row>
              </Section>

              <Section
                icon="drop"
                title="Ravitos et barrières"
                summary={aidCount ? `${aidCount} ravito${aidCount > 1 ? 's' : ''}${cutCount ? ` · ${cutCount} barrière${cutCount > 1 ? 's' : ''}` : ''}` : 'Aucun ravito'}
                done={aidCount > 0}
                open={open === 'aid'}
                onToggle={toggle('aid')}
              >
                <P sub style={{ marginBottom: 12, fontSize: 14 }}>
                  Arrêt : 45 s pour un ravito rapide, 600 s pour une base de vie. Barrière horaire facultative.
                </P>
                {form.aidStations.map((a, i) => {
                  const set = (patch: Partial<AidRow>) =>
                    setForm((f) => ({ ...f, aidStations: f.aidStations.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                  return (
                    <View key={i} style={{ backgroundColor: alpha(t.info, t.dark ? 0.06 : 0.05), borderRadius: 16, padding: 12, paddingBottom: 0, marginBottom: 10 }}>
                      <Row style={{ alignItems: 'flex-start' }}>
                        <Field label={`Ravito ${i + 1}`} value={a.name} onChangeText={(v) => set({ name: v })} style={{ flex: 1 }} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer ${a.name}`}
                          onPress={() => setForm((f) => ({ ...f, aidStations: f.aidStations.filter((_, j) => j !== i) }))}
                          style={{ marginTop: 25, width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Icon name="x" size={20} color={t.faint} />
                        </Pressable>
                      </Row>
                      <Row style={{ alignItems: 'flex-start' }}>
                        <Field label="Position" value={a.km} keyboardType="decimal-pad" unit="km" onChangeText={(v) => set({ km: v })} style={{ flex: 1 }} />
                        <Field label="Arrêt" value={a.stopSec} keyboardType="number-pad" unit="s" onChangeText={(v) => set({ stopSec: v })} style={{ flex: 1 }} />
                        <Field label="Barrière" value={a.cutoff ?? ''} placeholder="hh:mm" keyboardType="numbers-and-punctuation" onChangeText={(v) => set({ cutoff: v })} style={{ flex: 1 }} />
                      </Row>
                    </View>
                  );
                })}
                <Row>
                  <Btn
                    small
                    icon="plus"
                    title="Ajouter"
                    style={{ flex: 1 }}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        aidStations: [...f.aidStations, { name: `Ravito ${f.aidStations.length + 1}`, km: '', stopSec: '45', cutoff: '' }],
                      }))
                    }
                  />
                  {course.waypoints.length ? (
                    <Btn small icon="recal" title="Relire le GPX" style={{ flex: 1 }} onPress={() => setForm((f) => ({ ...f, aidStations: aidStationsFromCourse(course) }))} />
                  ) : null}
                </Row>
              </Section>

              <Section
                icon="heart"
                title="Toi"
                summary={meBits.length ? meBits.join(' · ') : 'Optionnel : FC, allure, puissance'}
                done={meBits.length > 0}
                open={open === 'me'}
                onToggle={toggle('me')}
                color={t.bad}
              >
                <P sub style={{ marginBottom: 12, fontSize: 14 }}>Tout est optionnel. Plus tu en donnes, plus les cibles sont précises.</P>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="FC max" value={form.hrMax} onChangeText={up('hrMax')} keyboardType="number-pad" placeholder="190" unit="bpm" style={{ flex: 1 }} />
                  <Field label="FC repos" value={form.hrRest} onChangeText={up('hrRest')} keyboardType="number-pad" placeholder="55" unit="bpm" style={{ flex: 1 }} />
                </Row>
                <Field
                  label="Zones FC (bornes hautes Z1 à Z5)"
                  value={form.hrZones}
                  onChangeText={up('hrZones')}
                  placeholder="137, 158, 173, 179, 189"
                  keyboardType="numbers-and-punctuation"
                  hint="Vide : calculées depuis ta FC de réserve."
                />
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Allure plat soutenable" value={form.flatPace} onChangeText={up('flatPace')} placeholder="5'20" unit="/km" hint="Pour une course de cette durée." style={{ flex: 1 }} />
                  <Field label="Watts par m/s" value={form.wattsPerMps} onChangeText={up('wattsPerMps')} keyboardType="decimal-pad" placeholder="88,5" hint="Puissance plat ÷ vitesse." style={{ flex: 1 }} />
                </Row>
              </Section>

              <Section
                icon="food"
                title="Nutrition"
                summary={`${form.fuelLabel || 'Gel'} toutes les ${form.gelIntervalMin || '?'} min${form.drinkIntervalMin && form.drinkIntervalMin !== '0' ? ` · boire toutes les ${form.drinkIntervalMin} min` : ''}`}
                done
                open={open === 'fuel'}
                onToggle={toggle('fuel')}
                color={t.warn}
              >
                <Field label="Nom des prises" value={form.fuelLabel} onChangeText={up('fuelLabel')} placeholder="Gel" hint="Gel, Barre, Prise… Utilisé dans les annonces." />
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Une prise toutes les" value={form.gelIntervalMin} onChangeText={up('gelIntervalMin')} keyboardType="number-pad" unit="min" style={{ flex: 1 }} />
                  <Field label="Prise 0 avant départ" value={form.gel0MinBefore} onChangeText={up('gel0MinBefore')} keyboardType="number-pad" unit="min" style={{ flex: 1 }} />
                </Row>
                <Field label="Rappel « bois » toutes les" value={form.drinkIntervalMin} onChangeText={up('drinkIntervalMin')} keyboardType="number-pad" unit="min" hint="0 = pas de rappel." />
              </Section>

              <Section icon="gauge" title="Modèle avancé" summary="Pentes, marche, descente, calibration" open={open === 'model'} onToggle={toggle('model')} color={t.info}>
                <P sub style={{ marginBottom: 12, fontSize: 14 }}>Les valeurs par défaut conviennent pour commencer.</P>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Marche au-delà de" value={form.walkGradePct} onChangeText={up('walkGradePct')} keyboardType="decimal-pad" unit="%" style={{ flex: 1 }} />
                  <Field label="Vitesse en marche" value={form.walkVamMh} onChangeText={up('walkVamMh')} keyboardType="number-pad" unit="m/h" style={{ flex: 1 }} />
                </Row>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Aisance descente" value={form.descentSkill} onChangeText={up('descentSkill')} keyboardType="decimal-pad" hint="0,9 prudent · 1 · 1,1 bon" style={{ flex: 1 }} />
                  <Field label="Calibration" value={form.calibrationF} onChangeText={up('calibrationF')} keyboardType="decimal-pad" hint="Temps réel ÷ temps prédit" style={{ flex: 1 }} />
                </Row>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Field label="Bouchon au départ" value={form.startDelaySec} onChangeText={up('startDelaySec')} keyboardType="number-pad" unit="s" style={{ flex: 1 }} />
                  <Field label="Facteur montre" value={form.watchFactor} onChangeText={up('watchFactor')} keyboardType="decimal-pad" hint="km montre ÷ km trace" style={{ flex: 1 }} />
                </Row>
              </Section>
            </>
          ) : null}
        </>
      ) : (
        <AppSettings onPlanReady={onPlanReady} running={running} />
      )}
    </Screen>
  );
}

function AppSettings({ onPlanReady, running }: { onPlanReady: () => void; running: boolean }) {
  const t = useTheme();
  const { plan, prefs } = useAppState();
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  return (
    <>
      {msg ? <Banner tone={msg.tone}>{msg.text}</Banner> : null}

      <GroupTitle>Annonces vocales</GroupTitle>
      <Card style={{ paddingTop: 4 }}>
        <Toggle label="Annonces vocales" value={prefs.voice} onChange={(v) => setPrefs({ voice: v })} />
        <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 8 }}>Débit de la voix</Text>
        <Seg
          options={[
            { label: 'Lent', value: 0.85 },
            { label: 'Normal', value: 1 },
            { label: 'Rapide', value: 1.15 },
          ]}
          value={prefs.voiceRate}
          onChange={(v) => setPrefs({ voiceRate: v })}
        />
        <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Point de situation</Text>
        <Seg
          options={[
            { label: 'Jamais', value: 0 },
            { label: '10 min', value: 10 },
            { label: '15 min', value: 15 },
            { label: '20 min', value: 20 },
          ]}
          value={prefs.statusEveryMin}
          onChange={(v) => setPrefs({ statusEveryMin: v })}
          style={{ marginBottom: 0 }}
        />
      </Card>

      <GroupTitle>GPS et écran</GroupTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Toggle
          label="Suivi GPS au départ"
          value={prefs.gpsByDefault}
          onChange={(v) => setPrefs({ gpsByDefault: v })}
          hint="Indispensable pour la voix écran verrouillé et le recalage automatique."
        />
        <Toggle label="GPS économe" value={prefs.gpsPowerSave} onChange={(v) => setPrefs({ gpsPowerSave: v })} hint="Précision ≈ 50 m, moins de batterie." />
        <View style={{ marginBottom: -1 }}>
          <Toggle label="Écran toujours allumé en course" value={prefs.keepAwake} onChange={(v) => setPrefs({ keepAwake: v })} />
        </View>
      </Card>

      <GroupTitle>Apparence</GroupTitle>
      <Seg
        options={[
          { label: 'Auto', value: 'auto' as const },
          { label: 'Sombre', value: 'dark' as const },
          { label: 'Clair', value: 'light' as const },
        ]}
        value={prefs.theme}
        onChange={(v) => setPrefs({ theme: v })}
      />

      <GroupTitle>Tester avant le jour J</GroupTitle>
      <Card>
        <Row style={{ marginBottom: 12 }}>
          <Btn
            icon="volume"
            title="Voix"
            style={{ flex: 1 }}
            onPress={async () => {
              await configureAudio();
              say('Test. Phase 2 : installation. Fréquence cardiaque entre 147 et 167. 1 minute 20 de retard.', true);
            }}
          />
          <Btn
            icon="bell"
            title="Notif dans 10 s"
            style={{ flex: 1 }}
            onPress={async () => {
              const ok = await ensureNotificationPermission();
              if (!ok) setMsg({ tone: 'bad', text: 'Notifications refusées : active-les dans les réglages du téléphone.' });
              else {
                await testNotification(10);
                setMsg({ tone: 'good', text: 'Verrouille ton téléphone : la notification arrive dans 10 s.' });
              }
            }}
          />
        </Row>
        <P sub style={{ fontSize: 14 }}>
          Répétition générale : pendant un footing, appuie sur DÉPART, verrouille l'écran avec ta musique et vérifie que les
          annonces arrivent. Annule ensuite le départ.
        </P>
      </Card>

      <GroupTitle>Partager le plan</GroupTitle>
      <Card>
        <P sub style={{ marginBottom: 12, fontSize: 14 }}>
          Prépare sur un téléphone, cours avec un autre, ou envoie ton plan à un coach.
        </P>
        <Row>
          <Btn
            icon="download"
            title="Exporter"
            style={{ flex: 1 }}
            disabled={!plan}
            onPress={() => plan && exportPlan(plan).catch((e) => setMsg({ tone: 'bad', text: String(e) }))}
          />
          <Btn
            icon="upload"
            title="Importer"
            style={{ flex: 1 }}
            onPress={async () => {
              try {
                const f = await pickTextFile();
                if (!f) return;
                if (running) throw new Error('Une course est en cours.');
                const p = validatePlan(JSON.parse(f.text));
                await setPlan(p);
                setMsg({ tone: 'good', text: `Plan « ${p.race.name} » importé (objectif ${durHM(p.scenarios.target.totalSec)}).` });
                onPlanReady();
              } catch (e) {
                setMsg({ tone: 'bad', text: (e as Error).message });
              }
            }}
          />
        </Row>
      </Card>

      <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        TrailPacer · tout fonctionne hors réseau une fois le plan généré.
      </Text>
    </>
  );
}
