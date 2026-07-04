import type { ContentConverterFn } from './types.js';

function extractTextFromPost(elements: unknown[]): string {
  const lines: string[] = [];
  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    const item = el as Record<string, unknown>;
    if (item.tag === 'text' && typeof item.text === 'string') {
      lines.push(item.text);
    } else if (item.tag === 'a' && typeof item.text === 'string') {
      lines.push(`[${item.text}](${item.href ?? ''})`);
    } else if (item.tag === 'at' && typeof item.user_id === 'string') {
      lines.push(`@${item.user_id}`);
    } else if (Array.isArray(item.content)) {
      for (const line of item.content) {
        if (Array.isArray(line)) {
          lines.push(extractTextFromPost(line));
        }
      }
    }
  }
  return lines.join('');
}

export const convertPost: ContentConverterFn = (raw) => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const locale = parsed.zh_cn ?? parsed.en_us ?? parsed;
    const contentObj = (locale as Record<string, unknown>)?.content;
    let text = '';
    if (Array.isArray(contentObj)) {
      for (const line of contentObj) {
        if (Array.isArray(line)) {
          text += extractTextFromPost(line);
        }
      }
    }
    return { content: text || raw, resources: [] };
  } catch {
    return { content: raw, resources: [] };
  }
};
