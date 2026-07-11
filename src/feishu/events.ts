import type { FeishuAccount } from './accounts.js';
import { LarkClient } from './client.js';
import type { CardActionContext, MessageContext } from './types.js';
import type { GateConfig } from './gate.js';
import { parseMessageEvent, type FeishuMessageEvent } from './parser.js';
import { checkMessageGate } from './gate.js';
import { info, warn, error } from '../utils/logger.js';

export interface EventHandlerCallbacks {
  onMessage: (ctx: MessageContext, account: FeishuAccount) => Promise<void>;
  onCardAction?: (ctx: CardActionContext, account: FeishuAccount) => Promise<void>;
  gateConfig?: GateConfig;
}

interface FeishuCardActionEvent {
  operator?: {
    open_id?: string;
  };
  open_chat_id?: string;
  open_message_id?: string;
  open_thread_id?: string;
  context?: {
    open_chat_id?: string;
    open_message_id?: string;
    open_thread_id?: string;
  };
  action?: {
    tag?: string;
    name?: string;
    value?: Record<string, unknown>;
    form_value?: Record<string, unknown>;
  };
}

export function parseCardActionEvent(data: unknown): CardActionContext | undefined {
  const ev = data as FeishuCardActionEvent;
  const action = ev.action;
  if (!action) return undefined;

  const openId = ev.operator?.open_id ?? '';
  if (!openId) return undefined;

  const chatId = ev.open_chat_id ?? ev.context?.open_chat_id;
  const messageId = ev.open_message_id ?? ev.context?.open_message_id;
  const threadId = ev.open_thread_id ?? ev.context?.open_thread_id;

  return {
    accountId: '',
    openId,
    chatId,
    messageId,
    threadId,
    actionValue: action.value ?? {},
    formValue: action.form_value,
    actionTag: action.tag,
    actionName: action.name,
  };
}

export async function startAccountMonitor(
  account: FeishuAccount,
  callbacks: EventHandlerCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  const client = LarkClient.fromAccount(account);
  const botInfo = await client.probe();
  const botOpenId = botInfo?.openId;

  await client.startWS(
    {
      'im.message.receive_v1': async (data: unknown) => {
        const event = data as FeishuMessageEvent;
        try {
          const ctx = await parseMessageEvent(event, account.accountId, botOpenId);
          const gate = checkMessageGate(ctx, callbacks.gateConfig ?? {});
          if (!gate.allowed) {
            info(`Message gated: ${gate.reason}`, `events:${account.accountId}`, { chatId: ctx.chatId, senderId: ctx.senderId });
            return;
          }
          await callbacks.onMessage(ctx, account);
        } catch (err) {
          error(`Failed to handle message`, `events:${account.accountId}`, { error: err instanceof Error ? err.message : String(err) });
        }
      },
      'card.action.trigger': async (data: unknown) => {
        if (!callbacks.onCardAction) return;
        const ctx = parseCardActionEvent(data);
        if (!ctx) {
          warn('Invalid card action event', `events:${account.accountId}`);
          return;
        }
        ctx.accountId = account.accountId;
        try {
          await callbacks.onCardAction(ctx, account);
        } catch (err) {
          error('Failed to handle card action', `events:${account.accountId}`, { error: err instanceof Error ? err.message : String(err) });
        }
      },
      'im.message.reaction.created_v1': async () => {
        // TODO: handle reactions if needed
      },
      'im.chat.member.bot.added_v1': async () => {
        // TODO: welcome message
      },
      'im.chat.member.bot.deleted_v1': async () => {
        // ignore
      },
      'im.message.message_read_v1': async () => {
        // ignore
      },
    },
    abortSignal,
  );
}

export async function startAllMonitors(
  accounts: FeishuAccount[],
  callbacks: EventHandlerCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  if (accounts.length === 0) {
    throw new Error('No enabled Feishu accounts configured');
  }
  await Promise.all(accounts.map((account) => startAccountMonitor(account, callbacks, abortSignal)));
}
