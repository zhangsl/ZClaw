import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LoggerConfig {
  level: LogLevel;
  logDir?: string;
  console?: boolean;
  file?: boolean;
}

let globalConfig: LoggerConfig = { level: 'info', console: true, file: false };
let currentLogFile: string | undefined;

export function setLogLevel(level: LogLevel): void {
  globalConfig = { ...globalConfig, level };
}

export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
  if (globalConfig.file && globalConfig.logDir) {
    fs.mkdirSync(globalConfig.logDir, { recursive: true });
    currentLogFile = path.join(globalConfig.logDir, `zclaw-${new Date().toISOString().slice(0, 10)}.log`);
  }
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[globalConfig.level];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: string,
  meta?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const ctx = context ? ` [${context}]` : '';
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${ctx} ${message}${metaStr}`;
}

function writeToFile(line: string): void {
  if (!globalConfig.file || !currentLogFile) return;
  try {
    fs.appendFileSync(currentLogFile, line + '\n');
  } catch (err) {
    // Fallback to stderr only once to avoid recursion
    process.stderr.write(`[logger] Failed to write log file: ${err}\n`);
    globalConfig.file = false;
  }
}

export function log(
  level: LogLevel,
  message: string,
  context?: string,
  meta?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const line = formatMessage(level, message, context, meta);
  if (globalConfig.console) {
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
  writeToFile(line);
}

export function debug(message: string, context?: string, meta?: Record<string, unknown>): void {
  log('debug', message, context, meta);
}

export function info(message: string, context?: string, meta?: Record<string, unknown>): void {
  log('info', message, context, meta);
}

export function warn(message: string, context?: string, meta?: Record<string, unknown>): void {
  log('warn', message, context, meta);
}

export function error(message: string, context?: string, meta?: Record<string, unknown>): void {
  log('error', message, context, meta);
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export function getLogger(context: string): Logger {
  return {
    debug: (message, meta) => log('debug', message, context, meta),
    info: (message, meta) => log('info', message, context, meta),
    warn: (message, meta) => log('warn', message, context, meta),
    error: (message, meta) => log('error', message, context, meta),
  };
}

export function getAccountLogger(accountId: string): Logger {
  return getLogger(`account:${accountId}`);
}
