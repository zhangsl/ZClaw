import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { CliEnvelope } from './types.js';
import { CliError } from './types.js';

function findInPath(binary: string): string | undefined {
  const paths = process.env.PATH?.split(path.delimiter) ?? [];
  for (const dir of paths) {
    const candidate = path.join(dir, binary);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function resolveCliPath(cliPath?: string): Promise<string> {
  if (cliPath) {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Configured lark-cli path not found: ${cliPath}`);
    }
    return cliPath;
  }

  const found = findInPath('lark');
  if (found) return found;
  throw new Error('lark-cli not found in PATH. Set LARK_CLI_PATH or install lark-cli.');
}

function runCommand(bin: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

export class LarkCliRunner {
  private cliPath?: string;

  constructor(cliPath?: string) {
    this.cliPath = cliPath;
  }

  async exec(args: string[]): Promise<CliEnvelope> {
    const bin = await resolveCliPath(this.cliPath);
    const { stdout, stderr } = await runCommand(bin, [...args, '--format', 'json']);

    if (!stdout && stderr) {
      throw new Error(`lark-cli error: ${stderr}`);
    }

    let result: CliEnvelope;
    try {
      result = JSON.parse(stdout) as CliEnvelope;
    } catch {
      throw new Error(`lark-cli returned non-JSON output: ${stdout}`);
    }

    if (!result.ok && result.error) {
      throw new CliError(result.error);
    }

    return result;
  }

  async sendMessage(params: { chatId?: string; userId?: string; text: string; replyTo?: string }): Promise<CliEnvelope> {
    const args = ['im', '+messages-send'];
    if (params.chatId) args.push('--chat-id', params.chatId);
    if (params.userId) args.push('--user-id', params.userId);
    if (params.replyTo) args.push('--reply-to', params.replyTo);
    args.push('--text', params.text);
    return this.exec(args);
  }

  async createDoc(params: { title: string; content?: string; folderToken?: string }): Promise<CliEnvelope> {
    const args = ['docs', '+create'];
    args.push('--title', params.title);
    if (params.content) args.push('--content', params.content);
    if (params.folderToken) args.push('--parent-token', params.folderToken);
    return this.exec(args);
  }

  async uploadFile(params: { filePath: string; parentFolderToken?: string }): Promise<CliEnvelope> {
    const args = ['drive', '+drive-upload'];
    args.push('--file', params.filePath);
    if (params.parentFolderToken) args.push('--folder-token', params.parentFolderToken);
    return this.exec(args);
  }
}
