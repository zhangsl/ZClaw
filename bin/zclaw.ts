#!/usr/bin/env node
import { parseCliArguments, printHelp } from '../src/cli/args.js';
import { executeCommand } from '../src/cli/commands.js';

async function main(): Promise<void> {
  const command = parseCliArguments(process.argv);

  if (command.type === 'help') {
    printHelp();
    process.exit(0);
  }

  try {
    await executeCommand(command);
  } catch (err) {
    console.error(`[zclaw] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[zclaw] Fatal error:', err);
  process.exit(1);
});
