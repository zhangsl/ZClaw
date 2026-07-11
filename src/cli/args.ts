import { parseArgs } from 'node:util';

export type CliCommand =
  | { type: 'start'; daemon: boolean }
  | { type: 'stop' }
  | { type: 'restart' }
  | { type: 'status' }
  | { type: 'account'; subcommand: 'list' | 'add' | 'remove' | 'set-model'; args: string[]; flags: Record<string, string | boolean | undefined> }
  | { type: 'task'; subcommand: 'list' | 'add' | 'remove'; args: string[]; flags: Record<string, string | boolean | undefined> }
  | { type: 'help' };

export function parseCliArguments(argv: string[]): CliCommand {
  const rawArgs = argv.slice(2);
  if (rawArgs.length === 0) {
    return { type: 'help' };
  }

  const [command, subcommand] = rawArgs;

  switch (command) {
    case 'start': {
      const { values } = parseArgs({
        args: rawArgs,
        options: { daemon: { type: 'boolean', short: 'd' } },
        allowPositionals: true,
      });
      return { type: 'start', daemon: values.daemon === true };
    }
    case 'stop':
      return { type: 'stop' };
    case 'restart':
      return { type: 'restart' };
    case 'status':
      return { type: 'status' };

    case 'account': {
      if (!subcommand || !['list', 'add', 'remove', 'set-model'].includes(subcommand)) {
        throw new Error('Usage: zclaw account <list|add|remove|set-model> ...');
      }
      const { positionals, values } = parseArgs({
        args: rawArgs.slice(1),
        options: {
          'app-id': { type: 'string' },
          'app-secret': { type: 'string' },
          brand: { type: 'string' },
          enabled: { type: 'boolean' },
          disabled: { type: 'boolean' },
        },
        allowPositionals: true,
      });
      return {
        type: 'account',
        subcommand: subcommand as 'list' | 'add' | 'remove' | 'set-model',
        args: positionals.slice(1),
        flags: values as Record<string, string | boolean | undefined>,
      };
    }

    case 'task': {
      if (!subcommand || !['list', 'add', 'remove'].includes(subcommand)) {
        throw new Error('Usage: zclaw task <list|add|remove> ...');
      }
      const { positionals, values } = parseArgs({
        args: rawArgs.slice(1),
        options: {
          name: { type: 'string' },
          description: { type: 'string' },
          cron: { type: 'string' },
          workspace: { type: 'string' },
          'action-type': { type: 'string' },
          'action-payload': { type: 'string' },
          enabled: { type: 'boolean' },
          disabled: { type: 'boolean' },
        },
        allowPositionals: true,
      });
      return {
        type: 'task',
        subcommand: subcommand as 'list' | 'add' | 'remove',
        args: positionals.slice(1),
        flags: values as Record<string, string | boolean | undefined>,
      };
    }

    default:
      return { type: 'help' };
  }
}

export function printHelp(): void {
  console.log(`Usage: zclaw <command> [options]

Commands:
  start [--daemon]              Start ZClaw (foreground or daemon)
  stop                          Stop daemon
  restart                       Restart daemon
  status                        Show daemon status

  account list                  List configured Feishu accounts
  account add <id> --app-id <id> --app-secret <secret> [options]
                                Add a Feishu account
  account remove <id>           Remove a Feishu account
  account set-model <id> <model>
                                Set the Claude model for an account

  task list [--workspace <id>]  List scheduled tasks
  task add <id> --name <name> --cron <cron> --workspace <id>
         --action-type <type> --action-payload <json>
                                Add a scheduled task
  task remove <id> [--workspace <id>]
                                Remove a scheduled task

Examples:
  zclaw start --daemon
  zclaw account add mybot --app-id cli_xxx --app-secret xxx
  zclaw account set-model mybot claude-sonnet-4-7
  zclaw task add daily-report --name "Daily Report" --cron "0 18 * * 1-5" \\
         --workspace mybot --action-type send_message \\
         --action-payload '{"chat_id":"oc_xxx","text":"hello"}'
`);
}
