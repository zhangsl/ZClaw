import { getDb } from './connection.js';
import type { AccountRow } from './migrations/001-initial.js';

export interface Account {
  accountId: string;
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  brand: string;
  enabled: boolean;
  createdAt: string;
}

function rowToAccount(row: AccountRow): Account {
  return {
    accountId: row.account_id,
    appId: row.app_id,
    appSecret: row.app_secret,
    encryptKey: row.encrypt_key ?? undefined,
    verificationToken: row.verification_token ?? undefined,
    brand: row.brand,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  };
}

export function upsertAccount(workspaceId: string, account: Account): void {
  const db = getDb(workspaceId);
  db.prepare(
    `
    INSERT INTO accounts (account_id, app_id, app_secret, encrypt_key, verification_token, brand, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      app_id = excluded.app_id,
      app_secret = excluded.app_secret,
      encrypt_key = excluded.encrypt_key,
      verification_token = excluded.verification_token,
      brand = excluded.brand,
      enabled = excluded.enabled
    `,
  ).run(
    account.accountId,
    account.appId,
    account.appSecret,
    account.encryptKey ?? null,
    account.verificationToken ?? null,
    account.brand,
    account.enabled ? 1 : 0,
    account.createdAt,
  );
}

export function listAccounts(workspaceId: string): Account[] {
  const db = getDb(workspaceId);
  const rows = db.prepare('SELECT * FROM accounts').all() as AccountRow[];
  return rows.map(rowToAccount);
}

export function listEnabledAccounts(workspaceId: string): Account[] {
  return listAccounts(workspaceId).filter((a) => a.enabled);
}

export function getAccount(workspaceId: string, accountId: string): Account | undefined {
  const db = getDb(workspaceId);
  const row = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(accountId) as AccountRow | undefined;
  return row ? rowToAccount(row) : undefined;
}

export function deleteAccount(workspaceId: string, accountId: string): void {
  const db = getDb(workspaceId);
  db.prepare('DELETE FROM accounts WHERE account_id = ?').run(accountId);
}
