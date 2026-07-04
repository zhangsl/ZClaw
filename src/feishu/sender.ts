import type { Readable } from 'node:stream';
import type * as Lark from '@larksuiteoapi/node-sdk';
import { LarkClient } from './client.js';
import type { FeishuAccount } from './accounts.js';

export interface SendResult {
  messageId: string;
  chatId: string;
}

function resolveReceiveIdType(target: string): string {
  if (target.startsWith('oc_')) return 'chat_id';
  if (target.startsWith('ou_')) return 'open_id';
  if (target.startsWith('uc_')) return 'user_id';
  return 'open_id';
}

function normalizeMessageId(messageId: string): string {
  return messageId.replace(/^\/?(om_[a-zA-Z0-9]+)\/?.*$/, '$1');
}

export function detectCardJson(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return undefined;
    const obj = parsed as Record<string, unknown>;

    if (obj.schema === '2.0') return obj; // CardKit v2
    if (Array.isArray(obj.elements) && (obj.config !== undefined || obj.header !== undefined)) return obj; // v1
    if (obj.msg_type === 'interactive' && typeof obj.card === 'object' && obj.card != null) {
      return obj.card as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function buildPostContent(text: string): string {
  return JSON.stringify({
    zh_cn: {
      content: [[{ tag: 'md', text: text }]],
    },
  });
}

interface SendImMessageParams {
  client: Lark.Client;
  to: string;
  content: string;
  msgType: 'post' | 'interactive' | 'image' | 'file';
  replyToMessageId?: string;
  replyInThread?: boolean;
}

async function sendImMessage(params: SendImMessageParams): Promise<SendResult> {
  const { client, to, content, msgType, replyToMessageId, replyInThread } = params;

  if (replyToMessageId) {
    const response = await client.im.message.reply({
      path: { message_id: normalizeMessageId(replyToMessageId) },
      data: { content, msg_type: msgType, reply_in_thread: replyInThread },
    });
    return {
      messageId: (response?.data?.message_id as string) ?? '',
      chatId: (response?.data?.chat_id as string) ?? '',
    };
  }

  const receiveIdType = resolveReceiveIdType(to);
  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType as 'chat_id' | 'open_id' | 'user_id' },
    data: { receive_id: to, msg_type: msgType, content },
  });
  return {
    messageId: (response?.data?.message_id as string) ?? '',
    chatId: (response?.data?.chat_id as string) ?? '',
  };
}

export async function sendTextLark(params: {
  account: FeishuAccount;
  to: string;
  text: string;
  replyToMessageId?: string;
  replyInThread?: boolean;
}): Promise<SendResult> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const card = detectCardJson(params.text);
  if (card) {
    return sendCardLark({ ...params, card });
  }
  const content = buildPostContent(params.text);
  return sendImMessage({
    client,
    to: params.to,
    content,
    msgType: 'post',
    replyToMessageId: params.replyToMessageId,
    replyInThread: params.replyInThread,
  });
}

export async function sendCardLark(params: {
  account: FeishuAccount;
  to: string;
  card: Record<string, unknown>;
  replyToMessageId?: string;
  replyInThread?: boolean;
}): Promise<SendResult> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const content = JSON.stringify(params.card);
  return sendImMessage({
    client,
    to: params.to,
    content,
    msgType: 'interactive',
    replyToMessageId: params.replyToMessageId,
    replyInThread: params.replyInThread,
  });
}

export async function uploadImageLark(params: {
  account: FeishuAccount;
  image: Buffer | Readable;
  imageType?: 'message' | 'avatar';
}): Promise<{ imageKey: string }> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const response = (await client.im.image.create({
    data: { image_type: params.imageType ?? 'message', image: params.image as unknown as Buffer },
  })) as { data?: { image_key?: string }; image_key?: string };
  const imageKey = response.data?.image_key ?? response.image_key;
  if (!imageKey) {
    throw new Error('Image upload failed: no image_key in response');
  }
  return { imageKey };
}

export async function uploadFileLark(params: {
  account: FeishuAccount;
  file: Buffer | Readable;
  fileName: string;
  fileType: 'opus' | 'mp4' | 'pdf' | 'doc' | 'xls' | 'ppt' | 'stream';
  duration?: number;
}): Promise<{ fileKey: string }> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const data: Record<string, unknown> = {
    file_type: params.fileType,
    file_name: params.fileName,
    file: params.file as unknown as Buffer,
  };
  if (params.duration !== undefined) {
    data.duration = String(params.duration);
  }
  const response = (await client.im.file.create({ data: data as never })) as {
    data?: { file_key?: string };
    file_key?: string;
  };
  const fileKey = response.data?.file_key ?? response.file_key;
  if (!fileKey) {
    throw new Error(`File upload failed: no file_key in response for "${params.fileName}"`);
  }
  return { fileKey };
}

export async function sendImageLark(params: {
  account: FeishuAccount;
  to: string;
  imageKey: string;
  replyToMessageId?: string;
  replyInThread?: boolean;
}): Promise<SendResult> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const content = JSON.stringify({ image_key: params.imageKey });
  return sendImMessage({
    client,
    to: params.to,
    content,
    msgType: 'image',
    replyToMessageId: params.replyToMessageId,
    replyInThread: params.replyInThread,
  });
}

export async function sendFileLark(params: {
  account: FeishuAccount;
  to: string;
  fileKey: string;
  replyToMessageId?: string;
  replyInThread?: boolean;
}): Promise<SendResult> {
  const client = LarkClient.fromAccount(params.account).sdk;
  const content = JSON.stringify({ file_key: params.fileKey });
  return sendImMessage({
    client,
    to: params.to,
    content,
    msgType: 'file',
    replyToMessageId: params.replyToMessageId,
    replyInThread: params.replyInThread,
  });
}

export async function updateCardLark(params: {
  account: FeishuAccount;
  messageId: string;
  card: Record<string, unknown>;
}): Promise<void> {
  const client = LarkClient.fromAccount(params.account).sdk;
  await client.im.message.patch({
    path: { message_id: normalizeMessageId(params.messageId) },
    data: { content: JSON.stringify(params.card) },
  });
}
