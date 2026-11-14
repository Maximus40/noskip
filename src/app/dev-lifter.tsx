import { Redirect } from 'expo-router';

import { LifterCard } from '@/components/LifterCard';
import { Screen } from '@/components/ui/Screen';

/** Development-only: the lifter card with sample data, for visual QA (no backend). */
export default function DevLifter() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <LifterCard
        card={{
          userId: 'dev',
          pseudo: 'Sam',
          avatarUrl: null,
          title: 'toujours_au_shaker',
          plateColor: '#B9BBC0',
          lifetimeSessions: 41,
          skipsTotal: 3,
          trophies: [
            { type: 'belt', month: '2026-10-01', teamName: 'Les Déchaînés' },
            { type: 'big_canap', month: '2026-08-01', teamName: 'Binôme' },
          ],
          history: [
            { weekStart: '2026-11-02', achieved: true, usedJoker: false, exempt: false },
            { weekStart: '2026-10-26', achieved: false, usedJoker: true, exempt: false },
            { weekStart: '2026-10-19', achieved: true, usedJoker: false, exempt: false },
            { weekStart: '2026-10-12', achieved: true, usedJoker: false, exempt: false },
          ],
          jokerThisWeek: false,
          jokerMonthUsed: false,
          isMe: true,
        }}
      />
    </Screen>
  );
}
