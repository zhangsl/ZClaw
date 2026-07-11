import Anthropic from '@anthropic-ai/sdk';

export interface ToolExecutor {
  execute: (name: string, input: Record<string, unknown>) => Promise<string>;
}

export interface AgentClientOptions {
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens: number;
}

export class AgentClient {
  private anthropic: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(options: AgentClientOptions) {
    this.anthropic = new Anthropic({
      apiKey: options.apiKey,
      ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    });
    this.model = options.model;
    this.maxTokens = options.maxTokens;
  }

  async callClaude(params: {
    messages: Anthropic.Messages.MessageParam[];
    tools?: Anthropic.Messages.Tool[];
    system?: string | Anthropic.TextBlockParam[];
  }): Promise<Anthropic.Messages.Message> {
    const message = await this.anthropic.messages.create(
      {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: params.messages,
        tools: params.tools,
        ...(params.system ? { system: params.system } : {}),
      },
      { timeout: 120000 }, // 2 minutes, avoid SDK non-streaming timeout error
    );

    if (!Array.isArray(message.content)) {
      throw new Error(`Claude returned unexpected content: ${JSON.stringify(message.content)}`);
    }

    return message;
  }

  async runWithTools(params: {
    messages: Anthropic.Messages.MessageParam[];
    tools: Anthropic.Messages.Tool[];
    toolExecutor: ToolExecutor;
    system?: string | Anthropic.TextBlockParam[];
    maxSteps?: number;
  }): Promise<{ finalText: string; toolCalls: Anthropic.ToolUseBlock[] }> {
    const { messages, tools, toolExecutor, system, maxSteps = 10 } = params;
    const allToolCalls: Anthropic.ToolUseBlock[] = [];

    let currentMessages = [...messages];
    for (let step = 0; step < maxSteps; step++) {
      const response = await this.callClaude({ messages: currentMessages, tools, system });

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

      if (toolUseBlocks.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        return { finalText: text, toolCalls: allToolCalls };
      }

      currentMessages.push({
        role: 'assistant',
        content: response.content,
      });
      allToolCalls.push(...toolUseBlocks);

      for (const tool of toolUseBlocks) {
        const resultText = await toolExecutor.execute(tool.name, tool.input as Record<string, unknown>);
        currentMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: tool.id,
              content: resultText,
            },
          ],
        });
      }
    }

    throw new Error(`Tool use loop exceeded max steps (${maxSteps})`);
  }
}
