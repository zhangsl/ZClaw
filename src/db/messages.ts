import { randomUUID } from 'node:crypto';
import { getDb } from './connection.js';

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: string;
  toolResult?: string;
  createdAt: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  tool_result: string | null;
  created_at: string;
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant' | 'tool',
    content: row.content,
    toolCalls: row.tool_calls ?? undefined,
    toolResult: row.tool_result ?? undefined,
    createdAt: row.created_at,
  };
}

export function insertMessage(workspaceId: string, message: Omit<Message, 'id' | 'createdAt'>): Message {
  const db = getDb(workspaceId);
  const now = new Date().toISOString();
  const full: Message = {
    ...message,
    id: randomUUID(),
    createdAt: now,
  };

  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, tool_calls, tool_result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    full.id,
    full.sessionId,
    full.role,
    full.content,
    full.toolCalls ?? null,
    full.toolResult ?? null,
    full.createdAt,
  );

  return full;
}

export function listMessages(workspaceId: string, sessionId: string, limit?: number): Message[] {
  const db = getDb(workspaceId);
  const stmt = limit
    ? db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
    : db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  const rows = (limit ? stmt.all(sessionId, limit) : stmt.all(sessionId)) as MessageRow[];
  return rows.map(rowToMessage);
}

export function deleteOldMessages(workspaceId: string, sessionId: string, keepCount: number): void {
  const db = getDb(workspaceId);
  db.prepare(
    `DELETE FROM messages WHERE id IN (
      SELECT id FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?
    )`,
  ).run(sessionId, keepCount);
}

export function deleteMessagesBySession(workspaceId: string, sessionId: string): void {
  const db = getDb(workspaceId);
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
}
