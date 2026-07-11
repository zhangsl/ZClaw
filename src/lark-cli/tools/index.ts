import type Anthropic from '@anthropic-ai/sdk';

export const larkSendMessageTool: Anthropic.Messages.Tool = {
  name: 'lark_send_message',
  description: 'Send a message to a Feishu chat or user. Provide either chat_id or user_id, not both.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'Feishu chat ID (oc_xxx)' },
      user_id: { type: 'string', description: 'Feishu user open_id (ou_xxx)' },
      text: { type: 'string' },
      reply_to: { type: 'string', description: 'Optional message ID to reply to' },
    },
    required: ['text'],
  },
};

export const larkCreateDocTool: Anthropic.Messages.Tool = {
  name: 'lark_create_doc',
  description: 'Create a Feishu document. Content can be provided as Markdown.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string', description: 'Optional document content in Markdown' },
      folder_token: { type: 'string', description: 'Optional parent folder token' },
    },
    required: ['title'],
  },
};

export const larkReadDocTool: Anthropic.Messages.Tool = {
  name: 'lark_read_doc',
  description: 'Read the content of a Feishu document by URL or document token.',
  input_schema: {
    type: 'object',
    properties: {
      doc_url_or_token: { type: 'string', description: 'Feishu document URL or document token' },
      format: { type: 'string', enum: ['markdown', 'xml'], description: 'Output format' },
      scope: { type: 'string', enum: ['full', 'outline'], description: 'Read scope' },
    },
    required: ['doc_url_or_token'],
  },
};

export const larkUpdateDocTool: Anthropic.Messages.Tool = {
  name: 'lark_update_doc',
  description: 'Update a Feishu document. Supports append, overwrite, or str_replace.',
  input_schema: {
    type: 'object',
    properties: {
      doc_url_or_token: { type: 'string', description: 'Feishu document URL or document token' },
      command: {
        type: 'string',
        enum: ['append', 'overwrite', 'str_replace'],
        description: 'Update command',
      },
      content: { type: 'string', description: 'New content in Markdown' },
      pattern: { type: 'string', description: 'Text to match for str_replace command' },
    },
    required: ['doc_url_or_token', 'command', 'content'],
  },
};

export const larkCreateSheetTool: Anthropic.Messages.Tool = {
  name: 'lark_create_sheet',
  description: 'Create a Feishu spreadsheet with optional headers and initial data.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      headers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional header row as JSON array',
      },
      data: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
        description: 'Optional initial data as JSON 2D array of strings',
      },
      folder_token: { type: 'string', description: 'Optional parent folder token' },
    },
    required: ['title'],
  },
};

export const larkReadSheetTool: Anthropic.Messages.Tool = {
  name: 'lark_read_sheet',
  description: 'Read a range of cells from a Feishu spreadsheet.',
  input_schema: {
    type: 'object',
    properties: {
      spreadsheet_url_or_token: { type: 'string', description: 'Spreadsheet URL or token' },
      sheet_name: { type: 'string', description: 'Sheet name, e.g. Sheet1' },
      range: { type: 'string', description: 'Cell range in A1 notation, e.g. A1:C10' },
      format: { type: 'string', enum: ['json', 'csv'], description: 'Output format' },
    },
    required: ['spreadsheet_url_or_token', 'sheet_name', 'range'],
  },
};

export const larkUpdateSheetTool: Anthropic.Messages.Tool = {
  name: 'lark_update_sheet',
  description: 'Write values to a range of cells in a Feishu spreadsheet.',
  input_schema: {
    type: 'object',
    properties: {
      spreadsheet_url_or_token: { type: 'string', description: 'Spreadsheet URL or token' },
      sheet_name: { type: 'string', description: 'Sheet name, e.g. Sheet1' },
      range: { type: 'string', description: 'Cell range in A1 notation, e.g. A1:C10' },
      values: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
        description: '2D array of strings to write',
      },
    },
    required: ['spreadsheet_url_or_token', 'sheet_name', 'range', 'values'],
  },
};

export const larkUploadFileTool: Anthropic.Messages.Tool = {
  name: 'lark_upload_file',
  description: 'Upload a local file to Feishu Drive.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute or relative path to the file' },
      parent_folder_token: { type: 'string', description: 'Optional parent folder token' },
    },
    required: ['file_path'],
  },
};

export const larkListChatMembersTool: Anthropic.Messages.Tool = {
  name: 'lark_list_chat_members',
  description: 'List members of a Feishu chat.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'Feishu chat ID (oc_xxx)' },
    },
    required: ['chat_id'],
  },
};

export const larkSendCardTool: Anthropic.Messages.Tool = {
  name: 'lark_send_card',
  description: 'Send an interactive card to a Feishu chat. card_json must be a valid Feishu CardKit v1 or v2 JSON object.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'Feishu chat ID (oc_xxx)' },
      user_id: { type: 'string', description: 'Feishu user open_id (ou_xxx)' },
      card_json: { type: 'string', description: 'JSON string of the interactive card' },
      reply_to: { type: 'string', description: 'Optional message ID to reply to' },
    },
    required: ['card_json'],
  },
};

export const larkUpdateCardTool: Anthropic.Messages.Tool = {
  name: 'lark_update_card',
  description: 'Update an existing interactive card message by message_id.',
  input_schema: {
    type: 'object',
    properties: {
      message_id: { type: 'string', description: 'Feishu message ID (om_xxx) of the card to update' },
      card_json: { type: 'string', description: 'JSON string of the new card content' },
    },
    required: ['message_id', 'card_json'],
  },
};

export function getLarkTools(): Anthropic.Messages.Tool[] {
  return [
    larkSendMessageTool,
    larkCreateDocTool,
    larkReadDocTool,
    larkUpdateDocTool,
    larkCreateSheetTool,
    larkReadSheetTool,
    larkUpdateSheetTool,
    larkUploadFileTool,
    larkListChatMembersTool,
    larkSendCardTool,
    larkUpdateCardTool,
  ];
}
