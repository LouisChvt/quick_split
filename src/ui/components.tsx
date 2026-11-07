import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { Tile as TileT } from '../core/types';
import { useTheme } from './theme';

export function Card({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  const t = useTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: t.card, borderColor: accent ?? t.line },
        accent ? { borderLeftWidth: 4 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function H({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[s.h, { color: t.text }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[s.label, { color: t.sub }, style]}>{children}</Text>;
}

export function P({ children, style, sub }: { children: React.ReactNode; style?: StyleProp<TextStyle>; sub?: boolean }) {
  const t = useTheme();
  return <Text style={[s.p, { color: sub ? t.sub : t.text }, style]}>{children}</Text>;
}

export function Big({ children, color, size = 44 }: { children: React.ReactNode; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <Text style={{ color: color ?? t.text, fontSize: size, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
      {children}
    </Text>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, style]}>{children}</View>;
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Btn({
  title,
  onPress,
  kind = 'secondary',
  big,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  big?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.bad : kind === 'ghost' ? 'transparent' : t.card2;
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? '#fff' : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        big && s.btnBig,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1, borderColor: t.line },
        kind === 'ghost' && { borderWidth: 1 },
        style,
      ]}
    >
      <Text style={[s.btnText, big && s.btnTextBig, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Bouton à double appui (confirmation sans boîte de dialogue, utilisable en courant). */
export function ConfirmBtn(props: {
  title: string;
  confirmTitle?: string;
  onConfirm: () => void;
  kind?: BtnKind;
  big?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <Btn
      title={armed ? props.confirmTitle ?? 'Appuie encore pour confirmer' : props.title}
      kind={armed ? 'danger' : props.kind}
      big={props.big}
      style={props.style}
      onPress={() => {
        if (armed) {
          setArmed(false);
          props.onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
        }
      }}
    />
  );
}

export function TileGrid({ tiles }: { tiles: TileT[] }) {
  const t = useTheme();
  return (
    <View style={s.grid}>
      {tiles.map((x, i) => (
        <View key={i} style={[s.tile, { backgroundColor: t.card2 }]}>
          <Text style={[s.tileLabel, { color: t.sub }]} numberOfLines={1}>
            {x.label}
          </Text>
          <Text style={[s.tileValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {x.value}
          </Text>
          {x.sub ? (
            <Text style={[s.tileSub, { color: t.sub }]} numberOfLines={1}>
              {x.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  hint,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ marginBottom: 10 }, style]}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.sub}
        keyboardType={keyboardType}
        autoCorrect={false}
        autoCapitalize="none"
        style={[s.input, { color: t.text, backgroundColor: t.card2, borderColor: t.line }]}
      />
      {hint ? <Text style={[s.hint, { color: t.sub }]}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[s.p, { color: t.text, flex: 1 }]}>{label}</Text>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.line }} />
      </Row>
      {hint ? <Text style={[s.hint, { color: t.sub }]}>{hint}</Text> : null}
    </View>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[s.seg, { backgroundColor: t.card2 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: t.accent }]}
          >
            <Text style={{ color: on ? t.accentText : t.text, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Bullets({ items, color }: { items: string[]; color?: string }) {
  const t = useTheme();
  return (
    <View>
      {items.map((x, i) => (
        <Row key={i} style={{ alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ color: color ?? t.sub, marginRight: 6, fontSize: 15 }}>•</Text>
          <Text style={[s.p, { color: t.text, flex: 1 }]}>{x}</Text>
        </Row>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  h: { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  p: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnBig: { paddingVertical: 22, borderRadius: 18 },
  btnText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  btnTextBig: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tile: { width: '31.5%', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8 },
  tileLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tileValue: { fontSize: 22, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  tileSub: { fontSize: 11, marginTop: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  hint: { fontSize: 12, marginTop: 3 },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 10 },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
});
