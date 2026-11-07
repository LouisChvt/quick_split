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
import { useTheme } from './src/ui/theme';

type Tab = 'now' | 'passages' | 'plan' | 'setup';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'now', label: 'Course', icon: '⏱' },
  { key: 'passages', label: 'Passages', icon: '📍' },
  { key: 'plan', label: 'Plan', icon: '🗺' },
  { key: 'setup', label: 'Préparer', icon: '⚙️' },
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
        <View style={{ flexDirection: 'row' }}>
          {visibleTabs.map((x) => {
            const on = x.key === tab;
            return (
              <Pressable
                key={x.key}
                onPress={() => setTab(x.key)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={{ fontSize: 20, opacity: on ? 1 : 0.55 }}>{x.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: on ? t.accent : t.sub }}>
                  {x.label}
                  {x.key === 'now' && running ? ' ●' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
