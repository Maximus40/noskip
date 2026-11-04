import { Share } from 'react-native';

import { inviteMessage } from '@/domain/teams';
import { env } from '@/lib/env';

/** Opens the native share sheet with the team invite. Resolves true if shared. */
export async function shareInvite(teamName: string, code: string): Promise<boolean> {
  const result = await Share.share({ message: inviteMessage(teamName, code, env?.inviteHost) });
  return result.action === Share.sharedAction;
}
