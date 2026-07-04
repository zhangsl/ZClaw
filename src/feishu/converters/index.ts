import type { ContentConverterFn } from './types.js';
import { convertText } from './text.js';
import { convertPost } from './post.js';
import { convertImage } from './image.js';
import { convertFile } from './file.js';
import { convertInteractive } from './interactive.js';
import { convertUnknown } from './unknown.js';

export const converters = new Map<string, ContentConverterFn>([
  ['text', convertText],
  ['post', convertPost],
  ['image', convertImage],
  ['file', convertFile],
  ['interactive', convertInteractive],
  ['unknown', convertUnknown],
]);

export { convertText, convertPost, convertImage, convertFile, convertInteractive, convertUnknown };
