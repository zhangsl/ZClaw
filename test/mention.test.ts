import { describe, it, expect } from 'vitest';
import { extractMentions, isBotMentioned, stripBotMentions } from '../src/feishu/mention.js';

describe('mention', () => {
  it('extracts normal mentions', () => {
    const mentions = extractMentions(
      [
        { key: 'ou_123', id: { open_id: 'ou_123' }, name: 'Alice' },
        { key: 'ou_bot', id: { open_id: 'ou_bot' }, name: 'ZClaw' },
      ],
      'ou_bot',
    );
    expect(mentions).toHaveLength(2);
    expect(mentions[0]?.isBot).toBe(false);
    expect(mentions[1]?.isBot).toBe(true);
  });

  it('detects mention all', () => {
    const mentions = extractMentions([{ key: 'all', id: { open_id: 'all' }, name: '所有人' }]);
    expect(mentions[0]?.openId).toBe('');
  });

  it('detects bot mentioned', () => {
    const mentions = extractMentions([{ key: 'ou_bot', id: { open_id: 'ou_bot' }, name: 'ZClaw' }], 'ou_bot');
    expect(isBotMentioned(mentions)).toBe(true);
  });

  it('strips bot mentions', () => {
    const mentions = extractMentions([{ key: 'ou_bot', id: { open_id: 'ou_bot' }, name: 'ZClaw' }], 'ou_bot');
    const text = 'Hello @ou_bot how are you?';
    expect(stripBotMentions(text, mentions)).toBe('Hello how are you?');
  });
});
