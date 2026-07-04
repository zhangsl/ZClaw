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
  description: 'Create a Feishu document.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string', description: 'Optional document content' },
      folder_token: { type: 'string', description: 'Optional parent folder token' },
    },
    required: ['title'],
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
    larkUploadFileTool,
    larkListChatMembersTool,
    larkSendCardTool,
    larkUpdateCardTool,
  ];
}
