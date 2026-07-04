import type Anthropic from '@anthropic-ai/sdk';
import type { ZClawConfig } from '../config.js';
import type { FeishuAccount } from '../feishu/accounts.js';
import type { MessageContext } from '../feishu/types.js';
import { sendTextLark } from '../feishu/sender.js';
import { AgentClient } from './client.js';
import * as sessionManager from './session.js';
import type { LarkCliRunner } from '../lark-cli/runner.js';
import { executeLarkTool } from '../lark-cli/tool-executor.js';
import { getLarkTools } from '../lark-cli/tools/index.js';
import { executeSchedulerTool } from '../scheduler/tool-executor.js';
import { getSchedulerTools } from '../scheduler/tools.js';
import { downloadResources, resourceToClaudeBlocks, getWorkspaceMediaDir } from '../feishu/media.js';

export interface DispatcherDeps {
  config: ZClawConfig;
  cliRunner: LarkCliRunner;
}

const SYSTEM_PROMPT = `You are ZClaw, a helpful AI assistant in Feishu (Lark). Be concise and helpful.
When you need to perform Feishu operations like sending messages, creating documents, uploading files, sending cards, or updating cards, use the available lark_* tools.
When a user asks about scheduled tasks, wants to list them, create a new one, update one, or delete one, use the scheduler_* tools.`;

export class AgentDispatcher {
  private agent: AgentClient;
  private cliRunner: LarkCliRunner;
  private config: ZClawConfig;

  constructor(deps: DispatcherDeps) {
    this.config = deps.config;
    this.agent = new AgentClient(deps.config);
    this.cliRunner = deps.cliRunner;
  }

  async dispatch(ctx: MessageContext, account: FeishuAccount): Promise<void> {
    const workspaceId = account.accountId;
    const maxMessages = this.config.env.ZCLAW_SESSION_MAX_MESSAGES;

    const { session } = await sessionManager.getOrCreateSession(workspaceId, {
      account,
      chatId: ctx.chatId,
      chatType: ctx.chatType,
      senderId: ctx.senderId,
      threadId: ctx.threadId,
    });

    // Build user content blocks (text + downloaded images/documents)
    const userBlocks = await this.buildUserContentBlocks(workspaceId, ctx, account);

    if (userBlocks.length === 1 && userBlocks[0]?.type === 'text') {
      sessionManager.addUserMessage(workspaceId, session.id, userBlocks[0].text);
    } else {
      sessionManager.addUserContentBlocks(workspaceId, session.id, userBlocks);
    }

    const history = sessionManager.loadSessionMessages(workspaceId, session.id, maxMessages);
    const messages = sessionManager.formatMessagesForClaude(history);

    const tools = [...getLarkTools(), ...getSchedulerTools()];
    const { finalText } = await this.agent.runWithTools({
      messages,
      tools,
      system: SYSTEM_PROMPT,
      toolExecutor: {
        execute: async (name, input) => {
          if (name.startsWith('scheduler_')) {
            return executeSchedulerTool(workspaceId, name, input);
          }
          return executeLarkTool({ runner: this.cliRunner, account }, name, input);
        },
      },
    });

    sessionManager.addAssistantMessage(workspaceId, session.id, finalText);
    sessionManager.trimSessionMessages(workspaceId, session.id, maxMessages);

    await sendTextLark({
      account,
      to: ctx.chatId,
      text: finalText,
      replyToMessageId: ctx.messageId,
      replyInThread: Boolean(ctx.threadId),
    });
  }

  async dispatchCardAction(params: {
    account: FeishuAccount;
    chatId: string;
    senderId: string;
    messageId: string;
    actionValue: Record<string, unknown>;
    formValue?: Record<string, unknown>;
    threadId?: string;
  }): Promise<void> {
    const workspaceId = params.account.accountId;
    const maxMessages = this.config.env.ZCLAW_SESSION_MAX_MESSAGES;

    const { session } = await sessionManager.getOrCreateSession(workspaceId, {
      account: params.account,
      chatId: params.chatId,
      chatType: 'group',
      senderId: params.senderId,
      threadId: params.threadId,
    });

    const actionText = JSON.stringify({ action: params.actionValue, form: params.formValue });
    const syntheticText = `用户点击了卡片按钮: ${actionText}`;
    sessionManager.addUserMessage(workspaceId, session.id, syntheticText);

    const history = sessionManager.loadSessionMessages(workspaceId, session.id, maxMessages);
    const messages = sessionManager.formatMessagesForClaude(history);

    const tools = [...getLarkTools(), ...getSchedulerTools()];
    const { finalText } = await this.agent.runWithTools({
      messages,
      tools,
      system: SYSTEM_PROMPT,
      toolExecutor: {
        execute: async (name, input) => {
          if (name.startsWith('scheduler_')) {
            return executeSchedulerTool(workspaceId, name, input);
          }
          return executeLarkTool({ runner: this.cliRunner, account: params.account }, name, input);
        },
      },
    });

    sessionManager.addAssistantMessage(workspaceId, session.id, finalText);
    sessionManager.trimSessionMessages(workspaceId, session.id, maxMessages);

    await sendTextLark({
      account: params.account,
      to: params.chatId,
      text: finalText,
      replyToMessageId: params.messageId,
      replyInThread: Boolean(params.threadId),
    });
  }

  private async buildUserContentBlocks(
    workspaceId: string,
    ctx: MessageContext,
    account: FeishuAccount,
  ): Promise<Anthropic.ContentBlockParam[]> {
    const textBlock: Anthropic.TextBlockParam = { type: 'text', text: ctx.content };

    if (ctx.resources.length === 0) {
      return [textBlock];
    }

    const mediaDir = getWorkspaceMediaDir(this.config, workspaceId);
    const maxBytes = this.config.env.ZCLAW_MEDIA_MAX_MB * 1024 * 1024;

    try {
      const downloaded = await downloadResources({
        account,
        messageId: ctx.messageId,
        resources: ctx.resources,
        mediaDir,
        maxBytes,
      });
      const mediaBlocks = resourceToClaudeBlocks(downloaded);
      return [textBlock, ...mediaBlocks];
    } catch (err) {
      const errorText = `[Failed to download media: ${err instanceof Error ? err.message : String(err)}]`;
      return [textBlock, { type: 'text', text: errorText }];
    }
  }
}

export function buildSystemPrompt(): Anthropic.TextBlockParam {
  return { type: 'text', text: SYSTEM_PROMPT };
}
