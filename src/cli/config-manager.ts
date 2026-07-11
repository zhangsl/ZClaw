import fs from 'node:fs';
import path from 'node:path';
import {
  accountsConfigSchema,
  tasksConfigSchema,
  feishuAccountSchema,
  scheduledTaskSchema,
  type FeishuAccountConfig,
} from '../config.js';

function readJson<T>(filePath: string, defaultValue: T): T {
  if (!fs.existsSync(filePath)) return defaultValue;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

export class ConfigManager {
  private accountsPath: string;
  private tasksPath: string;

  constructor(accountsPath: string, tasksPath: string) {
    this.accountsPath = path.resolve(accountsPath);
    this.tasksPath = path.resolve(tasksPath);
  }

  // Accounts
  listAccounts(): Record<string, FeishuAccountConfig> {
    const data = readJson(this.accountsPath, { accounts: {} });
    return accountsConfigSchema.parse(data).accounts;
  }

  addAccount(accountId: string, account: FeishuAccountConfig): void {
    const data = readJson(this.accountsPath, { accounts: {} });
    const parsed = accountsConfigSchema.parse(data);
    if (parsed.accounts[accountId]) {
      throw new Error(`Account "${accountId}" already exists`);
    }
    parsed.accounts[accountId] = feishuAccountSchema.parse(account);
    writeJson(this.accountsPath, parsed);
  }

  removeAccount(accountId: string): void {
    const data = readJson(this.accountsPath, { accounts: {} });
    const parsed = accountsConfigSchema.parse(data);
    if (!parsed.accounts[accountId]) {
      throw new Error(`Account "${accountId}" not found`);
    }
    delete parsed.accounts[accountId];
    writeJson(this.accountsPath, parsed);
  }

  setAccountModel(accountId: string, model: string): void {
    const data = readJson(this.accountsPath, { accounts: {} });
    const parsed = accountsConfigSchema.parse(data);
    if (!parsed.accounts[accountId]) {
      throw new Error(`Account "${accountId}" not found`);
    }
    parsed.accounts[accountId]!.agent = {
      ...parsed.accounts[accountId]!.agent,
      model,
    };
    writeJson(this.accountsPath, parsed);
  }

  // Tasks
  listTasks(): Array<{ id: string; workspaceId: string; name: string; cron: string; enabled: boolean }> {
    const data = readJson(this.tasksPath, { tasks: [] });
    return tasksConfigSchema.parse(data).tasks.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      cron: t.cron,
      enabled: t.enabled,
    }));
  }

  addTask(task: {
    id: string;
    name: string;
    description?: string;
    cron: string;
    workspaceId: string;
    actionType: string;
    actionPayload: Record<string, unknown>;
    enabled: boolean;
  }): void {
    const data = readJson(this.tasksPath, { tasks: [] });
    const parsed = tasksConfigSchema.parse(data);
    if (parsed.tasks.some((t) => t.id === task.id)) {
      throw new Error(`Task "${task.id}" already exists`);
    }
    parsed.tasks.push(
      scheduledTaskSchema.parse({
        id: task.id,
        name: task.name,
        description: task.description,
        cron: task.cron,
        workspaceId: task.workspaceId,
        enabled: task.enabled,
        action: {
          type: task.actionType,
          payload: task.actionPayload,
        },
      }),
    );
    writeJson(this.tasksPath, parsed);
  }

  removeTask(taskId: string, workspaceId?: string): void {
    const data = readJson(this.tasksPath, { tasks: [] });
    const parsed = tasksConfigSchema.parse(data);
    const before = parsed.tasks.length;
    parsed.tasks = parsed.tasks.filter((t) => !(t.id === taskId && (!workspaceId || t.workspaceId === workspaceId)));
    if (parsed.tasks.length === before) {
      throw new Error(`Task "${taskId}" not found`);
    }
    writeJson(this.tasksPath, parsed);
  }
}
