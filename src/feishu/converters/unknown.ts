import type { ContentConverterFn } from './types.js';

export const convertUnknown: ContentConverterFn = (raw) => {
  return { content: raw, resources: [] };
};
