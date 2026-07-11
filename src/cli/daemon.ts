import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

export function getPidFile(dataDir: string): string {
  return path.join(dataDir, 'zclaw.pid');
}

export function getLogFile(dataDir: string): string {
  return path.join(dataDir, 'zclaw.log');
}

function readPid(pidFile: string): number | undefined {
  if (!fs.existsSync(pidFile)) return undefined;
  const content = fs.readFileSync(pidFile, 'utf8').trim();
  const pid = Number(content);
  if (Number.isNaN(pid) || pid <= 0) return undefined;
  return pid;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getDaemonStatus(dataDir: string): { running: boolean; pid?: number; logFile: string } {
  const pidFile = getPidFile(dataDir);
  const pid = readPid(pidFile);
  const running = pid ? isProcessRunning(pid) : false;
  return { running, pid, logFile: getLogFile(dataDir) };
}

export function startDaemon(dataDir: string): void {
  const status = getDaemonStatus(dataDir);
  if (status.running) {
    console.info(`[zclaw] Daemon already running (pid ${status.pid})`);
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const pidFile = getPidFile(dataDir);
  const logFile = getLogFile(dataDir);

  const child = spawn(process.execPath, [process.argv[1]!, 'start'], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  child.stdout?.pipe(fs.createWriteStream('', { fd: out }));
  child.stderr?.pipe(fs.createWriteStream('', { fd: err }));

  child.unref();

  // Write pid after a short delay to ensure process is alive
  setTimeout(() => {
    if (isProcessRunning(child.pid!)) {
      fs.writeFileSync(pidFile, String(child.pid));
      console.info(`[zclaw] Daemon started (pid ${child.pid}), log: ${logFile}`);
    } else {
      console.error('[zclaw] Failed to start daemon');
    }
  }, 500);
}

export function stopDaemon(dataDir: string): void {
  const status = getDaemonStatus(dataDir);
  if (!status.running || !status.pid) {
    console.info('[zclaw] Daemon is not running');
    cleanPidFile(dataDir);
    return;
  }

  try {
    process.kill(status.pid, 'SIGTERM');
    console.info(`[zclaw] Stopping daemon (pid ${status.pid})...`);

    // Wait up to 5 seconds for graceful shutdown
    let waited = 0;
    const interval = setInterval(() => {
      waited += 200;
      if (!isProcessRunning(status.pid!)) {
        clearInterval(interval);
        cleanPidFile(dataDir);
        console.info('[zclaw] Daemon stopped');
        return;
      }
      if (waited >= 5000) {
        clearInterval(interval);
        try {
          process.kill(status.pid!, 'SIGKILL');
        } catch {
          // ignore
        }
        cleanPidFile(dataDir);
        console.info('[zclaw] Daemon force stopped');
      }
    }, 200);
  } catch (err) {
    console.error(`[zclaw] Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`);
    cleanPidFile(dataDir);
  }
}

export function restartDaemon(dataDir: string): void {
  stopDaemon(dataDir);
  // Give it a moment to release resources
  setTimeout(() => {
    startDaemon(dataDir);
  }, 1000);
}

function cleanPidFile(dataDir: string): void {
  const pidFile = getPidFile(dataDir);
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore
  }
}

export function showStatus(dataDir: string): void {
  const status = getDaemonStatus(dataDir);
  if (status.running) {
    console.info(`[zclaw] Daemon is running (pid ${status.pid})`);
    console.info(`[zclaw] Log: ${status.logFile}`);
  } else {
    console.info('[zclaw] Daemon is not running');
  }
}

export function runForeground<T>(startFn: () => Promise<T>, stopFn: (runtime: T) => Promise<void>): void {
  startFn().then((runtime) => {
    process.on('SIGINT', async () => {
      console.info('\n[zclaw] Received SIGINT, shutting down...');
      await stopFn(runtime);
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.info('\n[zclaw] Received SIGTERM, shutting down...');
      await stopFn(runtime);
      process.exit(0);
    });
  }).catch((err) => {
    console.error('[zclaw] Fatal error:', err);
    process.exit(1);
  });
}
