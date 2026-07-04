import type { AccountsConfig, FeishuAccountConfig } from '../config.js';

export interface FeishuAccount extends FeishuAccountConfig {
  accountId: string;
}

export function getEnabledAccounts(config: AccountsConfig): FeishuAccount[] {
  return Object.entries(config.accounts)
    .filter(([, cfg]) => cfg.enabled)
    .map(([accountId, cfg]) => ({ ...cfg, accountId }));
}

export function getAccount(config: AccountsConfig, accountId?: string): FeishuAccount | undefined {
  if (accountId) {
    const cfg = config.accounts[accountId];
    return cfg ? { ...cfg, accountId } : undefined;
  }

  const enabled = getEnabledAccounts(config);
  return enabled[0];
}

export function listAllAccounts(config: AccountsConfig): FeishuAccount[] {
  return Object.entries(config.accounts).map(([accountId, cfg]) => ({ ...cfg, accountId }));
}
