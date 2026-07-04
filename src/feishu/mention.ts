import type { MentionInfo } from './types.js';

export interface RawMention {
  key: string;
  id?: {
    open_id?: string;
  };
  name?: string;
}

export function isMentionAll(mention: RawMention): boolean {
  return mention.id?.open_id === 'all';
}

export function extractMentions(rawMentions: RawMention[] | undefined, botOpenId?: string): MentionInfo[] {
  const list: MentionInfo[] = [];
  if (!Array.isArray(rawMentions)) return list;

  for (const m of rawMentions) {
    if (isMentionAll(m)) {
      list.push({ key: m.key, openId: '', name: m.name ?? '所有人', isBot: false });
      continue;
    }
    const openId = m.id?.open_id ?? '';
    if (!openId) continue;
    list.push({
      key: m.key,
      openId,
      name: m.name ?? '',
      isBot: Boolean(botOpenId && openId === botOpenId),
    });
  }
  return list;
}

export function isBotMentioned(mentions: MentionInfo[]): boolean {
  return mentions.some((m) => m.isBot);
}

export function stripBotMentions(text: string, mentions: MentionInfo[]): string {
  let result = text;
  for (const m of mentions) {
    if (m.isBot) {
      result = result.replace(new RegExp(`@${m.key}\\b`, 'g'), '');
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function stripAllMentions(text: string, mentions: MentionInfo[]): string {
  let result = text;
  for (const m of mentions) {
    result = result.replace(new RegExp(`@${m.key}\\b`, 'g'), '');
  }
  return result.replace(/\s+/g, ' ').trim();
}
