import type { ContentConverterFn } from './types.js';

export const convertImage: ContentConverterFn = (raw) => {
  try {
    const parsed = JSON.parse(raw) as { image_key?: string };
    const imageKey = parsed.image_key;
    if (!imageKey) {
      return { content: '[图片]', resources: [] };
    }
    return {
      content: `![image](${imageKey})`,
      resources: [{ type: 'image', fileKey: imageKey }],
    };
  } catch {
    return { content: '[图片]', resources: [] };
  }
};
