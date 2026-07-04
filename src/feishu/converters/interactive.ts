import type { ContentConverterFn } from './types.js';

export const convertInteractive: ContentConverterFn = (raw) => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Summarize card by extracting header title or first markdown content
    let summary = '[卡片消息]';
    const header = (parsed.header as Record<string, unknown>)?.title as { content?: string } | undefined;
    if (header?.content) {
      summary = `[卡片] ${header.content}`;
    }
    return { content: summary, resources: [] };
  } catch {
    return { content: '[卡片消息]', resources: [] };
  }
};
