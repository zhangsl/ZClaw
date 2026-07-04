import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../db/messages.js';
import * as messagesDb from '../db/messages.js';
import * as sessionsDb from '../db/sessions.js';
import type { FeishuAccount } from '../feishu/accounts.js';

export interface SessionContext {
  session: sessionsDb.Session;
  account: FeishuAccount;
}

export interface FormattedMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlockParam[];
}

export async function getOrCreateSession(workspaceId: string, params: {
  account: FeishuAccount;
  chatId: string;
  chatType: 'p2p' | 'group';
  senderId: string;
  threadId?: string;
}): Promise<SessionContext> {
  const { session } = sessionsDb.getOrCreateSession(workspaceId, {
    accountId: params.account.accountId,
    chatId: params.chatId,
    chatType: params.chatType,
    senderId: params.senderId,
    threadId: params.threadId,
  });
  return { session, account: params.account };
}

export function addUserMessage(workspaceId: string, sessionId: string, content: string): Message {
  return messagesDb.insertMessage(workspaceId, { sessionId, role: 'user', content });
}

export function addUserContentBlocks(workspaceId: string, sessionId: string, blocks: Anthropic.ContentBlockParam[]): Message {
  return messagesDb.insertMessage(workspaceId, { sessionId, role: 'user', content: JSON.stringify(blocks) });
}

export function addAssistantMessage(workspaceId: string, sessionId: string, content: string): Message {
  return messagesDb.insertMessage(workspaceId, { sessionId, role: 'assistant', content });
}

export function addToolResultMessage(workspaceId: string, sessionId: string, content: string): Message {
  return messagesDb.insertMessage(workspaceId, { sessionId, role: 'tool', content });
}

export function loadSessionMessages(workspaceId: string, sessionId: string, limit?: number): Message[] {
  return messagesDb.listMessages(workspaceId, sessionId, limit);
}

export function trimSessionMessages(workspaceId: string, sessionId: string, maxMessages: number): void {
  messagesDb.deleteOldMessages(workspaceId, sessionId, maxMessages);
}

export function formatMessagesForClaude(messages: Message[]): Anthropic.Messages.MessageParam[] {
  return messages.map((m) => {
    if (m.role === 'user') {
      return { role: 'user', content: tryParseContent(m.content) };
    }
    if (m.role === 'assistant') {
      return { role: 'assistant', content: tryParseContent(m.content) };
    }
    // tool role stored as plain text result
    return { role: 'user', content: tryParseContent(m.content) };
  });
}

function tryParseContent(content: string): string | Anthropic.ContentBlockParam[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Anthropic.ContentBlockParam[];
  } catch {
    // fall through to string
  }
  return content;
}

export function buildContextWithResources(
  text: string,
  resources: Array<{ type: string; fileKey?: string; fileName?: string }>,
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [{ type: 'text', text }];
  for (const r of resources) {
    if (r.type === 'image' && r.fileKey) {
      blocks.push({ type: 'text', text: `[image:${r.fileKey}]` });
    } else if (r.type === 'file' && r.fileKey) {
      blocks.push({ type: 'text', text: `[file:${r.fileName ?? r.fileKey}]` });
    }
  }
  return blocks;
}
