import { converters } from './index.js';
import type { ConvertContext, ConvertResult } from './types.js';

export function convertMessageContent(raw: string, messageType: string, ctx: ConvertContext): Promise<ConvertResult> {
  const fn = converters.get(messageType) ?? converters.get('unknown');
  if (!fn) {
    return Promise.resolve({ content: raw, resources: [] });
  }
  return Promise.resolve(fn(raw, ctx));
}

export { convertMessageContent as default };
