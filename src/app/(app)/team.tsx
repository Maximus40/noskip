import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Canap } from '@/components/Canap';
import { GiftBanner } from '@/components/GiftBanner';
import { CountUp } from '@/components/CountUp';
import { ArrowUpRight } from '@/components/icons/ArrowUpRight';
import { HistoryIcon, InviteIcon, TimerIcon } from '@/components/icons/GameIcons';
import { MapBackdrop } from '@/components/MapBackdrop';
import { PlayerRow } from '@/components/PlayerRow';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { PressableScale } from '@/components/ui/PressableScale';
import { RoundGlassButton } from '@/components/ui/RoundGlassButton';
import { PromoCard } from '@/components/PromoCard';
import { promoToShow } from '@/domain/promo';
import { Text } from '@/components/ui/Text';
import { canSpot, formatKg } from '@/domain/bar';
import { useGymPoints, useVisit } from '@/features/checkin/useCheckin';
import { feedback } from '@/features/feedback/feedback';
import { useMyGyms, useProfile } from '@/features/profile/api';
import {
  useDuoStreak,
  useMySpotsToday,
  useMyTeams,
  useSendSpot,
  useTeamBoard,
} from '@/features/teams/api';
import { useBarState } from '@/features/teams/useBarState';
import { useMyShop, useTeamSkins } from '@/features/shop/api';
import { CoachMarks, CoachMarksProvider, useCoachTarget } from '@/features/tutorial/CoachMarks';
import { TEAM_TUTORIAL } from '@/domain/tutorial';
import { useLocalOnboarding, useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { useLatestClosedWeek } from '@/features/weeks/api';
import { weekRangeLabel } from '@/domain/weekClose';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

/** Ma team: the team barbell over a dark map of the neighbourhood (glass on map). */
export default function TeamTab() {
  return (
    <CoachMarksProvider>
      <TeamScreen />
    </CoachMarksProvider>
  );
}

function TeamScreen() {
  const local = useLocalOnboarding();
  const saveLocal = useUpdateLocalOnboarding();
  const barTarget = useCoachTarget('bar');
  const playersTarget = useCoachTarget('players');
  const sessionTarget = useCoachTarget('session');
  const historyTarget = useCoachTarget('history');
  const teams = useMyTeams();
  const [teamIndex, setTeamIndex] = useState(0);
  const team = teams.data?.[Math.min(teamIndex, (teams.data?.length ?? 1) - 1)];
  const board = useTeamBoard(team?.id);
  const duo = useDuoStreak(team?.id);
  const lastWeek = useLatestClosedWeek(team?.id);
  const spotsToday = useMySpotsToday();
  const sendSpot = useSendSpot();
  const profile = useProfile();
  const myGyms = useMyGyms();
  const visit = useVisit();
  const { gyms } = useGymPoints();
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      board.refetch();
      spotsToday.refetch();
      visit.refetch();
      lastWeek.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [team?.id]),
  );

  const myShop = useMyShop();
  const promo = promoToShow(now, {
    tutorialSeen: local.data?.tutorialSeen ?? false,
    dismissedAt: local.data?.promoDismissedAt ?? null,
    owned: myShop.data?.owned ?? new Set<string>(),
  });
  const skins = useTeamSkins(team?.id);
  const state = useBarState(board.data, now, skins.data);
  const prefs = {
    sound: profile.data?.sound_enabled ?? true,
    haptics: profile.data?.haptics_enabled ?? true,
  };

  // The team lifts the bar: once per screen visit, with chalk and a heavy thud.
  useEffect(() => {
    if (state?.pr) feedback('team_pr', prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.pr]);

  const primary = myGyms.data?.find((g) => g.is_primary)?.gym as unknown as {
    lat: number;
    lng: number;
  } | null;
  const center = primary ?? (gyms[0] ? { lat: gyms[0].lat, lng: gyms[0].lng } : null);
  const shakyPlayers = state?.players.filter((p) => p.risk === 'shaky') ?? [];
  const isDuo = (state?.players.length ?? 0) === 2;
  // The Sunday recap stays on top of "Ma team" until Tuesday night.
  const recentRecap =
    lastWeek.data && now - Date.parse(lastWeek.data.closedAt) < 50 * 3600_000
      ? lastWeek.data
      : null;
  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(80 * i).duration(380));

  async function onSpot(userId: string, pseudo: string) {
    if (!team) return;
    setNotice(null);
    try {
      const res = await sendSpot.mutateAsync({ teamId: team.id, userId });
      await feedback('tap', prefs);
      const left = res?.remaining_today ?? 0;
      setNotice(
        `Spot envoyé à ${pseudo}. ${left > 0 ? `Encore ${left} aujourd'hui.` : "C'était ton dernier du jour."}`,
      );
    } catch (err) {
      setNotice(toUserMessage(err));
    }
  }

  return (
    <View style={styles.fill}>
      <MapBackdrop center={center} />
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              tintColor={colors.offWhite}
              refreshing={board.isRefetching}
              onRefresh={() => {
                setNow(Date.now());
                board.refetch();
                duo.refetch();
                spotsToday.refetch();
              }}
            />
          }
        >
          <View style={styles.header}>
            <PressableScale
              onPress={() =>
                setTeamIndex((i) =>
                  (teams.data?.length ?? 1) > 1 ? (i + 1) % teams.data!.length : i,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={team ? `Team ${team.name}` : 'Ta team'}
              accessibilityHint={
                (teams.data?.length ?? 0) > 1 ? 'Passer à la team suivante' : undefined
              }
            >
              <GlassPanel radius={radii.round} style={styles.teamChip}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {team?.name ?? 'Ta team'}
                </Text>
                {(teams.data?.length ?? 0) > 1 ? (
                  <Text variant="caption" color={colors.muted}>
                    {`${teamIndex + 1}/${teams.data!.length}`}
                  </Text>
                ) : null}
              </GlassPanel>
            </PressableScale>
            <RoundGlassButton
              onPress={() =>
                team && router.push({ pathname: '/team-manage/[id]', params: { id: team.id } })
              }
              accessibilityLabel="Inviter un pote"
            >
              <InviteIcon color={colors.offWhite} />
            </RoundGlassButton>
          </View>

          <GiftBanner />

          {promo && myShop.data ? (
            <PromoCard
              promo={promo}
              onOpen={() => router.navigate('/boutique')}
              onClose={() => saveLocal.mutate({ promoDismissedAt: new Date().toISOString() })}
            />
          ) : null}

          {recentRecap ? (
            <PressableScale
              onPress={() =>
                router.push({ pathname: '/recap/[weekId]', params: { weekId: recentRecap.weekId } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Bilan du dimanche, ${weekRangeLabel(recentRecap.weekStart)}`}
            >
              <GlassPanel radius={radii.glass} style={styles.recap}>
                <View style={styles.flex}>
                  <Text variant="label" color={colors.accent}>
                    Bilan du dimanche
                  </Text>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {weekRangeLabel(recentRecap.weekStart)}
                  </Text>
                </View>
                <ArrowUpRight color={colors.accent} size={20} />
              </GlassPanel>
            </PressableScale>
          ) : null}

          {!state ? (
            <View style={styles.loading} accessibilityLabel="Chargement de la barre">
              <GlassPanel style={styles.skeletonBig} />
              <GlassPanel style={styles.skeletonSmall} />
            </View>
          ) : (
            <>
              <Animated.View entering={enter(0)} style={styles.counter}>
                <Text variant="label" color={colors.muted}>
                  Barre de la team · cette semaine
                </Text>
                <View style={styles.kgRow}>
                  <CountUp
                    variant="display"
                    style={styles.kg}
                    value={state.kg}
                    format={formatKg}
                    accessibilityLabel={`${state.kg} kilos`}
                  />
                  <Text variant="title" style={styles.kgUnit}>
                    kg
                  </Text>
                </View>
              </Animated.View>

              <Animated.View entering={enter(1)} ref={barTarget} collapsable={false}>
                <GlassPanel radius={radii.glass} style={styles.barPanel}>
                  {state.pr ? (
                    <View style={styles.prRow}>
                      <Canap mood="crushed" size={96} />
                      <View style={styles.flex}>
                        <Text variant="label" color={colors.accent}>
                          PR de la team
                        </Text>
                        <Text variant="headline">
                          La team soulève la barre. Le Canap&apos; est écrasé.
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {state.plates.length === 0 ? (
                    <View style={styles.empty}>
                      <Canap mood="idle" size={120} />
                      <Text variant="headline">Barre vide. Le Canap&apos; adore.</Text>
                      <Text variant="caption" color={colors.muted}>
                        Première séance de la semaine = premier disque.
                      </Text>
                    </View>
                  ) : null}
                  <TeamBar
                    plates={state.plates}
                    shaky={state.shaky}
                    width={320}
                    accessibilityLabel={`Barre de la team : ${state.kg} kilos, ${state.plates.length} disques${state.shaky ? ', la barre tremble' : ''}`}
                  />
                  {shakyPlayers.length ? (
                    <Text
                      variant="bodyStrong"
                      color={colors.accent}
                      accessibilityLiveRegion="polite"
                    >
                      {shakyPlayers.length === 1
                        ? `${shakyPlayers[0].isMe ? 'Tu risques' : `${shakyPlayers[0].pseudo} risque`} le skip. La barre tremble.`
                        : `${shakyPlayers.map((p) => p.pseudo).join(' et ')} risquent le skip.`}
                    </Text>
                  ) : null}
                </GlassPanel>
              </Animated.View>

              {isDuo ? (
                <Animated.View entering={enter(2)}>
                  <GlassPanel radius={radii.glass} style={styles.duo}>
                    <Text variant="number" style={styles.duoNumber}>
                      {`${duo.data?.current_weeks ?? 0} sem.`}
                    </Text>
                    <View style={styles.flex}>
                      <Text variant="label" color={colors.accent}>
                        Série duo
                      </Text>
                      <Text variant="caption" color={colors.muted}>
                        {`Semaines où vous avez tenu tous les deux. Record : ${duo.data?.best_weeks ?? 0}.`}
                      </Text>
                    </View>
                  </GlassPanel>
                </Animated.View>
              ) : null}

              <Animated.View entering={enter(3)} ref={playersTarget} collapsable={false}>
                <GlassPanel radius={radii.glass} style={styles.players}>
                  {state.players.map((p) => {
                    const row = board.data?.find((r) => r.user_id === p.id);
                    const sent = spotsToday.data?.includes(p.id) ?? false;
                    const spotState = canSpot(p, p.risk) ? (sent ? 'sent' : 'available') : 'hidden';
                    return (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        avatarUrl={row?.avatar_url ?? null}
                        spot={{
                          state: spotState,
                          busy: sendSpot.isPending,
                          onPress: () => onSpot(p.id, p.pseudo),
                        }}
                        onOpen={() =>
                          p.isMe
                            ? router.push('/lifter')
                            : router.push({ pathname: '/lifter/[id]', params: { id: p.id } })
                        }
                      />
                    );
                  })}
                  {state.players.length === 1 ? (
                    <Button
                      label="Invite ton binôme"
                      variant="secondary"
                      onPress={() =>
                        team &&
                        router.push({ pathname: '/team-manage/[id]', params: { id: team.id } })
                      }
                    />
                  ) : null}
                </GlassPanel>
              </Animated.View>
              {notice ? (
                <Text
                  variant="caption"
                  color={colors.offWhite}
                  style={styles.notice}
                  accessibilityLiveRegion="polite"
                >
                  {notice}
                </Text>
              ) : null}
            </>
          )}
          <ErrorNote
            message={
              board.error
                ? toUserMessage(board.error)
                : teams.error
                  ? toUserMessage(teams.error)
                  : null
            }
          />
          {__DEV__ ? (
            <Button
              label="Mode démo"
              variant="ghost"
              withArrow={false}
              onPress={() => router.push('/dev')}
            />
          ) : null}
        </ScrollView>

        <View style={styles.actions} pointerEvents="box-none">
          <View ref={historyTarget} collapsable={false}>
            <RoundGlassButton
              onPress={() =>
                router.push({ pathname: '/history', params: team ? { team: team.id } : {} })
              }
              accessibilityLabel="Historique des semaines"
            >
              <HistoryIcon color={colors.offWhite} />
            </RoundGlassButton>
          </View>
          <View ref={sessionTarget} collapsable={false}>
            <RoundGlassButton
              size="main"
              accent
              onPress={() => router.push('/session')}
              accessibilityLabel={visit.data ? 'Séance en cours' : 'Je suis à la salle'}
            >
              <TimerIcon color={colors.accent} />
            </RoundGlassButton>
          </View>
          <View style={styles.actionSpacer} />
        </View>
        {/* First visit: the interactive tutorial, once the bar is on screen. */}
        <CoachMarks
          steps={TEAM_TUTORIAL}
          visible={local.data?.tutorialSeen === false && Boolean(state)}
          onDone={() => saveLocal.mutate({ tutorialSeen: true })}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1, gap: 2 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 220 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    maxWidth: 260,
  },
  recap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  counter: { marginTop: spacing.lg, gap: spacing.xs },
  kgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  kg: { fontSize: 72, lineHeight: 74, letterSpacing: -2 },
  kgUnit: { paddingBottom: 8 },
  barPanel: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'stretch' },
  empty: { alignItems: 'center', gap: spacing.xs },
  duo: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  duoNumber: { fontSize: 44, lineHeight: 48 },
  players: { padding: spacing.lg, gap: spacing.sm },
  notice: { textAlign: 'center' },
  loading: { gap: spacing.md, marginTop: spacing.xl },
  skeletonBig: { height: 220 },
  skeletonSmall: { height: 140 },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  actionSpacer: { width: 50 },
});
