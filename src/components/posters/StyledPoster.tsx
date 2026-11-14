import { SkipPoster } from '@/components/SkipPoster';
import type { PosterStyle } from '@/domain/shop';

import { BreakingNewsPoster } from './BreakingNewsPoster';
import { GameOverPoster } from './GameOverPoster';
import { GoldPoster } from './GoldPoster';
import { RedCardPoster } from './RedCardPoster';
import type { PosterProps } from './types';
import { WantedPoster } from './WantedPoster';

const POSTERS: Record<PosterStyle, (p: PosterProps) => React.ReactNode> = {
  classic: SkipPoster,
  gold: GoldPoster,
  redcard: RedCardPoster,
  gameover: GameOverPoster,
  wanted: WantedPoster,
  news: BreakingNewsPoster,
};

/** A SKIP card in the style stored on it (the classic poster, or a premium one from the shop). */
export function StyledPoster({ style, ...props }: PosterProps & { style: PosterStyle }) {
  const Poster = POSTERS[style] ?? SkipPoster;
  return <Poster {...props} />;
}
