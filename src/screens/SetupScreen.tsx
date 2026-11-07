// Préparation : parcours (GPX), course, ravitos, coureur, nutrition, modèle, partage, réglages de l'app.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { demoGpx } from '../core/demo';
import { durHM, km as fkm, plannedStartMs } from '../core/format';
import { buildCourse, parseGpx } from '../core/gpx';
import { buildPlan } from '../core/plan';
import { validatePlan } from '../core/validate';
import { exportPlan, pickTextFile } from '../services/files';
import { testNotification, ensureNotificationPermission } from '../services/notifications';
import { configureAudio, say } from '../services/speech';
import { aidStationsFromCourse, formToInput } from '../state/form';
import { setDraft, setPlan, setPrefs, useAppState } from '../state/store';
import type { SetupForm } from '../state/types';
import { Btn, Card, Field, H, Label, P, Row, Seg, Toggle } from '../ui/components';
import { useTheme } from '../ui/theme';

function isoDate(d: Date) {
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function SetupScreen({ onPlanReady }: { onPlanReady: () => void }) {
  const t = useTheme();
  const { draft, plan, session, prefs } = useAppState();
  const [form, setForm] = useState<SetupForm>(draft.form);
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
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
        `Trace chargée : ${fkm(c.totalM / 1000)} km, +${Math.round(c.gainM)} m (lissé), ${c.waypoints.length} waypoint(s)` +
          (aids.length ? `, ${aids.length} ravito(s) détecté(s).` : '.') +
          (c.hasElevation ? '' : ' ⚠️ Pas d’altitude dans ce GPX : le profil sera plat.'),
      );
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
      setInfo(`Plan généré. ${p.feasibility.message}`);
      onPlanReady();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Card>
        <H>1. Parcours</H>
        {course ? (
          <P>
            {course.name} · {fkm(course.totalM / 1000)} km · +{Math.round(course.gainM)} m lissé (brut +
            {Math.round(course.rawGainM)} m)
          </P>
        ) : (
          <P sub>Importe le GPX officiel de ta course (fichier .gpx depuis Fichiers, mail, Drive…).</P>
        )}
        <Row style={{ marginTop: 8 }}>
          <Btn
            kind="primary"
            title="Importer un GPX"
            style={{ flex: 1 }}
            onPress={async () => {
              try {
                const f = await pickTextFile();
                if (f) await loadGpxText(f.text, f.name);
              } catch (e) {
                setErrors([(e as Error).message]);
              }
            }}
          />
          <Btn
            title="Parcours démo"
            style={{ flex: 1 }}
            onPress={async () => {
              await loadGpxText(demoGpx());
              setForm((f) => ({
                ...f,
                raceName: f.raceName || 'Trail démo 21 km',
                date: f.date || isoDate(new Date(Date.now() + 86400000)),
                target: f.target || '2h15',
              }));
            }}
          />
        </Row>
      </Card>

      <Card>
        <H>2. Course et objectif</H>
        <Field label="Nom" value={form.raceName} onChangeText={up('raceName')} placeholder="Trail de …" />
        <Row>
          <Field
            label="Date"
            value={form.date}
            onChangeText={up('date')}
            placeholder="2026-11-07"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1 }}
          />
          <Field
            label="Départ"
            value={form.startTime}
            onChangeText={up('startTime')}
            placeholder="10:40"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1 }}
          />
        </Row>
        <Row>
          <Field label="Objectif" value={form.target} onChangeText={up('target')} placeholder="3h20" style={{ flex: 1 }} />
          <Field
            label="Fenêtre ± %"
            value={form.windowPct}
            onChangeText={up('windowPct')}
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
          />
        </Row>
        {form.date && form.startTime && !plannedStartMs(form.date, form.startTime) ? (
          <P style={{ color: t.bad }}>Format attendu : 2026-11-07 et 10:40.</P>
        ) : null}
      </Card>

      <Card>
        <H>3. Ravitos</H>
        {form.aidStations.map((a, i) => (
          <Row key={i} style={{ alignItems: 'flex-end' }}>
            <Field
              label="Nom"
              value={a.name}
              onChangeText={(v) => setForm((f) => ({ ...f, aidStations: f.aidStations.map((x, j) => (j === i ? { ...x, name: v } : x)) }))}
              style={{ flex: 2 }}
            />
            <Field
              label="km"
              value={a.km}
              keyboardType="decimal-pad"
              onChangeText={(v) =>
                setForm((f) => ({ ...f, aidStations: f.aidStations.map((x, j) => (j === i ? { ...x, km: v } : x)) }))
              }
              style={{ flex: 1 }}
            />
            <Field
              label="Arrêt s"
              value={a.stopSec}
              keyboardType="number-pad"
              onChangeText={(v) =>
                setForm((f) => ({ ...f, aidStations: f.aidStations.map((x, j) => (j === i ? { ...x, stopSec: v } : x)) }))
              }
              style={{ flex: 1 }}
            />
            <Btn
              title="✕"
              kind="ghost"
              style={{ marginBottom: 10 }}
              onPress={() => setForm((f) => ({ ...f, aidStations: f.aidStations.filter((_, j) => j !== i) }))}
            />
          </Row>
        ))}
        <Row>
          <Btn
            title="+ Ajouter un ravito"
            style={{ flex: 1 }}
            onPress={() =>
              setForm((f) => ({ ...f, aidStations: [...f.aidStations, { name: `Ravito ${f.aidStations.length + 1}`, km: '', stopSec: '45' }] }))
            }
          />
          {course?.waypoints.length ? (
            <Btn
              title="Depuis le GPX"
              style={{ flex: 1 }}
              onPress={() => setForm((f) => ({ ...f, aidStations: aidStationsFromCourse(course) }))}
            />
          ) : null}
        </Row>
      </Card>

      <Card>
        <H>4. Toi</H>
        <P sub style={{ marginBottom: 8 }}>Tout est optionnel : plus tu en donnes, plus les cibles sont précises.</P>
        <Row>
          <Field label="FC max" value={form.hrMax} onChangeText={up('hrMax')} keyboardType="number-pad" placeholder="190" style={{ flex: 1 }} />
          <Field label="FC repos" value={form.hrRest} onChangeText={up('hrRest')} keyboardType="number-pad" placeholder="55" style={{ flex: 1 }} />
        </Row>
        <Field
          label="Zones FC (bornes hautes Z1 à Z5)"
          value={form.hrZones}
          onChangeText={up('hrZones')}
          placeholder="137, 158, 173, 179, 189"
          keyboardType="numbers-and-punctuation"
          hint="Laisse vide pour les calculer depuis ta FC de réserve."
        />
        <Row>
          <Field
            label="Allure plat soutenable"
            value={form.flatPace}
            onChangeText={up('flatPace')}
            placeholder="5'20"
            hint="Pour une course de cette durée. Sert à l'avis de faisabilité."
            style={{ flex: 1 }}
          />
          <Field
            label="Watts par m/s"
            value={form.wattsPerMps}
            onChangeText={up('wattsPerMps')}
            keyboardType="decimal-pad"
            placeholder="88,5"
            hint="Puissance plat ÷ vitesse (m/s), si tu cours avec la puissance."
            style={{ flex: 1 }}
          />
        </Row>
      </Card>

      <Card>
        <H>5. Nutrition</H>
        <Row>
          <Field label="Gel toutes les (min)" value={form.gelIntervalMin} onChangeText={up('gelIntervalMin')} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Gel 0 avant départ (min)" value={form.gel0MinBefore} onChangeText={up('gel0MinBefore')} keyboardType="number-pad" style={{ flex: 1 }} />
        </Row>
        <Field
          label="Rappel « bois » toutes les (min)"
          value={form.drinkIntervalMin}
          onChangeText={up('drinkIntervalMin')}
          keyboardType="number-pad"
          hint="0 = pas de rappel."
        />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H>6. Modèle (avancé)</H>
          <Btn title={advanced ? 'Masquer' : 'Afficher'} kind="ghost" onPress={() => setAdvanced(!advanced)} />
        </Row>
        {advanced ? (
          <>
            <Row>
              <Field label="Marche au-delà de (%)" value={form.walkGradePct} onChangeText={up('walkGradePct')} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Field label="Vitesse marche (m/h D+)" value={form.walkVamMh} onChangeText={up('walkVamMh')} keyboardType="number-pad" style={{ flex: 1 }} />
            </Row>
            <Row>
              <Field
                label="Aisance descente"
                value={form.descentSkill}
                onChangeText={up('descentSkill')}
                keyboardType="decimal-pad"
                hint="0,9 prudent · 1 moyen · 1,1 bon"
                style={{ flex: 1 }}
              />
              <Field
                label="Calibration"
                value={form.calibrationF}
                onChangeText={up('calibrationF')}
                keyboardType="decimal-pad"
                hint="Temps réel ÷ temps prédit sur une course passée"
                style={{ flex: 1 }}
              />
            </Row>
            <Row>
              <Field label="Bouchon départ (s)" value={form.startDelaySec} onChangeText={up('startDelaySec')} keyboardType="number-pad" style={{ flex: 1 }} />
              <Field
                label="Facteur montre"
                value={form.watchFactor}
                onChangeText={up('watchFactor')}
                keyboardType="decimal-pad"
                hint="km montre ÷ km trace (ex. 0,98)"
                style={{ flex: 1 }}
              />
            </Row>
          </>
        ) : (
          <P sub>Pentes, marche, descente, calibration, facteur montre. Les valeurs par défaut conviennent pour commencer.</P>
        )}
      </Card>

      {errors.length ? (
        <Card accent={t.bad}>
          {errors.map((e, i) => (
            <P key={i} style={{ color: t.bad }}>
              {e}
            </P>
          ))}
        </Card>
      ) : null}
      {info ? (
        <Card accent={t.good}>
          <P>{info}</P>
        </Card>
      ) : null}

      <Btn big kind="primary" title={busy ? 'Calcul…' : plan ? 'Régénérer le plan' : 'Générer le plan'} onPress={generate} disabled={busy} />
      <View style={{ height: 16 }} />

      <Card>
        <H>Partager / importer un plan</H>
        <P sub style={{ marginBottom: 8 }}>
          Le plan (JSON) contient tout ce qu'il faut pour courir : tu peux le préparer sur un téléphone et l'ouvrir sur un autre,
          ou l'envoyer à un coach.
        </P>
        <Row>
          <Btn title="Exporter" style={{ flex: 1 }} disabled={!plan} onPress={() => plan && exportPlan(plan).catch((e) => setErrors([String(e)]))} />
          <Btn
            title="Importer"
            style={{ flex: 1 }}
            onPress={async () => {
              try {
                const f = await pickTextFile();
                if (!f) return;
                if (running) throw new Error('Une course est en cours.');
                const p = validatePlan(JSON.parse(f.text));
                await setPlan(p);
                setInfo(`Plan « ${p.race.name} » importé (objectif ${durHM(p.scenarios.target.totalSec)}).`);
                onPlanReady();
              } catch (e) {
                setErrors([(e as Error).message]);
              }
            }}
          />
        </Row>
      </Card>

      <Card>
        <H>Pendant la course</H>
        <Toggle label="Annonces vocales" value={prefs.voice} onChange={(v) => setPrefs({ voice: v })} />
        <Label>Débit de la voix</Label>
        <Seg
          options={[
            { label: 'Lent', value: 0.85 },
            { label: 'Normal', value: 1 },
            { label: 'Rapide', value: 1.15 },
          ]}
          value={prefs.voiceRate}
          onChange={(v) => setPrefs({ voiceRate: v })}
        />
        <Label>Point de situation vocal</Label>
        <Seg
          options={[
            { label: 'Jamais', value: 0 },
            { label: '10 min', value: 10 },
            { label: '15 min', value: 15 },
            { label: '20 min', value: 20 },
          ]}
          value={prefs.statusEveryMin}
          onChange={(v) => setPrefs({ statusEveryMin: v })}
        />
        <Toggle
          label="Suivi GPS au départ"
          value={prefs.gpsByDefault}
          onChange={(v) => setPrefs({ gpsByDefault: v })}
          hint="Indispensable pour la voix écran verrouillé et le recalage automatique."
        />
        <Toggle
          label="GPS économe"
          value={prefs.gpsPowerSave}
          onChange={(v) => setPrefs({ gpsPowerSave: v })}
          hint="Moins précis (≈ 50 m), mais moins gourmand en batterie."
        />
        <Toggle label="Garder l'écran allumé en course" value={prefs.keepAwake} onChange={(v) => setPrefs({ keepAwake: v })} />
        <Label>Thème</Label>
        <Seg
          options={[
            { label: 'Auto', value: 'auto' as const },
            { label: 'Sombre', value: 'dark' as const },
            { label: 'Clair', value: 'light' as const },
          ]}
          value={prefs.theme}
          onChange={(v) => setPrefs({ theme: v })}
        />
      </Card>

      <Card>
        <H>Tester avant le jour J</H>
        <Row style={{ marginBottom: 8 }}>
          <Btn
            title="🔊 Tester la voix"
            style={{ flex: 1 }}
            onPress={async () => {
              await configureAudio();
              say('Test. Phase 2 : installation. Fréquence cardiaque entre 147 et 167. 1 minute 20 de retard.', true);
            }}
          />
          <Btn
            title="🔔 Notif dans 10 s"
            style={{ flex: 1 }}
            onPress={async () => {
              const ok = await ensureNotificationPermission();
              if (!ok) setErrors(['Notifications refusées : active-les dans les réglages du téléphone.']);
              else {
                await testNotification(10);
                setInfo('Verrouille ton téléphone : la notification arrive dans 10 s (et sur ta montre si elle relaie les notifications).');
              }
            }}
          />
        </Row>
        <P sub>
          Répétition générale : pendant un footing, appuie sur DÉPART, verrouille l'écran avec ta musique, et vérifie que les
          annonces arrivent. Annule ensuite le départ. Voir docs/TESTS-TERRAIN.md.
        </P>
      </Card>

      <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center' }}>
        TrailPacer · tout fonctionne hors réseau une fois le plan généré.
      </Text>
    </ScrollView>
  );
}
