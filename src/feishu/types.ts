export interface MentionInfo {
  key: string;
  openId: string;
  name: string;
  isBot: boolean;
}

export interface ResourceDescriptor {
  type: 'image' | 'file' | 'audio' | 'video';
  fileKey?: string;
  fileName?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

export interface MessageContext {
  accountId: string;
  chatId: string;
  chatType: 'p2p' | 'group';
  senderId: string;
  senderName?: string;
  messageId: string;
  rootId?: string;
  parentId?: string;
  threadId?: string;
  contentType: string;
  content: string;
  resources: ResourceDescriptor[];
  mentions: MentionInfo[];
  mentionAll: boolean;
  isMentioned: boolean;
  createTime?: number;
  rawMessage: unknown;
  rawSender: unknown;
}

export interface CardActionContext {
  accountId: string;
  openId: string;
  chatId?: string;
  messageId?: string;
  threadId?: string;
  actionValue: Record<string, unknown>;
  formValue?: Record<string, unknown>;
  actionTag?: string;
  actionName?: string;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
}
