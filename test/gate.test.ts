import { describe, it, expect } from 'vitest';
import { checkMessageGate } from '../src/feishu/gate.js';
import type { MessageContext } from '../src/feishu/types.js';

function makeContext(overrides: Partial<MessageContext>): MessageContext {
  return {
    accountId: 'default',
    chatId: 'oc_test',
    chatType: 'group',
    senderId: 'ou_user',
    messageId: 'om_test',
    contentType: 'text',
    content: 'hello',
    resources: [],
    mentions: [],
    mentionAll: false,
    isMentioned: false,
    rawMessage: {},
    rawSender: {},
    ...overrides,
  };
}

describe('gate', () => {
  it('allows group message when mention required and bot mentioned', () => {
    const ctx = makeContext({ isMentioned: true });
    const result = checkMessageGate(ctx, { requireMention: true });
    expect(result.allowed).toBe(true);
  });

  it('blocks group message when mention required and not mentioned', () => {
    const ctx = makeContext({ isMentioned: false });
    const result = checkMessageGate(ctx, { requireMention: true });
    expect(result.allowed).toBe(false);
  });

  it('allows DM by default', () => {
    const ctx = makeContext({ chatType: 'p2p' });
    const result = checkMessageGate(ctx, {});
    expect(result.allowed).toBe(true);
  });

  it('respects allowlist', () => {
    const ctx = makeContext({ senderId: 'ou_allowed' });
    const result = checkMessageGate(ctx, { groupPolicy: 'allowlist', groupAllowFrom: ['ou_allowed'] });
    expect(result.allowed).toBe(true);
  });

  it('blocks non-allowlist sender', () => {
    const ctx = makeContext({ senderId: 'ou_other' });
    const result = checkMessageGate(ctx, { groupPolicy: 'allowlist', groupAllowFrom: ['ou_allowed'] });
    expect(result.allowed).toBe(false);
  });

  it('wildcard allowlist allows everyone', () => {
    const ctx = makeContext({ senderId: 'ou_any' });
    const result = checkMessageGate(ctx, { groupPolicy: 'allowlist', groupAllowFrom: ['*'] });
    expect(result.allowed).toBe(true);
  });
});
