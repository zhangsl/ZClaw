import fs from 'node:fs';
import path from 'node:path';
import type { AccountsConfig } from './config.js';

export const SHARED_WORKSPACE_ID = 'shared';

export function getWorkspacesRootDir(dataDir: string): string {
  return path.join(dataDir, 'workspaces');
}

export function getSharedWorkspaceDir(dataDir: string): string {
  return path.join(dataDir, SHARED_WORKSPACE_ID);
}

export function getWorkspaceDir(dataDir: string, workspaceId: string): string {
  if (workspaceId === SHARED_WORKSPACE_ID) {
    return getSharedWorkspaceDir(dataDir);
  }
  return path.join(getWorkspacesRootDir(dataDir), workspaceId);
}

export function getWorkspaceDbPath(dataDir: string, workspaceId: string): string {
  return path.join(getWorkspaceDir(dataDir, workspaceId), 'zclaw.db');
}

export function getWorkspaceMediaDir(dataDir: string, workspaceId: string): string {
  return path.join(getWorkspaceDir(dataDir, workspaceId), 'media');
}

export function ensureWorkspaceDir(dataDir: string, workspaceId: string): void {
  // Always ensure shared workspace exists first because account workspaces may symlink to it
  if (workspaceId !== SHARED_WORKSPACE_ID) {
    ensureWorkspaceDir(dataDir, SHARED_WORKSPACE_ID);
  }

  const dir = getWorkspaceDir(dataDir, workspaceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(getWorkspaceMediaDir(dataDir, workspaceId), { recursive: true });

  // Mount shared workspace under each account workspace
  if (workspaceId !== SHARED_WORKSPACE_ID) {
    const sharedLink = path.join(dir, SHARED_WORKSPACE_ID);
    const sharedTarget = getSharedWorkspaceDir(dataDir);

    if (!fs.existsSync(sharedLink)) {
      try {
        fs.symlinkSync(sharedTarget, sharedLink);
      } catch {
        // Fallback: create a regular directory if symlink fails (e.g., Windows without privileges)
        fs.mkdirSync(sharedLink, { recursive: true });
      }
    }
  }
}

export function listWorkspaceIds(accountsConfig: AccountsConfig): string[] {
  const accountIds = Object.keys(accountsConfig.accounts);
  return [SHARED_WORKSPACE_ID, ...accountIds];
}

export function migrateLegacyData(dataDir: string, accountIds: string[]): void {
  // Legacy DB path: data/zclaw.db -> data/shared/zclaw.db
  const legacyDb = path.join(dataDir, 'zclaw.db');
  const sharedDb = getWorkspaceDbPath(dataDir, SHARED_WORKSPACE_ID);

  if (fs.existsSync(legacyDb) && !fs.existsSync(sharedDb)) {
    fs.mkdirSync(path.dirname(sharedDb), { recursive: true });
    fs.renameSync(legacyDb, sharedDb);
  }

  // Legacy media: data/media/<accountId> -> data/workspaces/<accountId>/media
  const legacyMediaRoot = path.join(dataDir, 'media');
  if (!fs.existsSync(legacyMediaRoot)) return;

  for (const accountId of accountIds) {
    const legacyAccountMedia = path.join(legacyMediaRoot, accountId);
    const newAccountMedia = getWorkspaceMediaDir(dataDir, accountId);
    if (fs.existsSync(legacyAccountMedia) && !fs.existsSync(newAccountMedia)) {
      fs.mkdirSync(path.dirname(newAccountMedia), { recursive: true });
      fs.renameSync(legacyAccountMedia, newAccountMedia);
    }
  }

  // Clean up empty legacy media root
  if (fs.existsSync(legacyMediaRoot)) {
    const remaining = fs.readdirSync(legacyMediaRoot);
    if (remaining.length === 0) {
      fs.rmdirSync(legacyMediaRoot);
    }
  }
}

export function cleanupWorkspaces(dataDir: string, activeWorkspaceIds: string[]): void {
  const root = getWorkspacesRootDir(dataDir);
  if (!fs.existsSync(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !activeWorkspaceIds.includes(entry.name)) {
      // Optionally: remove orphaned workspace directories
      // For safety, we do not auto-delete; just log or skip
    }
  }
}
