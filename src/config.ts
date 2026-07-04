import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-7'),
  CLAUDE_MAX_TOKENS: z.coerce.number().default(2048),

  ZCLAW_DATA_DIR: z.string().default('./data'),
  ZCLAW_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ZCLAW_SESSION_MAX_MESSAGES: z.coerce.number().default(20),
  ZCLAW_SESSION_TTL_MS: z.coerce.number().default(3600000),
  ZCLAW_MEDIA_MAX_MB: z.coerce.number().default(30),

  LARK_CLI_PATH: z.string().optional(),
  ZCLAW_ACCOUNTS_CONFIG: z.string().default('./accounts.json'),
  ZCLAW_TASKS_CONFIG: z.string().default('./tasks.json'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const feishuAccountSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  encryptKey: z.string().optional(),
  verificationToken: z.string().optional(),
  brand: z.enum(['feishu', 'lark']).default('feishu'),
  enabled: z.boolean().default(true),
});

export type FeishuAccountConfig = z.infer<typeof feishuAccountSchema>;

export const accountsConfigSchema = z.object({
  accounts: z.record(z.string(), feishuAccountSchema),
});

export type AccountsConfig = z.infer<typeof accountsConfigSchema>;

export const taskActionSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

export const scheduledTaskSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  cron: z.string().min(1),
  enabled: z.boolean().default(true),
  action: taskActionSchema,
});

export type ScheduledTaskConfig = z.infer<typeof scheduledTaskSchema>;

export const tasksConfigSchema = z.object({
  tasks: z.array(scheduledTaskSchema).default([]),
});

export type TasksConfig = z.infer<typeof tasksConfigSchema>;

export interface ZClawConfig {
  env: EnvConfig;
  accounts: AccountsConfig;
  tasks: TasksConfig;
}

function loadEnv(): EnvConfig {
  return envSchema.parse(process.env);
}

function loadAccounts(configPath: string): AccountsConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Accounts config not found: ${resolved}. Create it from accounts.json.example`);
  }
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  return accountsConfigSchema.parse(raw);
}

function loadTasks(configPath: string): TasksConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    return { tasks: [] };
  }
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  return tasksConfigSchema.parse(raw);
}

export function loadConfig(): ZClawConfig {
  const env = loadEnv();
  const accounts = loadAccounts(env.ZCLAW_ACCOUNTS_CONFIG);
  const tasks = loadTasks(env.ZCLAW_TASKS_CONFIG);
  return { env, accounts, tasks };
}

export function getDataDir(config: ZClawConfig): string {
  const dir = path.resolve(config.env.ZCLAW_DATA_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
