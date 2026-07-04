import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resourceToClaudeBlocks, saveMediaBuffer, cleanupOldMedia } from '../src/feishu/media.js';

describe('media', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zclaw-media-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('converts image resource to Claude image block', () => {
    const buffer = Buffer.from('fake-image');
    const resources = [
      {
        type: 'image' as const,
        fileKey: 'img_v3_xxx',
        fileName: 'photo.png',
        buffer,
        contentType: 'image/png',
        localPath: path.join(tempDir, 'photo.png'),
      },
    ];
    const blocks = resourceToClaudeBlocks(resources);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: buffer.toString('base64'),
      },
    });
  });

  it('converts PDF resource to Claude document block', () => {
    const buffer = Buffer.from('fake-pdf');
    const resources = [
      {
        type: 'file' as const,
        fileKey: 'box_xxx',
        fileName: 'report.pdf',
        buffer,
        contentType: 'application/pdf',
        localPath: path.join(tempDir, 'report.pdf'),
      },
    ];
    const blocks = resourceToClaudeBlocks(resources);
    expect(blocks[0]).toMatchObject({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: buffer.toString('base64'),
      },
    });
  });

  it('converts text file resource to text block', () => {
    const buffer = Buffer.from('hello world');
    const resources = [
      {
        type: 'file' as const,
        fileKey: 'box_xxx',
        fileName: 'notes.txt',
        buffer,
        contentType: 'text/plain',
        localPath: path.join(tempDir, 'notes.txt'),
      },
    ];
    const blocks = resourceToClaudeBlocks(resources);
    expect(blocks[0]).toMatchObject({
      type: 'text',
      text: '[File: notes.txt]\nhello world',
    });
  });

  it('saves media buffer to disk', () => {
    const buffer = Buffer.from('test');
    const result = saveMediaBuffer({
      buffer,
      contentType: 'image/png',
      fileName: 'test.png',
      mediaDir: tempDir,
      accountId: 'default',
      messageId: 'om_test',
      fileKey: 'img_v3_xxx',
    });
    expect(fs.existsSync(result.localPath)).toBe(true);
    expect(result.contentType).toBe('image/png');
  });

  it('cleans up old media files', () => {
    const mediaDir = path.join(tempDir, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const oldFile = path.join(mediaDir, 'old.txt');
    const newFile = path.join(mediaDir, 'new.txt');
    fs.writeFileSync(oldFile, 'old');
    fs.writeFileSync(newFile, 'new');

    const oldTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, oldTime, oldTime);

    cleanupOldMedia(tempDir, 24 * 60 * 60 * 1000);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });
});
