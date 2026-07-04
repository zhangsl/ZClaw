import { getDb } from './connection.js';
import type { Account } from './accounts.js';
import * as accountsDb from './accounts.js';

export function syncAccountsFromConfig(workspaceId: string, accounts: Account[]): void {
  const db = getDb(workspaceId);
  const existingIds = new Set(
    (db.prepare('SELECT account_id FROM accounts').all() as { account_id: string }[]).map((r) => r.account_id),
  );

  for (const account of accounts) {
    accountsDb.upsertAccount(workspaceId, account);
    existingIds.delete(account.accountId);
  }

  // Disable accounts that are no longer in config
  for (const removedId of existingIds) {
    db.prepare('UPDATE accounts SET enabled = 0 WHERE account_id = ?').run(removedId);
  }
}

export function configAccountToDbAccount(accountId: string, cfg: {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  brand: string;
  enabled?: boolean;
}): Account {
  return {
    accountId,
    appId: cfg.appId,
    appSecret: cfg.appSecret,
    encryptKey: cfg.encryptKey,
    verificationToken: cfg.verificationToken,
    brand: cfg.brand,
    enabled: cfg.enabled ?? true,
    createdAt: new Date().toISOString(),
  };
}
