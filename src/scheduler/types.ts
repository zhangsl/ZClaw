import type { ZClawConfig } from '../config.js';
import type { LarkCliRunner } from '../lark-cli/runner.js';
import type { AgentDispatcher } from '../agent/dispatcher.js';
import type { FeishuAccount } from '../feishu/accounts.js';

export interface ScheduledTask {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  cron: string;
  enabled: boolean;
  source?: 'config' | 'runtime';
  action: TaskAction;
}

export interface TaskAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface TaskExecutionContext {
  config: ZClawConfig;
  cliRunner: LarkCliRunner;
  dispatcher: AgentDispatcher;
  workspaceId: string;
  accounts: FeishuAccount[];
}

export type TaskActionHandler = (ctx: TaskExecutionContext, payload: Record<string, unknown>) => Promise<void>;

export interface TaskRunInfo {
  lastRunAt: string;
  nextRunAt: string;
  lastStatus: 'success' | 'failed';
  lastError?: string;
}

export interface ScheduledTaskRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  cron: string;
  action_type: string;
  action_payload: string;
  enabled: number;
  source: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
