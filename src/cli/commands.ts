import { ConfigManager } from './config-manager.js';
import { startDaemon, stopDaemon, restartDaemon, showStatus, runForeground } from './daemon.js';
import { upgradeZClaw } from './upgrade.js';
import { start, stop } from '../index.js';
import { loadConfig, getDataDir, envSchema } from '../config.js';
import type { CliCommand } from './args.js';

function loadCliEnv() {
  return envSchema.pick({ ZCLAW_ACCOUNTS_CONFIG: true, ZCLAW_TASKS_CONFIG: true, ZCLAW_DATA_DIR: true }).parse(process.env);
}

function createConfigManager(): ConfigManager {
  const env = loadCliEnv();
  return new ConfigManager(env.ZCLAW_ACCOUNTS_CONFIG, env.ZCLAW_TASKS_CONFIG);
}

function getDataDirFromConfig(): string {
  return getDataDir(loadConfig());
}

export async function executeCommand(command: CliCommand): Promise<void> {
  switch (command.type) {
    case 'start': {
      const dataDir = getDataDirFromConfig();
      if (command.daemon) {
        startDaemon(dataDir);
      } else {
        runForeground(start, stop);
      }
      return;
    }

    case 'stop': {
      const dataDir = getDataDirFromConfig();
      stopDaemon(dataDir);
      return;
    }

    case 'restart': {
      const dataDir = getDataDirFromConfig();
      restartDaemon(dataDir);
      return;
    }

    case 'status': {
      const dataDir = getDataDirFromConfig();
      showStatus(dataDir);
      return;
    }

    case 'upgrade': {
      upgradeZClaw(command.packageManager);
      return;
    }

    case 'account': {
      const manager = createConfigManager();
      switch (command.subcommand) {
        case 'list': {
          const accounts = manager.listAccounts();
          const ids = Object.keys(accounts);
          if (ids.length === 0) {
            console.info('No accounts configured');
            return;
          }
          console.info('Accounts:');
          for (const id of ids) {
            const a = accounts[id]!;
            console.info(`  ${id}: appId=${a.appId}, brand=${a.brand}, enabled=${a.enabled}, model=${a.agent?.model ?? '<default>'}`);
          }
          return;
        }
        case 'add': {
          const [accountId] = command.args;
          if (!accountId) {
            throw new Error('Usage: zclaw account add <id> --app-id <id> --app-secret <secret>');
          }
          const appId = command.flags['app-id'] as string | undefined;
          const appSecret = command.flags['app-secret'] as string | undefined;
          if (!appId || !appSecret) {
            throw new Error('--app-id and --app-secret are required');
          }
          let enabled = true;
          if (command.flags.disabled === true) enabled = false;
          if (command.flags.enabled === true) enabled = true;
          manager.addAccount(accountId, {
            appId,
            appSecret,
            brand: (command.flags.brand as 'feishu' | 'lark') ?? 'feishu',
            enabled,
          });
          console.info(`[zclaw] Account "${accountId}" added. Run "zclaw restart" to apply.`);
          return;
        }
        case 'remove': {
          const [accountId] = command.args;
          if (!accountId) {
            throw new Error('Usage: zclaw account remove <id>');
          }
          manager.removeAccount(accountId);
          console.info(`[zclaw] Account "${accountId}" removed. Run "zclaw restart" to apply.`);
          return;
        }
        case 'set-model': {
          const [accountId, model] = command.args;
          if (!accountId || !model) {
            throw new Error('Usage: zclaw account set-model <id> <model>');
          }
          manager.setAccountModel(accountId, model);
          console.info(`[zclaw] Account "${accountId}" model set to "${model}". Run "zclaw restart" to apply.`);
          return;
        }
      }
      return;
    }

    case 'task': {
      const manager = createConfigManager();
      switch (command.subcommand) {
        case 'list': {
          const workspace = command.flags.workspace as string | undefined;
          const tasks = manager.listTasks();
          const filtered = workspace ? tasks.filter((t) => t.workspaceId === workspace) : tasks;
          if (filtered.length === 0) {
            console.info('No tasks configured');
            return;
          }
          console.info('Tasks:');
          for (const t of filtered) {
            console.info(`  ${t.id}: name=${t.name}, workspace=${t.workspaceId}, cron=${t.cron}, enabled=${t.enabled}`);
          }
          return;
        }
        case 'add': {
          const [taskId] = command.args;
          if (!taskId) {
            throw new Error('Usage: zclaw task add <id> --name <name> --cron <cron> --workspace <id> --action-type <type> --action-payload <json>');
          }
          const name = command.flags.name as string | undefined;
          const cron = command.flags.cron as string | undefined;
          const workspaceId = command.flags.workspace as string | undefined;
          const actionType = command.flags['action-type'] as string | undefined;
          const actionPayloadRaw = command.flags['action-payload'] as string | undefined;
          if (!name || !cron || !workspaceId || !actionType) {
            throw new Error('--name, --cron, --workspace, and --action-type are required');
          }
          let actionPayload: Record<string, unknown> = {};
          if (actionPayloadRaw) {
            try {
              actionPayload = JSON.parse(actionPayloadRaw) as Record<string, unknown>;
            } catch {
              throw new Error('--action-payload must be valid JSON');
            }
          }
          let enabled = true;
          if (command.flags.disabled === true) enabled = false;
          if (command.flags.enabled === true) enabled = true;
          manager.addTask({
            id: taskId,
            name,
            description: command.flags.description as string | undefined,
            cron,
            workspaceId,
            actionType,
            actionPayload,
            enabled,
          });
          console.info(`[zclaw] Task "${taskId}" added. Run "zclaw restart" to apply.`);
          return;
        }
        case 'remove': {
          const [taskId] = command.args;
          if (!taskId) {
            throw new Error('Usage: zclaw task remove <id> [--workspace <id>]');
          }
          manager.removeTask(taskId, command.flags.workspace as string | undefined);
          console.info(`[zclaw] Task "${taskId}" removed. Run "zclaw restart" to apply.`);
          return;
        }
      }
      return;
    }

    case 'help':
      return;
  }
}
