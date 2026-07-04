import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getWorkspaceDir,
  getSharedWorkspaceDir,
  getWorkspaceDbPath,
  getWorkspaceMediaDir,
  ensureWorkspaceDir,
  listWorkspaceIds,
  migrateLegacyData,
  SHARED_WORKSPACE_ID,
} from '../src/workspace.js';

describe('workspace', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zclaw-workspace-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves workspace paths', () => {
    expect(getSharedWorkspaceDir(tempDir)).toBe(path.join(tempDir, 'shared'));
    expect(getWorkspaceDir(tempDir, 'acct_a')).toBe(path.join(tempDir, 'workspaces', 'acct_a'));
    expect(getWorkspaceDbPath(tempDir, 'acct_a')).toBe(path.join(tempDir, 'workspaces', 'acct_a', 'zclaw.db'));
    expect(getWorkspaceMediaDir(tempDir, 'acct_a')).toBe(path.join(tempDir, 'workspaces', 'acct_a', 'media'));
  });

  it('creates workspace directories and shared mount', () => {
    ensureWorkspaceDir(tempDir, 'acct_a');
    expect(fs.existsSync(getWorkspaceDir(tempDir, 'acct_a'))).toBe(true);
    expect(fs.existsSync(getWorkspaceMediaDir(tempDir, 'acct_a'))).toBe(true);
    expect(fs.existsSync(path.join(getWorkspaceDir(tempDir, 'acct_a'), SHARED_WORKSPACE_ID))).toBe(true);
  });

  it('lists workspace ids including shared', () => {
    const ids = listWorkspaceIds({
      accounts: {
        acct_a: { appId: 'a', appSecret: 's', brand: 'feishu', enabled: true },
        acct_b: { appId: 'b', appSecret: 's', brand: 'feishu', enabled: true },
      },
    });
    expect(ids).toContain(SHARED_WORKSPACE_ID);
    expect(ids).toContain('acct_a');
    expect(ids).toContain('acct_b');
  });

  it('migrates legacy DB to shared workspace', () => {
    const legacyDb = path.join(tempDir, 'zclaw.db');
    fs.writeFileSync(legacyDb, 'fake-db');
    migrateLegacyData(tempDir, ['acct_a']);
    expect(fs.existsSync(legacyDb)).toBe(false);
    expect(fs.existsSync(getWorkspaceDbPath(tempDir, SHARED_WORKSPACE_ID))).toBe(true);
  });

  it('migrates legacy media to account workspaces', () => {
    const legacyMedia = path.join(tempDir, 'media', 'acct_a', 'om_test');
    fs.mkdirSync(legacyMedia, { recursive: true });
    fs.writeFileSync(path.join(legacyMedia, 'img.png'), 'fake');

    migrateLegacyData(tempDir, ['acct_a']);
    expect(fs.existsSync(legacyMedia)).toBe(false);
    expect(fs.existsSync(path.join(getWorkspaceMediaDir(tempDir, 'acct_a'), 'om_test', 'img.png'))).toBe(true);
  });
});
