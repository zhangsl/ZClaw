#!/usr/bin/env node
import { start, stop } from '../src/index.js';

async function main(): Promise<void> {
  const runtime = await start();

  process.on('SIGINT', async () => {
    console.info('\n[zclaw] Received SIGINT, shutting down...');
    await stop(runtime);
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.info('\n[zclaw] Received SIGTERM, shutting down...');
    await stop(runtime);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[zclaw] Fatal error:', err);
  process.exit(1);
});
