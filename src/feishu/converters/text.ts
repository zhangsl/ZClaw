import type { ContentConverterFn } from './types.js';

export const convertText: ContentConverterFn = (raw) => {
  let content: string;
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    content = parsed.text ?? raw;
  } catch {
    content = raw;
  }
  return { content, resources: [] };
};
