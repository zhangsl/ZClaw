import type { LarkCliRunner } from './runner.js';
import { sendCardLark, updateCardLark } from '../feishu/sender.js';
import type { FeishuAccount } from '../feishu/accounts.js';

export interface ToolExecutorContext {
  runner: LarkCliRunner;
  account: FeishuAccount;
}

export async function executeLarkTool(
  ctx: ToolExecutorContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'lark_send_message': {
      const result = await ctx.runner.sendMessage({
        chatId: input.chat_id as string | undefined,
        userId: input.user_id as string | undefined,
        text: input.text as string,
        replyTo: input.reply_to as string | undefined,
      });
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_create_doc': {
      const result = await ctx.runner.createDoc({
        title: input.title as string,
        content: input.content as string | undefined,
        folderToken: input.folder_token as string | undefined,
      });
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_read_doc': {
      const args = [
        'docs',
        '+fetch',
        '--doc',
        input.doc_url_or_token as string,
        '--doc-format',
        (input.format as string) ?? 'markdown',
        '--scope',
        (input.scope as string) ?? 'full',
      ];
      const result = await ctx.runner.exec(args);
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_update_doc': {
      const command = (input.command as string) ?? 'append';
      const args = [
        'docs',
        '+update',
        '--doc',
        input.doc_url_or_token as string,
        '--command',
        command,
        '--content',
        input.content as string,
        '--doc-format',
        'markdown',
      ];
      if (command === 'str_replace' && input.pattern) {
        args.push('--pattern', input.pattern as string);
      }
      const result = await ctx.runner.exec(args);
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_create_sheet': {
      const args = ['sheets', '+create', '--title', input.title as string];
      if (input.headers && Array.isArray(input.headers)) {
        args.push('--headers', JSON.stringify(input.headers));
      }
      if (input.data && Array.isArray(input.data)) {
        args.push('--data', JSON.stringify(input.data));
      }
      if (input.folder_token) {
        args.push('--folder-token', input.folder_token as string);
      }
      const result = await ctx.runner.exec(args);
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_read_sheet': {
      const format = (input.format as string) ?? 'json';
      const spreadsheet = input.spreadsheet_url_or_token as string;
      const isUrl = spreadsheet.startsWith('http://') || spreadsheet.startsWith('https://');
      const args = isUrl
        ? ['sheets', format === 'csv' ? '+csv-get' : '+cells-get', '--url', spreadsheet]
        : ['sheets', format === 'csv' ? '+csv-get' : '+cells-get', '--spreadsheet-token', spreadsheet];
      args.push('--sheet-name', input.sheet_name as string);
      args.push('--range', input.range as string);
      const result = await ctx.runner.exec(args);
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_update_sheet': {
      const spreadsheet = input.spreadsheet_url_or_token as string;
      const isUrl = spreadsheet.startsWith('http://') || spreadsheet.startsWith('https://');
      const args = isUrl
        ? ['sheets', '+cells-set', '--url', spreadsheet]
        : ['sheets', '+cells-set', '--spreadsheet-token', spreadsheet];
      args.push('--sheet-name', input.sheet_name as string);
      args.push('--range', input.range as string);
      args.push('--cells', JSON.stringify(input.values));
      const result = await ctx.runner.exec(args);
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_upload_file': {
      const result = await ctx.runner.uploadFile({
        filePath: input.file_path as string,
        parentFolderToken: input.parent_folder_token as string | undefined,
      });
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_list_chat_members': {
      const result = await ctx.runner.exec(['im', '+chat-members-list', '--chat-id', input.chat_id as string]);
      return JSON.stringify(result.data ?? { ok: true });
    }

    case 'lark_send_card': {
      const card = JSON.parse(input.card_json as string) as Record<string, unknown>;
      const to = (input.chat_id as string | undefined) ?? (input.user_id as string | undefined);
      if (!to) {
        throw new Error('lark_send_card requires chat_id or user_id');
      }
      const result = await sendCardLark({
        account: ctx.account,
        to,
        card,
        replyToMessageId: input.reply_to as string | undefined,
      });
      return JSON.stringify({ ok: true, message_id: result.messageId, chat_id: result.chatId });
    }

    case 'lark_update_card': {
      const card = JSON.parse(input.card_json as string) as Record<string, unknown>;
      await updateCardLark({
        account: ctx.account,
        messageId: input.message_id as string,
        card,
      });
      return JSON.stringify({ ok: true });
    }

    default:
      throw new Error(`Unknown lark tool: ${name}`);
  }
}

// Re-export tool definitions for convenience
export { getLarkTools } from './tools/index.js';
