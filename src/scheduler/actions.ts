import Anthropic from '@anthropic-ai/sdk';
import type { TaskActionHandler, TaskExecutionContext } from './types.js';
import { sendTextLark } from '../feishu/sender.js';
import { AgentClient } from '../agent/client.js';
import { cleanupOldMedia, getWorkspaceMediaDir } from '../feishu/media.js';

export const actionHandlers = new Map<string, TaskActionHandler>();

export function registerAction(type: string, handler: TaskActionHandler): void {
  actionHandlers.set(type, handler);
}

function getAccount(ctx: TaskExecutionContext, accountId?: string) {
  if (accountId) {
    return ctx.accounts.find((a) => a.accountId === accountId);
  }
  // Default to workspaceId if it matches an account
  return ctx.accounts.find((a) => a.accountId === ctx.workspaceId);
}

const sendMessageAction: TaskActionHandler = async (ctx, payload) => {
  const { chat_id, user_id, text, account_id, reply_to } = payload as {
    chat_id?: string;
    user_id?: string;
    text: string;
    account_id?: string;
    reply_to?: string;
  };

  const to = chat_id ?? user_id;
  if (!to || !text) {
    throw new Error('send_message requires chat_id or user_id and text');
  }

  const account = getAccount(ctx, account_id);
  if (!account) {
    throw new Error(`No account found for workspace ${ctx.workspaceId} or account_id ${account_id}`);
  }

  await sendTextLark({ account, to, text, replyToMessageId: reply_to });
};

const runLarkCliAction: TaskActionHandler = async (ctx, payload) => {
  const { args } = payload as { args: string[] };
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error('run_lark_cli requires args array');
  }
  await ctx.cliRunner.exec(args);
};

const invokeClaudeAction: TaskActionHandler = async (ctx, payload) => {
  const { prompt, system, send_to } = payload as {
    prompt: string;
    system?: string;
    send_to?: { chat_id?: string; user_id?: string; account_id?: string };
  };

  if (!prompt) {
    throw new Error('invoke_claude requires prompt');
  }

  const account = getAccount(ctx, send_to?.account_id);
  const agentCfg = account?.agent;
  const agent = new AgentClient({
    apiKey: ctx.config.env.ANTHROPIC_API_KEY,
    ...(ctx.config.env.ANTHROPIC_BASE_URL ? { baseURL: ctx.config.env.ANTHROPIC_BASE_URL } : {}),
    model: agentCfg?.model ?? ctx.config.env.CLAUDE_MODEL,
    maxTokens: agentCfg?.maxTokens ?? ctx.config.env.CLAUDE_MAX_TOKENS,
  });
  const response = await agent.callClaude({
    messages: [{ role: 'user', content: prompt }],
    ...(system ? { system } : {}),
  });

  const text = (response.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (send_to) {
    const to = send_to.chat_id ?? send_to.user_id;
    if (to) {
      if (!account) {
        throw new Error(`No account found for send_to`);
      }
      await sendTextLark({ account, to, text });
    }
  }
};

const cleanupMediaAction: TaskActionHandler = async (ctx, payload) => {
  const { max_age_days } = payload as { max_age_days?: number };
  const mediaDir = getWorkspaceMediaDir(ctx.config, ctx.workspaceId);
  const maxAgeMs = (max_age_days ?? 7) * 24 * 60 * 60 * 1000;
  cleanupOldMedia(mediaDir, maxAgeMs);
};

registerAction('send_message', sendMessageAction);
registerAction('run_lark_cli', runLarkCliAction);
registerAction('invoke_claude', invokeClaudeAction);
registerAction('cleanup_media', cleanupMediaAction);

export function getActionHandler(type: string): TaskActionHandler | undefined {
  return actionHandlers.get(type);
}
