import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migrations/index.js';
import './migrations/001-initial.js';
import './migrations/002-scheduled-tasks.js';
import './migrations/003-scheduled-tasks-source.js';

const dbs = new Map<string, Database.Database>();

export function initDb(workspaceId: string, dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  dbs.set(workspaceId, db);
  return db;
}

export function getDb(workspaceId: string): Database.Database {
  const db = dbs.get(workspaceId);
  if (!db) {
    throw new Error(`Database not initialized for workspace "${workspaceId}". Call initDb() first.`);
  }
  return db;
}

export function closeDb(workspaceId?: string): void {
  if (workspaceId) {
    const db = dbs.get(workspaceId);
    if (db) {
      db.close();
      dbs.delete(workspaceId);
    }
    return;
  }

  for (const db of dbs.values()) {
    db.close();
  }
  dbs.clear();
}

export function listActiveDbWorkspaces(): string[] {
  return Array.from(dbs.keys());
}
