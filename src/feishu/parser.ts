import type { MessageContext } from './types.js';
import { convertMessageContent } from './converters/content-converter.js';
import { extractMentions, isBotMentioned, stripBotMentions } from './mention.js';

export interface FeishuMessageEvent {
  header?: {
    event_id?: string;
    event_type?: string;
    app_id?: string;
    create_time?: string;
  };
  // v1 event format (nested under event)
  event?: {
    message?: {
      message_id: string;
      chat_id: string;
      chat_type: 'p2p' | 'group';
      message_type: string;
      content: string;
      mentions?: Array<{
        key: string;
        id?: { open_id?: string };
        name?: string;
      }>;
      root_id?: string;
      parent_id?: string;
      thread_id?: string;
      create_time?: string;
    };
    sender?: {
      sender_id?: {
        open_id?: string;
        union_id?: string;
        user_id?: string;
      };
      sender_type?: string;
      tenant_key?: string;
    };
  };
  // v2 event format (flat, used by WebSocket)
  message?: {
    message_id: string;
    chat_id: string;
    chat_type: 'p2p' | 'group';
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id?: { open_id?: string };
      name?: string;
    }>;
    root_id?: string;
    parent_id?: string;
    thread_id?: string;
    create_time?: string;
  };
  sender?: {
    sender_id?: {
      open_id?: string;
      union_id?: string;
      user_id?: string;
    };
    sender_type?: string;
    tenant_key?: string;
  };
}

export async function parseMessageEvent(
  event: FeishuMessageEvent,
  accountId: string,
  botOpenId?: string,
): Promise<MessageContext> {
  const msg = event.event?.message ?? event.message;
  if (!msg) {
    console.error('[parser] Missing message. Full event:', JSON.stringify(event).slice(0, 500));
    throw new Error('Missing message in Feishu event');
  }

  const sender = event.event?.sender ?? event.sender;

  const mentions = extractMentions(msg.mentions, botOpenId);
  const mentionAll = mentions.some((m) => m.openId === '');
  const isMentioned = isBotMentioned(mentions) || mentionAll;

  const convertCtx = {
    mentions: new Map(mentions.map((m) => [m.key, m])),
    mentionsByOpenId: new Map(mentions.map((m) => [m.openId, m])),
    messageId: msg.message_id,
    botOpenId,
    stripBotMentions: true,
  };

  const { content, resources } = await convertMessageContent(msg.content, msg.message_type, convertCtx);
  const cleanContent = isMentioned ? stripBotMentions(content, mentions) : content;

  const createTimeStr = msg.create_time;
  const createTime = createTimeStr ? parseInt(createTimeStr, 10) : undefined;

  return {
    accountId,
    chatId: msg.chat_id,
    chatType: msg.chat_type,
    senderId: sender?.sender_id?.open_id ?? '',
    messageId: msg.message_id,
    rootId: msg.root_id,
    parentId: msg.parent_id,
    threadId: msg.thread_id,
    contentType: msg.message_type,
    content: cleanContent,
    resources,
    mentions,
    mentionAll,
    isMentioned,
    createTime: Number.isNaN(createTime) ? undefined : createTime,
    rawMessage: msg,
    rawSender: sender,
  };
}
