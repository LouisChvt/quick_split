import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState as RNAppState, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NowScreen } from './src/screens/NowScreen';
import { PassagesScreen } from './src/screens/PassagesScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { tick } from './src/services/announcer';
import { resumeIfRunning } from './src/services/controller';
import { setupNotifications } from './src/services/notifications';
import { ensureLoaded, getState, useAppState } from './src/state/store';
import { Icon, type IconName } from './src/ui/Icon';
import { alpha, useTheme } from './src/ui/theme';

type Tab = 'now' | 'passages' | 'plan' | 'setup';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'now', label: 'Course', icon: 'timer' },
  { key: 'passages', label: 'Passages', icon: 'pin' },
  { key: 'plan', label: 'Plan', icon: 'map' },
  { key: 'setup', label: 'Préparer', icon: 'sliders' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const t = useTheme();
  const { loaded, plan, session, prefs } = useAppState();
  const [tab, setTab] = useState<Tab>('now');
  const [now, setNow] = useState(Date.now());
  const running = !!session && !session.finishedAt;

  useEffect(() => {
    setupNotifications();
    ensureLoaded().then(() => {
      if (!getState().plan) setTab('setup');
      resumeIfRunning().catch(() => {});
    });
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(Date.now());
        resumeIfRunning().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // horloge de l'interface + annonces quand l'app est au premier plan
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (getState().session && !getState().session!.finishedAt) tick(n).catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (running && prefs.keepAwake) activateKeepAwakeAsync('race').catch(() => {});
    else deactivateKeepAwake('race').catch(() => {});
  }, [running, prefs.keepAwake]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const visibleTabs = plan ? TABS : TABS.filter((x) => x.key === 'now' || x.key === 'setup');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        {tab === 'now' && <NowScreen now={now} goTo={setTab} />}
        {tab === 'passages' && <PassagesScreen now={now} />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'setup' && <SetupScreen onPlanReady={() => setTab('plan')} />}
      </View>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.line }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 }}>
          {visibleTabs.map((x) => {
            const on = x.key === tab;
            const c = on ? t.text : t.faint;
            return (
              <Pressable
                key={x.key}
                onPress={() => setTab(x.key)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
                accessibilityRole="tab"
                accessibilityLabel={x.label}
                accessibilityState={{ selected: on }}
              >
                <View
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: on ? alpha(t.accent, t.dark ? 0.18 : 0.45) : 'transparent',
                  }}
                >
                  <Icon name={x.icon} size={22} color={on ? (t.dark ? t.accent : t.text) : c} stroke={on ? 2.3 : 2} />
                  {x.key === 'now' && running ? (
                    <View style={{ position: 'absolute', top: 3, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: t.bad }} />
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, marginTop: 3, fontWeight: on ? '800' : '600', color: c }}>{x.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
