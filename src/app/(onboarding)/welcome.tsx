import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Canap } from '@/components/Canap';
import { SkipPoster } from '@/components/SkipPoster';
import { TeamBar } from '@/components/TeamBar';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatKg, platesFor } from '@/domain/bar';
import { SAMPLE_PSEUDO, sampleSkipLine } from '@/domain/shop';
import { WELCOME_DEMO_TEAM, WELCOME_SLIDES } from '@/domain/welcome';
import { feedback } from '@/features/feedback/feedback';
import { useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

/**
 * First screen of the app, before any question: three swipeable pages that sell the game
 * (team bar, a plate loading with its clang, the SKIP poster), then "Je me lance".
 * `?replay=1` comes from Settings → Revoir l'intro: it closes instead of starting onboarding.
 */
export default function Welcome() {
  const params = useLocalSearchParams<{ replay?: string; page?: string }>();
  const replay = params.replay === '1';
  // ?page=n opens on a given page (visual QA of the dev-only /dev-welcome route).
  const startPage = Math.min(Math.max(Number(params.page) || 0, 0), WELCOME_SLIDES.length - 1);
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(startPage);
  const save = useUpdateLocalOnboarding();
  const last = WELCOME_SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const goTo = (i: number) => scroller.current?.scrollTo({ x: i * width, animated: true });

  // Opening on another page (?page=n): contentOffset is ignored on some platforms.
  useEffect(() => {
    if (startPage === 0) return;
    const t = setTimeout(
      () => scroller.current?.scrollTo({ x: startPage * width, animated: false }),
      50,
    );
    return () => clearTimeout(t);
  }, [startPage, width]);

  const finish = () => {
    if (replay && router.canGoBack()) {
      router.back();
      return;
    }
    save.mutate({ welcomeSeen: true }, { onSuccess: () => router.replace('/') });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Wordmark size={22} />
        {page < last ? (
          <PressableScale
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Passer l'intro"
            style={styles.skip}
          >
            <Text variant="bodyStrong" color={colors.muted}>
              Passer
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
        contentOffset={{ x: startPage * width, y: 0 }}
        style={styles.flex}
      >
        {WELCOME_SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.page, { width }]}>
            <View style={styles.visual}>
              {slide.key === 'team' ? <TeamVisual /> : null}
              {slide.key === 'plate' ? <PlateVisual active={page === i} /> : null}
              {slide.key === 'skip' ? <SkipVisual active={page === i} width={width} /> : null}
            </View>
            <View style={styles.copy}>
              <Text variant="label" color={colors.accent}>
                {slide.eyebrow}
              </Text>
              <Text variant="display" style={styles.title} accessibilityRole="header">
                {slide.title}
              </Text>
              <Text variant="body" color="#C9CACE">
                {slide.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Page ${page + 1} sur ${last + 1}`}>
          {WELCOME_SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        {page < last ? (
          <Button label="Suivant" onPress={() => goTo(page + 1)} />
        ) : (
          <Button
            label={replay ? 'Compris' : 'Je me lance'}
            onPress={finish}
            disabled={save.isPending}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/** Page 1: the empty team bar, the kilos at zero, the Canap' waiting. */
function TeamVisual() {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? FadeIn : FadeInDown.duration(500)} style={styles.card}>
      <Text variant="caption" color={colors.muted} style={styles.stretch}>
        {`Ta team · ${WELCOME_DEMO_TEAM.name}`}
      </Text>
      <Text variant="number" style={styles.kg}>
        0 kg
      </Text>
      <TeamBar plates={[]} width={300} accessibilityLabel="Barre de la team, vide" />
      <Canap mood="idle" size={130} accessible={false} />
    </Animated.View>
  );
}

/** Page 2: plates load one by one (teammates in grey, yours in orange), clang + heavy haptic. */
function PlateVisual({ active }: { active: boolean }) {
  // Remounted each time the page comes back, so the bar loads again from zero.
  return active ? <PlateLoading /> : <PlateCard count={0} />;
}

function PlateLoading() {
  const total = platesFor(WELCOME_DEMO_TEAM.players, colors.accent).length;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setCount(n);
      // Sound needs the player's settings (not known yet): the haptic alone sells the clang.
      feedback('plate_loaded', { sound: false, haptics: true }).catch(() => undefined);
      if (n >= total) clearInterval(timer);
    }, 450);
    return () => clearInterval(timer);
  }, [total]);

  return <PlateCard count={count} />;
}

function PlateCard({ count }: { count: number }) {
  const plates = platesFor(WELCOME_DEMO_TEAM.players, colors.accent).slice(0, count);
  return (
    <View style={styles.card}>
      <Text variant="caption" color={colors.muted} style={styles.stretch}>
        {`Ta team · ${WELCOME_DEMO_TEAM.name}`}
      </Text>
      <Text variant="number" style={styles.kg}>
        {`${formatKg(count * 20)} kg`}
      </Text>
      <TeamBar
        plates={plates}
        newPlateKey={plates[plates.length - 1]?.key ?? null}
        width={300}
        accessibilityLabel={`Barre de la team : ${count * 20} kilos`}
      />
      <View style={styles.legend}>
        <Legend color={colors.accent} label="Tes disques" />
        <Legend color={colors.plates[1]} label="Ceux de tes potes" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
    </View>
  );
}

/** Page 3: the SKIP poster stamps in, as the whole team will see it on Sunday. */
// The whole poster lands like a rubber stamp: big and see-through, then slammed in place.
const posterStamp = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.35 }, { rotate: '-5deg' }] },
  70: { opacity: 1, transform: [{ scale: 0.96 }, { rotate: '1deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
}).duration(520);

function SkipVisual({ active, width }: { active: boolean; width: number }) {
  const reduced = useReducedMotion();
  const posterWidth = Math.min(width - 2 * spacing.xl, 300) * 0.82;
  useEffect(() => {
    if (active) feedback('skip', { sound: false, haptics: true }).catch(() => undefined);
  }, [active]);
  return (
    <View style={styles.posterWrap}>
      {active ? (
        <Animated.View entering={reduced ? FadeIn : posterStamp.delay(150)}>
          <SkipPoster
            width={posterWidth}
            pseudo={SAMPLE_PSEUDO}
            line={sampleSkipLine('leg-day')}
            teamName={WELCOME_DEMO_TEAM.name}
            teamKg={200}
            skips={1}
            inviteLabel="Rejoins la team · code ABCD-2345"
            weekLabel="Cette semaine"
            animated={false}
          />
        </Animated.View>
      ) : (
        <View style={{ width: posterWidth, height: (posterWidth * 16) / 9 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    minHeight: minTouch,
  },
  skip: {
    minHeight: minTouch,
    minWidth: minTouch,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  page: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.lg, justifyContent: 'center' },
  visual: { alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  copy: { gap: spacing.sm },
  title: { fontSize: 34, lineHeight: 36, letterSpacing: -1 },
  card: {
    alignSelf: 'stretch',
    borderRadius: radii.cardLarge,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  stretch: { alignSelf: 'stretch' },
  kg: { fontSize: 44, lineHeight: 48 },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 10, height: 18, borderRadius: 3 },
  posterWrap: { alignItems: 'center', borderRadius: radii.card, overflow: 'hidden' },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotOn: { width: 22, backgroundColor: colors.accent },
});
