import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
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
import { Icon, type IconName } from './Icon';
import { alpha, useTheme } from './theme';

const NUM: TextStyle = { fontVariant: ['tabular-nums'] };

/** Écran défilant avec grand titre, et zone d'action fixe en bas (facultative). */
export function Screen({
  title,
  subtitle,
  right,
  footer,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: footer ? 24 : 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {title ? (
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: t.text }]} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? <Text style={[s.subtitle, { color: t.sub }]}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View style={[s.footer, { backgroundColor: t.bg, borderTopColor: t.line }]}>{footer}</View>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  accent,
  flat,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Teinte la carte (statut, phase…). */
  accent?: string;
  /** Carte sans fond, pour regrouper sans encadrer. */
  flat?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        s.card,
        flat
          ? { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 2 }
          : accent
            ? { backgroundColor: alpha(accent, t.dark ? 0.09 : 0.07), borderColor: alpha(accent, t.dark ? 0.35 : 0.3) }
            : { backgroundColor: t.card, borderColor: t.line },
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

export function Label({ children, style, color }: { children: React.ReactNode; style?: StyleProp<TextStyle>; color?: string }) {
  const t = useTheme();
  return <Text style={[s.label, { color: color ?? t.sub }, style]}>{children}</Text>;
}

export function P({ children, style, sub }: { children: React.ReactNode; style?: StyleProp<TextStyle>; sub?: boolean }) {
  const t = useTheme();
  return <Text style={[s.p, { color: sub ? t.sub : t.text }, style]}>{children}</Text>;
}

export function Big({ children, color, size = 44 }: { children: React.ReactNode; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <Text
      style={[{ color: color ?? t.text, fontSize: size, lineHeight: size * 1.1, fontWeight: '800', letterSpacing: -size * 0.025 }, NUM]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {children}
    </Text>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, style]}>{children}</View>;
}

/** Valeur chiffrée avec son libellé (tableau de bord). */
export function Stat({
  label,
  value,
  sub,
  color,
  size = 24,
  align = 'left',
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const ai = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <View style={[{ alignItems: ai, flexShrink: 1 }, style]}>
      <Label style={{ marginBottom: 2 }}>{label}</Label>
      <Big size={size} color={color}>
        {value}
      </Big>
      {sub ? (
        <Text style={[s.small, { color: t.sub, textAlign: align }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function Badge({ text, color, solid }: { text: string; color?: string; solid?: boolean }) {
  const t = useTheme();
  const c = color ?? t.sub;
  return (
    <View style={[s.badge, { backgroundColor: solid ? c : alpha(c, 0.15) }]}>
      <Text style={[s.badgeText, { color: solid ? (t.dark ? t.bg : '#fff') : c }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Message de statut sur une ligne ou deux (erreur, info, succès). */
export function Banner({
  tone,
  icon,
  children,
  style,
}: {
  tone: 'good' | 'warn' | 'bad' | 'info';
  icon?: IconName;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const c = t[tone];
  const ic: IconName = icon ?? (tone === 'good' ? 'check' : tone === 'info' ? 'info' : 'alert');
  return (
    <View style={[s.banner, { backgroundColor: alpha(c, t.dark ? 0.12 : 0.09), borderColor: alpha(c, 0.3) }, style]}>
      <View style={{ marginTop: 1 }}>
        <Icon name={ic} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? <P style={{ fontSize: 14, lineHeight: 20 }}>{children}</P> : children}
      </View>
    </View>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
export function Btn({
  title,
  onPress,
  kind = 'secondary',
  big,
  small,
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  big?: boolean;
  small?: boolean;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    kind === 'primary' ? t.accent : kind === 'danger' ? t.bad : kind === 'ghost' || kind === 'link' ? 'transparent' : t.card2;
  const fg =
    kind === 'primary' ? t.accentText : kind === 'danger' ? '#fff' : kind === 'link' ? t.accentInk : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        big && s.btnBig,
        small && s.btnSmall,
        kind === 'link' && { paddingHorizontal: 4, minHeight: 0 },
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        kind === 'ghost' && { borderWidth: 1, borderColor: t.line },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={big ? 24 : small ? 16 : 18} color={fg} stroke={big ? 2.4 : 2} /> : null}
      <Text style={[s.btnText, big && s.btnTextBig, small && s.btnTextSmall, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
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
  small?: boolean;
  icon?: IconName;
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
      small={props.small}
      icon={armed ? 'alert' : props.icon}
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
        <View key={i} style={[s.tile, { backgroundColor: t.dark ? alpha('#000000', 0.22) : alpha('#FFFFFF', 0.75) }]}>
          <Text style={[s.tileLabel, { color: t.sub }]} numberOfLines={1}>
            {x.label}
          </Text>
          <Text style={[s.tileValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {x.value}
          </Text>
          {x.sub ? (
            <Text style={[s.tileSub, { color: t.faint }]} numberOfLines={1}>
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
  unit,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  /** Unité affichée dans le champ (km, s, bpm…). */
  unit?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[s.fieldLabel, { color: t.sub }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[s.inputWrap, { backgroundColor: t.card2, borderColor: focus ? t.accentInk : 'transparent' }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.faint}
          keyboardType={keyboardType}
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[s.input, { color: t.text }]}
        />
        {unit ? <Text style={[s.unit, { color: t.faint }]}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={[s.hint, { color: t.faint }]}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={[s.toggle, { borderBottomColor: t.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.p, { color: t.text, fontWeight: '600' }]}>{label}</Text>
        {hint ? <Text style={[s.hint, { color: t.faint, marginTop: 2 }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.accent, false: t.card2 }}
        thumbColor={value ? (t.dark ? t.bg : '#fff') : t.sub}
        {...({ activeThumbColor: t.dark ? t.bg : '#fff' } as object)}
      />
    </Pressable>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[s.seg, { backgroundColor: t.card2 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.segItem, on && { backgroundColor: t.dark ? t.text : t.card, ...s.segOn }]}
          >
            <Text style={{ color: on ? (t.dark ? t.bg : t.text) : t.sub, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Bullets({ items, color }: { items: string[]; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {items.map((x, i) => (
        <Row key={i} style={{ alignItems: 'flex-start', gap: 10 }}>
          <View style={[s.dot, { backgroundColor: color ?? t.faint }]} />
          <Text style={[s.p, { color: t.text, flex: 1 }]}>{x}</Text>
        </Row>
      ))}
    </View>
  );
}

/** Section repliable numérotée (formulaire de préparation, phases du plan). */
export function Section({
  icon,
  title,
  summary,
  done,
  open,
  onToggle,
  color,
  children,
}: {
  icon: IconName;
  title: string;
  summary?: string;
  done?: boolean;
  open: boolean;
  onToggle: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const c = color ?? t.accentInk;
  return (
    <View style={[s.card, { backgroundColor: t.card, borderColor: open ? t.line : t.line, padding: 0 }]}>
      <Pressable onPress={onToggle} style={s.sectionHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={[s.sectionIcon, { backgroundColor: alpha(c, 0.14) }]}>
          <Icon name={icon} size={18} color={c} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: t.text }]}>{title}</Text>
          {summary && !open ? (
            <Text style={[s.small, { color: t.sub }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        {done && !open ? <Icon name="check" size={18} color={t.good} stroke={2.5} /> : null}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={t.faint} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View> : null}
    </View>
  );
}

/** Titre de groupe au-dessus de cartes. */
export function GroupTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 12, marginBottom: 8, paddingHorizontal: 4 }}>
      <Text style={[s.group, { color: t.sub }]}>{children}</Text>
      {right}
    </Row>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line, marginVertical: 12 }, style]} />;
}

export const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16, marginTop: 8, paddingHorizontal: 4 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, marginTop: 2 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1 },
  h: { fontSize: 19, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 },
  group: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },
  p: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBig: { minHeight: 68, borderRadius: 20 },
  btnSmall: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  btnText: { fontSize: 16, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  btnTextBig: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  btnTextSmall: { fontSize: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  banner: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tile: { flexBasis: '30%', flexGrow: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10 },
  tileLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.4, ...NUM },
  tileSub: { fontSize: 11, marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, fontSize: 17, paddingVertical: 10, fontWeight: '600', minWidth: 0, ...NUM },
  unit: { fontSize: 14, fontWeight: '600', marginLeft: 6 },
  hint: { fontSize: 12, lineHeight: 16, marginTop: 5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 12 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  segOn: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
});
