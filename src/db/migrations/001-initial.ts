import type Database from 'better-sqlite3';
import { registerMigration } from './index.js';

export interface AccountRow {
  account_id: string;
  app_id: string;
  app_secret: string;
  encrypt_key: string | null;
  verification_token: string | null;
  brand: string;
  enabled: number;
  created_at: string;
}

const migration = {
  version: 1,
  name: 'initial',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        account_id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        app_secret TEXT NOT NULL,
        encrypt_key TEXT,
        verification_token TEXT,
        brand TEXT DEFAULT 'feishu',
        enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        chat_type TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        thread_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(account_id, chat_id, sender_id, thread_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_result TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_lookup ON sessions(account_id, chat_id, sender_id);
    `);
  },
};

registerMigration(migration);
