import type { ZClawConfig } from './config.js';
import { loadConfig, getDataDir } from './config.js';
import { initDb, closeDb } from './db/connection.js';
import { syncAccountsFromConfig, configAccountToDbAccount } from './db/sync.js';
import { getEnabledAccounts } from './feishu/accounts.js';
import { disconnectAll } from './feishu/client.js';
import { startAllMonitors, type EventHandlerCallbacks } from './feishu/events.js';
import { AgentDispatcher } from './agent/dispatcher.js';
import { LarkCliRunner } from './lark-cli/runner.js';
import { cleanupAllWorkspacesMedia } from './feishu/media.js';
import { SchedulerEngine } from './scheduler/engine.js';
import { syncTasksFromConfig } from './scheduler/repository.js';
import { registerSchedulerEngine } from './scheduler/registry.js';
import type { FeishuAccount } from './feishu/accounts.js';
import {
  SHARED_WORKSPACE_ID,
  ensureWorkspaceDir,
  getWorkspaceDbPath,
  listWorkspaceIds,
  migrateLegacyData,
} from './workspace.js';

export interface ZClawRuntime {
  config: ZClawConfig;
  dispatcher: AgentDispatcher;
  cliRunner: LarkCliRunner;
  abortController: AbortController;
  schedulerEngines: SchedulerEngine[];
}

export async function start(): Promise<ZClawRuntime> {
  const config = loadConfig();
  const dataDir = getDataDir(config);

  // Migrate legacy data (data/zclaw.db, data/media/) to new workspace layout
  const accountIds = Object.keys(config.accounts.accounts);
  migrateLegacyData(dataDir, accountIds);

  // Ensure workspace directories exist
  const workspaceIds = listWorkspaceIds(config.accounts);
  for (const workspaceId of workspaceIds) {
    ensureWorkspaceDir(dataDir, workspaceId);
  }

  // Initialize shared workspace DB
  initDb(SHARED_WORKSPACE_ID, getWorkspaceDbPath(dataDir, SHARED_WORKSPACE_ID));

  // Initialize per-account workspace DBs
  for (const accountId of accountIds) {
    initDb(accountId, getWorkspaceDbPath(dataDir, accountId));
  }

  // Sync accounts config to shared workspace
  const dbAccounts = accountIds.map((accountId) => configAccountToDbAccount(accountId, config.accounts.accounts[accountId]!),
  );
  syncAccountsFromConfig(SHARED_WORKSPACE_ID, dbAccounts);

  // Clean media files older than 7 days in all workspaces
  cleanupAllWorkspacesMedia(dataDir, workspaceIds, 7 * 24 * 60 * 60 * 1000);

  const enabledAccounts = getEnabledAccounts(config.accounts);
  if (enabledAccounts.length === 0) {
    throw new Error('No enabled Feishu accounts configured');
  }

  const cliRunner = new LarkCliRunner(config.env.LARK_CLI_PATH);
  const dispatcher = new AgentDispatcher({ config, cliRunner });

  const abortController = new AbortController();

  const callbacks: EventHandlerCallbacks = {
    onMessage: (ctx, account) => dispatcher.dispatch(ctx, account),
    onCardAction: (ctx, account) =>
      dispatcher.dispatchCardAction({
        account,
        chatId: ctx.chatId ?? '',
        senderId: ctx.openId,
        messageId: ctx.messageId ?? '',
        actionValue: ctx.actionValue,
        formValue: ctx.formValue,
        threadId: ctx.threadId,
      }),
    gateConfig: {
      dmPolicy: 'open',
      groupPolicy: 'open',
      requireMention: true,
    },
  };

  console.info(`[zclaw] Starting ${enabledAccounts.length} Feishu account(s)...`);
  await startAllMonitors(enabledAccounts, callbacks, abortController.signal);

  // Sync and start scheduler engines
  const schedulerEngines = startSchedulers(config, cliRunner, dispatcher, enabledAccounts);

  return { config, dispatcher, cliRunner, abortController, schedulerEngines };
}

export async function stop(runtime: ZClawRuntime): Promise<void> {
  runtime.abortController.abort();
  for (const engine of runtime.schedulerEngines) {
    engine.stop();
  }
  disconnectAll();
  closeDb();
}

function startSchedulers(
  config: ZClawConfig,
  cliRunner: LarkCliRunner,
  dispatcher: AgentDispatcher,
  accounts: FeishuAccount[],
): SchedulerEngine[] {
  const engines: SchedulerEngine[] = [];

  // Group tasks by workspaceId
  const tasksByWorkspace = new Map<string, typeof config.tasks.tasks>();
  for (const task of config.tasks.tasks) {
    const list = tasksByWorkspace.get(task.workspaceId) ?? [];
    list.push(task);
    tasksByWorkspace.set(task.workspaceId, list);
  }

  // Ensure shared workspace has an engine even if no tasks
  if (!tasksByWorkspace.has(SHARED_WORKSPACE_ID)) {
    tasksByWorkspace.set(SHARED_WORKSPACE_ID, []);
  }

  for (const [workspaceId, tasks] of tasksByWorkspace) {
    syncTasksFromConfig(workspaceId, tasks);

    const engine = new SchedulerEngine({
      config,
      cliRunner,
      dispatcher,
      workspaceId,
      accounts,
    });
    engine.start();
    registerSchedulerEngine(workspaceId, engine);
    engines.push(engine);
  }

  return engines;
}
