import type { MentionInfo } from '../types.js';

export interface ConvertContext {
  mentions: Map<string, MentionInfo>;
  mentionsByOpenId: Map<string, MentionInfo>;
  messageId: string;
  botOpenId?: string;
  stripBotMentions: boolean;
}

export interface ConvertResult {
  content: string;
  resources: Array<{
    type: 'image' | 'file' | 'audio' | 'video';
    fileKey?: string;
    fileName?: string;
  }>;
}

export type ContentConverterFn = (raw: string, ctx: ConvertContext) => ConvertResult | Promise<ConvertResult>;
