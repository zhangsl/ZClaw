import fs from 'node:fs';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { LarkClient } from './client.js';
import type { FeishuAccount } from './accounts.js';
import type { ResourceDescriptor } from './types.js';
import { getWorkspaceMediaDir as resolveWorkspaceMediaDir, SHARED_WORKSPACE_ID } from '../workspace.js';
import type { ZClawConfig } from '../config.js';
import { getDataDir } from '../config.js';

export interface DownloadedResource {
  type: 'image' | 'file';
  fileKey: string;
  fileName?: string;
  buffer: Buffer;
  contentType: string;
  localPath: string;
}

export interface ClaudeResourceBlock {
  type: 'image' | 'document' | 'text';
  block: Anthropic.ContentBlockParam;
}

function extractBufferFromResponse(response: unknown): { buffer: Buffer; contentType?: string } {
  if (Buffer.isBuffer(response)) {
    return { buffer: response };
  }
  if (response instanceof ArrayBuffer) {
    return { buffer: Buffer.from(response) };
  }
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Buffer.isBuffer(obj.data)) return { buffer: obj.data, contentType: obj.contentType as string | undefined };
    if (typeof obj.data === 'string') return { buffer: Buffer.from(obj.data, 'base64'), contentType: obj.contentType as string | undefined };
    if (obj.buffer && Buffer.isBuffer(obj.buffer)) return { buffer: obj.buffer, contentType: obj.contentType as string | undefined };
  }
  throw new Error('Unable to extract buffer from message resource response');
}

export function getWorkspaceMediaDir(config: ZClawConfig, workspaceId: string): string {
  const dataDir = getDataDir(config);
  return resolveWorkspaceMediaDir(dataDir, workspaceId);
}

export function getSharedMediaDir(config: ZClawConfig): string {
  return getWorkspaceMediaDir(config, SHARED_WORKSPACE_ID);
}

export function saveMediaBuffer(
  params: {
    buffer: Buffer;
    contentType?: string;
    fileName?: string;
    mediaDir: string;
    accountId: string;
    messageId: string;
    fileKey: string;
  },
): { localPath: string; contentType: string; fileName: string } {
  const ext = inferExtension(params.contentType, params.fileName);
  const safeMessageId = params.messageId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileKey = params.fileKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(params.mediaDir, params.accountId, safeMessageId);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = params.fileName ? sanitizeFileName(params.fileName) : `${safeFileKey}${ext}`;
  const localPath = path.join(dir, fileName);
  fs.writeFileSync(localPath, params.buffer);

  return {
    localPath,
    contentType: params.contentType ?? 'application/octet-stream',
    fileName,
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function inferExtension(contentType?: string, fileName?: string): string {
  if (fileName) {
    const ext = path.extname(fileName);
    if (ext) return ext;
  }
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/csv': '.csv',
  };
  return map[contentType ?? ''] ?? '';
}

export async function downloadMessageResource(params: {
  account: FeishuAccount;
  messageId: string;
  fileKey: string;
  type: 'image' | 'file';
}): Promise<{ buffer: Buffer; contentType?: string; fileName?: string }> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const response = await client.im.messageResource.get({
    path: { message_id: params.messageId, file_key: params.fileKey },
    params: { type: params.type },
  });
  const { buffer, contentType } = extractBufferFromResponse(response);

  let fileName: string | undefined;
  const resAny = response as { headers?: Record<string, string>; data?: { file_name?: string } } | undefined;
  const disposition = resAny?.headers?.['content-disposition'];
  if (disposition) {
    const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (match?.[1]) fileName = match[1].replace(/['"]/g, '');
  }
  if (!fileName && resAny?.data?.file_name) {
    fileName = resAny.data.file_name;
  }

  return { buffer, contentType, fileName };
}

export async function downloadResources(params: {
  account: FeishuAccount;
  messageId: string;
  resources: ResourceDescriptor[];
  mediaDir: string;
  maxBytes: number;
}): Promise<DownloadedResource[]> {
  const out: DownloadedResource[] = [];
  for (const r of params.resources) {
    if (!r.fileKey || (r.type !== 'image' && r.type !== 'file')) continue;

    const downloaded = await downloadMessageResource({
      account: params.account,
      messageId: params.messageId,
      fileKey: r.fileKey,
      type: r.type,
    });

    if (downloaded.buffer.length > params.maxBytes) {
      throw new Error(`Resource ${r.fileKey} exceeds max size (${params.maxBytes} bytes)`);
    }

    const saved = saveMediaBuffer({
      buffer: downloaded.buffer,
      contentType: downloaded.contentType,
      fileName: downloaded.fileName ?? r.fileName,
      mediaDir: params.mediaDir,
      accountId: params.account.accountId,
      messageId: params.messageId,
      fileKey: r.fileKey,
    });

    out.push({
      type: r.type,
      fileKey: r.fileKey,
      fileName: saved.fileName,
      buffer: downloaded.buffer,
      contentType: saved.contentType,
      localPath: saved.localPath,
    });
  }
  return out;
}

export function resourceToClaudeBlocks(resources: DownloadedResource[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const r of resources) {
    if (r.type === 'image') {
      const mediaType = imageMediaType(r.contentType, r.fileName);
      if (mediaType) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: r.buffer.toString('base64'),
          },
        });
      } else {
        blocks.push({ type: 'text', text: `[Unsupported image type: ${r.contentType}]` });
      }
    } else if (r.type === 'file') {
      const mediaType = documentMediaType(r.contentType, r.fileName);
      if (mediaType === 'application/pdf') {
        blocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: r.buffer.toString('base64'),
          },
        });
      } else if (isTextFile(r.contentType, r.fileName)) {
        const text = r.buffer.toString('utf8');
        blocks.push({ type: 'text', text: `[File: ${r.fileName ?? r.fileKey}]\n${text}` });
      } else {
        blocks.push({ type: 'text', text: `[File: ${r.fileName ?? r.fileKey}] (${r.contentType})` });
      }
    }
  }
  return blocks;
}

function imageMediaType(contentType: string, fileName?: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | undefined {
  const type = contentType.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg' || fileName?.toLowerCase().endsWith('.jpg') || fileName?.toLowerCase().endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (type === 'image/png' || fileName?.toLowerCase().endsWith('.png')) return 'image/png';
  if (type === 'image/gif' || fileName?.toLowerCase().endsWith('.gif')) return 'image/gif';
  if (type === 'image/webp' || fileName?.toLowerCase().endsWith('.webp')) return 'image/webp';
  return undefined;
}

function documentMediaType(contentType: string, fileName?: string): string | undefined {
  const type = contentType.toLowerCase();
  if (type === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  return undefined;
}

function isTextFile(contentType: string, fileName?: string): boolean {
  const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/json'];
  if (textTypes.includes(contentType.toLowerCase())) return true;
  if (fileName) {
    const lower = fileName.toLowerCase();
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.js', '.ts', '.html', '.css'];
    return textExtensions.some((ext) => lower.endsWith(ext));
  }
  return false;
}

export function cleanupOldMedia(mediaDir: string, maxAgeMs: number): void {
  const cutoff = Date.now() - maxAgeMs;

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  }

  if (fs.existsSync(mediaDir)) {
    walk(mediaDir);
  }
}

export function cleanupAllWorkspacesMedia(dataDir: string, workspaceIds: string[], maxAgeMs: number): void {
  for (const workspaceId of workspaceIds) {
    const mediaDir = resolveWorkspaceMediaDir(dataDir, workspaceId);
    cleanupOldMedia(mediaDir, maxAgeMs);
  }
}
