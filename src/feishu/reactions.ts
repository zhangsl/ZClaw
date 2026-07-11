import { LarkClient } from './client.js';
import type { FeishuAccount } from './accounts.js';
import { warn } from '../utils/logger.js';

export interface ReactionResult {
  reactionId: string;
}

interface ReactionCreateResponse {
  data?: {
    reaction_id?: string;
  };
}

export async function addReaction(
  account: FeishuAccount,
  messageId: string,
  emojiType: string,
): Promise<string | undefined> {
  const client = LarkClient.fromAccount(account).sdk as unknown as {
    request: (opts: { method: string; url: string; data?: unknown }) => Promise<ReactionCreateResponse>;
  };

  const normalizedMessageId = messageId.replace(/^\//, '').split('/')[0];

  try {
    const res = await client.request({
      method: 'POST',
      url: `/open-apis/im/v1/messages/${normalizedMessageId}/reactions`,
      data: {
        reaction_type: {
          emoji_type: emojiType,
        },
      },
    });
    return res.data?.reaction_id;
  } catch (err) {
    warn('Failed to add reaction', `reactions:${account.accountId}`, { messageId, error: err instanceof Error ? err.message : String(err) });
    return undefined;
  }
}

export async function removeReaction(
  account: FeishuAccount,
  messageId: string,
  reactionId: string | undefined,
): Promise<void> {
  if (!reactionId) return;

  const client = LarkClient.fromAccount(account).sdk as unknown as {
    request: (opts: { method: string; url: string }) => Promise<unknown>;
  };

  const normalizedMessageId = messageId.replace(/^\//, '').split('/')[0];

  try {
    await client.request({
      method: 'DELETE',
      url: `/open-apis/im/v1/messages/${normalizedMessageId}/reactions/${reactionId}`,
    });
  } catch (err) {
    warn('Failed to remove reaction', `reactions:${account.accountId}`, { messageId, reactionId, error: err instanceof Error ? err.message : String(err) });
  }
}
