import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

function getPackageJsonVersion(): string {
  try {
    const pkg = require('../../package.json') as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

function detectPackageManager(): string {
  const execPath = process.argv[1] ?? '';
  if (execPath.includes('pnpm')) return 'pnpm';
  if (execPath.includes('yarn')) return 'yarn';
  return 'npm';
}

export function upgradeZClaw(preferredPm?: string): void {
  const pm = preferredPm && ['npm', 'pnpm', 'yarn'].includes(preferredPm)
    ? preferredPm
    : detectPackageManager();

  const currentVersion = getPackageJsonVersion();
  console.info(`[zclaw] Current version: ${currentVersion}`);
  console.info(`[zclaw] Upgrading ZClaw using ${pm}...`);

  let command: string;
  switch (pm) {
    case 'pnpm':
      command = 'pnpm add -g zclaw@latest';
      break;
    case 'yarn':
      command = 'yarn global add zclaw@latest';
      break;
    case 'npm':
    default:
      command = 'npm install -g zclaw@latest';
      break;
  }

  try {
    execSync(command, { stdio: 'inherit' });
    console.info('[zclaw] Upgrade completed. Run "zclaw --version" or "zclaw status" to verify.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[zclaw] Upgrade failed: ${message}`);
    console.error(`[zclaw] You can also manually run: ${command}`);
    process.exit(1);
  }
}
