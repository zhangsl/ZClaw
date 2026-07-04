import { randomUUID } from 'node:crypto';
import { getDb } from './connection.js';

export interface Session {
  id: string;
  accountId: string;
  chatId: string;
  chatType: 'p2p' | 'group';
  senderId: string;
  threadId?: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  account_id: string;
  chat_id: string;
  chat_type: string;
  sender_id: string;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    accountId: row.account_id,
    chatId: row.chat_id,
    chatType: row.chat_type as 'p2p' | 'group',
    senderId: row.sender_id,
    threadId: row.thread_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getOrCreateSession(workspaceId: string, params: {
  accountId: string;
  chatId: string;
  chatType: 'p2p' | 'group';
  senderId: string;
  threadId?: string;
}): { session: Session; created: boolean } {
  const db = getDb(workspaceId);
  const existing = db
    .prepare(
      'SELECT * FROM sessions WHERE account_id = ? AND chat_id = ? AND sender_id = ? AND (thread_id IS ? OR (thread_id IS NULL AND ? IS NULL))',
    )
    .get(params.accountId, params.chatId, params.senderId, params.threadId ?? null, params.threadId ?? null) as
    | SessionRow
    | undefined;

  if (existing) {
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), existing.id);
    return { session: rowToSession(existing), created: false };
  }

  const now = new Date().toISOString();
  const session: Session = {
    id: randomUUID(),
    accountId: params.accountId,
    chatId: params.chatId,
    chatType: params.chatType,
    senderId: params.senderId,
    threadId: params.threadId,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    'INSERT INTO sessions (id, account_id, chat_id, chat_type, sender_id, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    session.id,
    session.accountId,
    session.chatId,
    session.chatType,
    session.senderId,
    session.threadId ?? null,
    session.createdAt,
    session.updatedAt,
  );

  return { session, created: true };
}

export function getSessionById(workspaceId: string, sessionId: string): Session | undefined {
  const db = getDb(workspaceId);
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : undefined;
}

export function deleteSession(workspaceId: string, sessionId: string): void {
  const db = getDb(workspaceId);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteStaleSessions(workspaceId: string, ttlMs: number): void {
  const db = getDb(workspaceId);
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  db.prepare('DELETE FROM sessions WHERE updated_at < ?').run(cutoff);
}
