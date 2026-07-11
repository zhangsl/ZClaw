import type Anthropic from '@anthropic-ai/sdk';
import type { ZClawConfig } from '../config.js';
import type { FeishuAccount } from '../feishu/accounts.js';
import type { MessageContext } from '../feishu/types.js';
import { sendTextLark } from '../feishu/sender.js';
import { AgentClient, type AgentClientOptions } from './client.js';
import * as sessionManager from './session.js';
import type { LarkCliRunner } from '../lark-cli/runner.js';
import { executeLarkTool } from '../lark-cli/tool-executor.js';
import { getLarkTools } from '../lark-cli/tools/index.js';
import { executeSchedulerTool } from '../scheduler/tool-executor.js';
import { getSchedulerTools } from '../scheduler/tools.js';
import { downloadResources, resourceToClaudeBlocks, getWorkspaceMediaDir } from '../feishu/media.js';
import { addReaction, removeReaction } from '../feishu/reactions.js';

export interface DispatcherDeps {
  config: ZClawConfig;
  cliRunner: LarkCliRunner;
}

const DEFAULT_SYSTEM_PROMPT = `You are ZClaw, a helpful AI assistant in Feishu (Lark). Be concise and helpful.
When you need to perform Feishu operations like sending messages, creating documents, uploading files, sending cards, or updating cards, use the available lark_* tools.
When a user asks about scheduled tasks, wants to list them, create a new one, update one, or delete one, use the scheduler_* tools.`;

export class AgentDispatcher {
  private agents = new Map<string, AgentClient>();
  private cliRunner: LarkCliRunner;
  private config: ZClawConfig;

  constructor(deps: DispatcherDeps) {
    this.config = deps.config;
    this.cliRunner = deps.cliRunner;
  }

  private getAgentClient(account: FeishuAccount): AgentClient {
    const cached = this.agents.get(account.accountId);
    if (cached) return cached;

    const agentCfg = account.agent;
    const options: AgentClientOptions = {
      apiKey: this.config.env.ANTHROPIC_API_KEY,
      ...(this.config.env.ANTHROPIC_BASE_URL ? { baseURL: this.config.env.ANTHROPIC_BASE_URL } : {}),
      model: agentCfg?.model ?? this.config.env.CLAUDE_MODEL,
      maxTokens: agentCfg?.maxTokens ?? this.config.env.CLAUDE_MAX_TOKENS,
    };
    const client = new AgentClient(options);
    this.agents.set(account.accountId, client);
    return client;
  }

  private getSystemPrompt(account: FeishuAccount): string {
    return account.agent?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  private getTools(account: FeishuAccount): Anthropic.Messages.Tool[] {
    const allTools = [...getLarkTools(), ...getSchedulerTools()];
    const enabled = account.agent?.enabledTools;
    if (!enabled || enabled.length === 0) return allTools;
    return allTools.filter((tool) => enabled.some((pattern) => matchToolPattern(tool.name, pattern)));
  }

  async dispatch(ctx: MessageContext, account: FeishuAccount): Promise<void> {
    const workspaceId = account.accountId;
    const maxMessages = this.config.env.ZCLAW_SESSION_MAX_MESSAGES;
    const agent = this.getAgentClient(account);

    const { session } = await sessionManager.getOrCreateSession(workspaceId, {
      account,
      chatId: ctx.chatId,
      chatType: ctx.chatType,
      senderId: ctx.senderId,
      threadId: ctx.threadId,
    });

    // Show a typing/ack indicator while processing
    const reactionId = await addReaction(account, ctx.messageId, 'Get');

    try {
      // Build user content blocks (text + downloaded images/documents)
      const userBlocks = await this.buildUserContentBlocks(workspaceId, ctx, account);

      if (userBlocks.length === 1 && userBlocks[0]?.type === 'text') {
        sessionManager.addUserMessage(workspaceId, session.id, userBlocks[0].text);
      } else {
        sessionManager.addUserContentBlocks(workspaceId, session.id, userBlocks);
      }

      const history = sessionManager.loadSessionMessages(workspaceId, session.id, maxMessages);
      const messages = sessionManager.formatMessagesForClaude(history);

      const tools = this.getTools(account);
      const { finalText } = await agent.runWithTools({
        messages,
        tools,
        system: this.getSystemPrompt(account),
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
    } finally {
      await removeReaction(account, ctx.messageId, reactionId);
    }
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
    const agent = this.getAgentClient(params.account);

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

    const tools = this.getTools(params.account);
    const { finalText } = await agent.runWithTools({
      messages,
      tools,
      system: this.getSystemPrompt(params.account),
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
  return { type: 'text', text: DEFAULT_SYSTEM_PROMPT };
}

function matchToolPattern(name: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(name);
  }
  return name === pattern;
}
