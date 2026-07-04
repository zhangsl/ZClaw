import type { GateResult, MessageContext } from './types.js';

export interface GateConfig {
  dmPolicy?: 'open' | 'allowlist' | 'disabled';
  groupPolicy?: 'open' | 'allowlist' | 'disabled';
  requireMention?: boolean;
  allowFrom?: string[];
  groupAllowFrom?: string[];
}

function matchesAllowlist(senderId: string, allowFrom: string[] | undefined): boolean {
  if (!allowFrom || allowFrom.length === 0) return false;
  return allowFrom.includes('*') || allowFrom.includes(senderId);
}

export function checkMessageGate(ctx: MessageContext, config: GateConfig): GateResult {
  if (ctx.chatType === 'p2p') {
    const policy = config.dmPolicy ?? 'open';
    if (policy === 'disabled') {
      return { allowed: false, reason: 'DMs are disabled' };
    }
    if (policy === 'allowlist' && !matchesAllowlist(ctx.senderId, config.allowFrom)) {
      return { allowed: false, reason: 'Sender not in DM allowlist' };
    }
    return { allowed: true };
  }

  // group
  const policy = config.groupPolicy ?? 'open';
  if (policy === 'disabled') {
    return { allowed: false, reason: 'Group chats are disabled' };
  }
  if (policy === 'allowlist' && !matchesAllowlist(ctx.senderId, config.groupAllowFrom ?? config.allowFrom)) {
    return { allowed: false, reason: 'Sender not in group allowlist' };
  }
  if (config.requireMention && !ctx.isMentioned) {
    return { allowed: false, reason: 'Bot was not mentioned' };
  }
  return { allowed: true };
}
