import { describe, it, expect } from 'vitest';
import { convertText } from '../src/feishu/converters/text.js';
import { convertPost } from '../src/feishu/converters/post.js';
import { convertImage } from '../src/feishu/converters/image.js';
import { convertFile } from '../src/feishu/converters/file.js';
import type { ConvertContext } from '../src/feishu/converters/types.js';

const baseCtx: ConvertContext = {
  mentions: new Map(),
  mentionsByOpenId: new Map(),
  messageId: 'om_test',
  stripBotMentions: true,
};

describe('converters', () => {
  it('converts text message', async () => {
    const result = await convertText('{"text":"hello world"}', baseCtx);
    expect(result.content).toBe('hello world');
    expect(result.resources).toHaveLength(0);
  });

  it('converts text message fallback', async () => {
    const result = await convertText('plain text', baseCtx);
    expect(result.content).toBe('plain text');
  });

  it('converts post message', async () => {
    const raw = JSON.stringify({
      zh_cn: {
        content: [[{ tag: 'text', text: 'hello ' }, { tag: 'text', text: 'world' }]],
      },
    });
    const result = await convertPost(raw, baseCtx);
    expect(result.content).toBe('hello world');
  });

  it('converts image message', async () => {
    const result = await convertImage('{"image_key":"img_v3_xxx"}', baseCtx);
    expect(result.content).toBe('![image](img_v3_xxx)');
    expect(result.resources).toEqual([{ type: 'image', fileKey: 'img_v3_xxx' }]);
  });

  it('converts file message', async () => {
    const result = await convertFile('{"file_key":"box_xxx","file_name":"report.pdf"}', baseCtx);
    expect(result.content).toBe('<file key="box_xxx" name="report.pdf"/>');
    expect(result.resources).toEqual([{ type: 'file', fileKey: 'box_xxx', fileName: 'report.pdf' }]);
  });
});
