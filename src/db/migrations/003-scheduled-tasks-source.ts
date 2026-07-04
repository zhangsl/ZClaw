import type Database from 'better-sqlite3';
import { registerMigration } from './index.js';

export const migration003 = {
  version: 3,
  name: 'scheduled-tasks-source',
  up(db: Database.Database): void {
    db.exec(`
      ALTER TABLE scheduled_tasks ADD COLUMN source TEXT DEFAULT 'runtime';
      UPDATE scheduled_tasks SET source = 'config' WHERE source IS NULL OR source = '';
    `);
  },
};

registerMigration(migration003);
